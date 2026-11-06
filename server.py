#!/usr/bin/env python3
"""Self-contained manufacturing operations demo: SQLite + stdlib HTTP API."""
from __future__ import annotations

import base64
import collections
import csv
from datetime import date, datetime, timedelta
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from io import BytesIO, StringIO
import json
import os
from pathlib import Path
import posixpath
import re
import sqlite3
import sys
from urllib.parse import parse_qs, urlparse
import xml.etree.ElementTree as ET
from zipfile import BadZipFile, ZipFile

ROOT = Path(__file__).resolve().parent
DB_PATH = Path(os.getenv('OPS_DB_PATH', str(ROOT / 'data' / 'app.db')))
TABLES = {
    'prep': ('record_id', 'date', 'batch_id', 'employee', 'plan_qty', 'fact_qty'),
    'weld': ('record_id', 'date', 'batch_id', 'need_qty'),
    'docs': ('record_id', 'date', 'employee', 'plan_docs', 'fact_docs'),
}
LABELS = {'prep': 'Заготовка', 'weld': 'Потребность сварки', 'docs': 'Документация'}
NUMBER_FIELDS = {'plan_qty', 'fact_qty', 'need_qty', 'plan_docs', 'fact_docs'}
REQUIRED = {'record_id', 'date', 'batch_id', 'employee', 'plan_qty', 'need_qty', 'plan_docs'}
NAMESPACES = {'main': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
              'rel': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
              'pkg': 'http://schemas.openxmlformats.org/package/2006/relationships'}


def db_connect(path=None):
    location = str(path or DB_PATH)
    if location != ':memory:':
        Path(location).parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(location)
    connection.row_factory = sqlite3.Row
    connection.execute('PRAGMA foreign_keys = ON')
    return connection


def init_db(db):
    db.executescript('''
    CREATE TABLE IF NOT EXISTS prep (
        id INTEGER PRIMARY KEY AUTOINCREMENT, record_id TEXT, date TEXT, batch_id TEXT,
        employee TEXT, plan_qty REAL, fact_qty REAL);
    CREATE TABLE IF NOT EXISTS weld (
        id INTEGER PRIMARY KEY AUTOINCREMENT, record_id TEXT, date TEXT, batch_id TEXT,
        need_qty REAL);
    CREATE TABLE IF NOT EXISTS docs (
        id INTEGER PRIMARY KEY AUTOINCREMENT, record_id TEXT, date TEXT, employee TEXT,
        plan_docs REAL, fact_docs REAL);
    CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT);
    CREATE TABLE IF NOT EXISTS changes (
        id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL,
        section TEXT NOT NULL, action TEXT NOT NULL, record_id TEXT, details TEXT);
    ''')
    db.commit()


def list_rows(db, section):
    assert section in TABLES
    return [dict(row) for row in db.execute(f'SELECT * FROM {section} ORDER BY date, id')]


def normal_date(value):
    if value is None or value == '':
        return ''
    if isinstance(value, (float, int)):
        return (datetime(1899, 12, 30) + timedelta(days=float(value))).date().isoformat()
    value = str(value).strip()
    try:
        return date.fromisoformat(value[:10]).isoformat()
    except ValueError:
        return value


def normalize_payload(section, payload):
    if section not in TABLES or not isinstance(payload, dict):
        raise ValueError('Неизвестный раздел или неверный формат записи')
    data = {}
    for column in TABLES[section]:
        raw = payload.get(column)
        if column in NUMBER_FIELDS:
            if raw is None or str(raw).strip() == '':
                data[column] = None
            else:
                if isinstance(raw, bool):
                    raise ValueError(f'Поле {column} должно быть числом')
                try:
                    number = float(raw)
                except (TypeError, ValueError):
                    raise ValueError(f'Поле {column} должно быть числом')
                if not (-1e12 < number < 1e12):
                    raise ValueError(f'Поле {column}: недопустимое число')
                data[column] = number
        elif column == 'date':
            data[column] = normal_date(raw)
        else:
            data[column] = '' if raw is None else str(raw).strip()[:200]
    return data


def validate_rows(by_section):
    issues = {section: {} for section in TABLES}
    for section, rows in by_section.items():
        duplicated_ids = collections.Counter(str(r.get('record_id') or '').strip() for r in rows)
        batches = collections.Counter(str(r.get('batch_id') or '').strip() for r in rows) if section in ('prep', 'weld') else {}
        for row in rows:
            problems = []
            def problem(field, text, kind='error'):
                problems.append({'field': field, 'message': text, 'severity': kind})
            rid = str(row.get('record_id') or '').strip()
            if not rid:
                problem('record_id', 'Не указан ID записи')
            elif duplicated_ids[rid] > 1:
                problem('record_id', f'Дублирующийся ID {rid}: {duplicated_ids[rid]} записи')
            try:
                date.fromisoformat(str(row.get('date') or ''))
            except ValueError:
                problem('date', 'Дата не указана или записана с ошибкой')
            if section in ('prep', 'weld'):
                bid = str(row.get('batch_id') or '').strip()
                if not bid:
                    problem('batch_id', 'Не указан номер партии')
                elif batches[bid] > 1:
                    problem('batch_id', f'Дублирующийся номер партии {bid}')
            if section in ('prep', 'docs') and not str(row.get('employee') or '').strip():
                problem('employee', 'Не указан сотрудник')
            numeric = {'prep': ('plan_qty', 'fact_qty'), 'weld': ('need_qty',), 'docs': ('plan_docs', 'fact_docs')}[section]
            for field in numeric:
                n = row.get(field)
                if n is None:
                    problem(field, 'Нет значения')
                elif not isinstance(n, (int, float)) or n < 0 or int(n) != n:
                    problem(field, 'Нужно целое неотрицательное количество')
                elif field in ('plan_qty', 'plan_docs') and n == 0:
                    problem(field, 'План должен быть больше нуля')
            if section in ('prep', 'docs'):
                plan, fact = ('plan_qty','fact_qty') if section == 'prep' else ('plan_docs','fact_docs')
                p, f = row.get(plan), row.get(fact)
                if isinstance(p, (int, float)) and p > 0 and isinstance(f, (int, float)) and f > 3*p:
                    problem(fact, f'Факт {int(f)} превышает план {int(p)} более чем втрое: проверить источник', 'warning')
            issues[section][row['id']] = problems
    return issues


def is_clean(problems):
    return not problems


def within(row, start, end):
    dt = str(row.get('date') or '')
    return len(dt) == 10 and start <= dt <= end


def safe_ratio(a, b):
    return (a / b) if b else None


def overview(db, start='2026-10-05', end='2026-10-14'):
    all_rows = {section: list_rows(db, section) for section in TABLES}
    issues = validate_rows(all_rows)
    chosen = {section: [dict(row, issues=issues[section][row['id']],
                              verified=is_clean(issues[section][row['id']]))
                        for row in rows if within(row, start, end)]
              for section, rows in all_rows.items()}
    clean = {k: [r for r in chosen[k] if r['verified']] for k in TABLES}
    pplan = sum(r['plan_qty'] for r in clean['prep'])
    pfact = sum(r['fact_qty'] for r in clean['prep'])
    wneed = sum(r['need_qty'] for r in clean['weld'])
    dplan = sum(r['plan_docs'] for r in clean['docs'])
    dfact = sum(r['fact_docs'] for r in clean['docs'])
    by_batch_prep = collections.defaultdict(list)
    for r in chosen['prep']:
        by_batch_prep[r['batch_id']].append(r)
    linked = []
    for w in chosen['weld']:
        if not w['verified']:
            linked.append({'weld_id': w['id'], 'weld_record_id': w['record_id'], 'batch_id': w['batch_id'],
                           'date': w['date'], 'verified': False, 'reason': 'Ошибка записи сварки',
                           'need': w['need_qty'], 'prep_id': None, 'prep_fact': None,
                           'covered': None, 'shortage': None})
            continue
        matches = by_batch_prep.get(w['batch_id'], [])
        if len(matches) != 1 or not matches[0]['verified']:
            reason = 'Нет строки заготовки за период' if not matches else 'Ошибка или дубликат в заготовке'
            linked.append({'weld_id': w['id'], 'weld_record_id': w['record_id'], 'batch_id': w['batch_id'],
                           'date': w['date'], 'verified': False, 'reason': reason,
                           'need': w['need_qty'], 'prep_id': matches[0]['id'] if len(matches) == 1 else None,
                           'prep_fact': None, 'covered': None, 'shortage': None})
        else:
            p = matches[0]
            linked.append({'weld_id': w['id'], 'weld_record_id': w['record_id'], 'batch_id': w['batch_id'],
                           'date': w['date'], 'verified': True, 'reason': '',
                           'need': w['need_qty'], 'prep_id': p['id'], 'prep_fact': p['fact_qty'],
                           'covered': min(p['fact_qty'], w['need_qty']),
                           'shortage': max(0, w['need_qty'] - p['fact_qty'])})
    good_links = [link for link in linked if link['verified']]
    link_need = sum(link['need'] for link in good_links)
    link_covered = sum(link['covered'] for link in good_links)
    link_shortage = sum(link['shortage'] for link in good_links)
    bad_counts = {s: len(chosen[s]) - len(clean[s]) for s in TABLES}
    issue_list = []
    for section in TABLES:
        for row in chosen[section]:
            for issue in row['issues']:
                issue_list.append({'section': section, 'row_id': row['id'], 'record_id': row['record_id'],
                                   'date': row['date'], 'batch_id': row.get('batch_id', ''), **issue})
    for link in linked:
        if not link['verified']:
            issue_list.append({'section': 'link', 'row_id': link['weld_id'],
                               'record_id': link['weld_record_id'], 'date': link['date'],
                               'batch_id': link['batch_id'], 'field': 'batch_id',
                               'message': 'Обеспеченность сварки не рассчитана: ' + link['reason'],
                               'severity': 'blocked'})
    days = sorted(set(r['date'] for section in TABLES for r in chosen[section]))
    daily = []
    for day in days:
        pd = [r for r in clean['prep'] if r['date'] == day]
        wd = [r for r in clean['weld'] if r['date'] == day]
        dd = [r for r in clean['docs'] if r['date'] == day]
        valid_links_day = [link for link in good_links if link['date'] == day]
        daily.append({'date': day,
                      'prep_plan': sum(r['plan_qty'] for r in pd) if pd else None,
                      'prep_fact': sum(r['fact_qty'] for r in pd) if pd else None,
                      'weld_need': sum(r['need_qty'] for r in wd) if wd else None,
                      'docs_plan': sum(r['plan_docs'] for r in dd) if dd else None,
                      'docs_fact': sum(r['fact_docs'] for r in dd) if dd else None,
                      'weld_shortage': sum(link['shortage'] for link in valid_links_day) if valid_links_day else None,
                      'unverified_links': sum(link['date'] == day and not link['verified'] for link in linked)})
    return {
        'period': {'start': start, 'end': end},
        'records': chosen,
        'linked': linked,
        'issues': issue_list,
        'daily': daily,
        'metrics': {
            'prep': {'plan': pplan, 'fact': pfact, 'rate': safe_ratio(pfact, pplan),
                     'verified': len(clean['prep']), 'excluded': bad_counts['prep']},
            'weld': {'need': wneed, 'verified': len(clean['weld']), 'excluded': bad_counts['weld'],
                     'linked_need': link_need, 'linked_covered': link_covered,
                     'coverage': safe_ratio(link_covered, link_need), 'shortage': link_shortage,
                     'verified_links': len(good_links), 'unverified_links': len(linked)-len(good_links)},
            'docs': {'plan': dplan, 'fact': dfact, 'rate': safe_ratio(dfact, dplan),
                     'verified': len(clean['docs']), 'excluded': bad_counts['docs']},
        },
        'quality': {'bad_records': sum(bad_counts.values()), 'bad_by_section': bad_counts,
                    'unverified_links': len(linked) - len(good_links)},
    }


def add_log(db, section, action, record_id, details=''):
    db.execute('INSERT INTO changes (at, section, action, record_id, details) VALUES (?, ?, ?, ?, ?)',
               (datetime.now().astimezone().isoformat(timespec='seconds'), section, action, record_id, details))


def insert_record(db, section, data, action='created'):
    cols = TABLES[section]
    cursor = db.execute(f"INSERT INTO {section} ({', '.join(cols)}) VALUES ({', '.join(['?']*len(cols))})",
                        tuple(data[c] for c in cols))
    add_log(db, section, action, data.get('record_id', ''), f'id={cursor.lastrowid}')
    return cursor.lastrowid


def update_record(db, section, item_id, payload):
    current = db.execute(f'SELECT * FROM {section} WHERE id = ?', (item_id,)).fetchone()
    if current is None:
        raise LookupError('Запись не найдена')
    data = normalize_payload(section, payload)
    db.execute(f"UPDATE {section} SET {', '.join(c+'=?' for c in TABLES[section])} WHERE id=?",
               (*[data[c] for c in TABLES[section]], item_id))
    add_log(db, section, 'updated', data['record_id'], f'id={item_id}')


def delete_record(db, section, item_id):
    old = db.execute(f'SELECT record_id FROM {section} WHERE id=?', (item_id,)).fetchone()
    if old is None:
        raise LookupError('Запись не найдена')
    db.execute(f'DELETE FROM {section} WHERE id=?', (item_id,))
    add_log(db, section, 'deleted', old['record_id'], f'id={item_id}')


def parse_xlsx(blob, section):
    """Read first 'Данные' XLSX sheet using only stdlib (no Excel runtime)."""
    if len(blob) > 5_000_000:
        raise ValueError('Один файл Excel не должен превышать 5 МБ')
    try:
        archive = ZipFile(BytesIO(blob))
    except BadZipFile:
        raise ValueError('Файл не является корректным XLSX')
    with archive as zipfile:
        main = '{' + NAMESPACES['main'] + '}'
        rel = '{' + NAMESPACES['rel'] + '}'
        pkg = '{' + NAMESPACES['pkg'] + '}'
        workbook = ET.fromstring(zipfile.read('xl/workbook.xml'))
        sheets = workbook.find(main+'sheets')
        sheet_ref = next((s for s in sheets if s.attrib.get('name') == 'Данные'), None)
        if sheet_ref is None:
            raise ValueError('В файле отсутствует лист «Данные»')
        relationship_id = sheet_ref.attrib.get(rel+'id')
        relationships = ET.fromstring(zipfile.read('xl/_rels/workbook.xml.rels'))
        target = next((r.attrib.get('Target') for r in relationships if r.attrib.get('Id') == relationship_id), None)
        if not target:
            raise ValueError('Не найден лист данных в XLSX')
        path = target.lstrip('/') if target.startswith('/') else posixpath.normpath(posixpath.join('xl', target))
        raw = ET.fromstring(zipfile.read(path))
        shared = []
        if 'xl/sharedStrings.xml' in zipfile.namelist():
            shared_xml = ET.fromstring(zipfile.read('xl/sharedStrings.xml'))
            for s in shared_xml.findall(main+'si'):
                shared.append(''.join(n.text or '' for n in s.iter(main+'t')))
        matrix = []
        for r in raw.iter(main+'row'):
            cells = {}
            for cell in r.findall(main+'c'):
                ref = cell.attrib.get('r', '')
                letters = re.match(r'([A-Z]+)', ref)
                if not letters:
                    continue
                ix = 0
                for char in letters.group(1):
                    ix = ix*26 + ord(char)-64
                ix -= 1
                value_tag = cell.find(main+'v')
                ctype = cell.attrib.get('t')
                if ctype == 'inlineStr':
                    value = ''.join(n.text or '' for n in cell.iter(main+'t'))
                elif value_tag is None or value_tag.text is None:
                    value = None
                elif ctype == 's':
                    value = shared[int(value_tag.text)]
                elif ctype in ('str', 'e', 'b'):
                    value = value_tag.text
                else:
                    try:
                        value = float(value_tag.text)
                    except ValueError:
                        value = value_tag.text
                cells[ix] = value
            if cells:
                matrix.append([cells.get(i) for i in range(max(cells)+1)])
        if not matrix:
            raise ValueError('Лист «Данные» пуст')
        headers = [str(s or '').strip() for s in matrix[0]]
        missing = set(TABLES[section]) - set(headers)
        if missing:
            raise ValueError(f'В {LABELS[section]} не хватает колонок: {", ".join(sorted(missing))}')
        records = []
        for values in matrix[1:]:
            if all(v is None or str(v).strip() == '' for v in values):
                continue
            raw_record = {key: (values[headers.index(key)] if headers.index(key) < len(values) else None)
                          for key in TABLES[section]}
            records.append(normalize_payload(section, raw_record))
        if not records:
            raise ValueError(f'В {LABELS[section]} нет записей')
        return records


def import_all(db, file_bytes):
    if set(file_bytes) != set(TABLES):
        raise ValueError('Нужно загрузить все три файла')
    parsed = {section: parse_xlsx(file_bytes[section], section) for section in TABLES}
    with db:
        for section in TABLES:
            db.execute(f'DELETE FROM {section}')
            for entry in parsed[section]:
                insert_record(db, section, entry, action='imported')
        db.execute('INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)',
                   ('imported_at', datetime.now().astimezone().isoformat(timespec='seconds')))
    return {section: len(rows) for section, rows in parsed.items()}


def create_csv(report):
    stream = StringIO()
    writer = csv.writer(stream, delimiter=';', lineterminator='\r\n')
    m = report['metrics']
    writer.writerow(['ОТЧЁТ РУКОВОДИТЕЛЯ', report['period']['start'], report['period']['end']])
    writer.writerow(['Участок', 'Показатель', 'Значение', 'Комментарий'])
    for row in [
        ['Заготовка', 'План, подтверждённый', m['prep']['plan'], f'Исключено строк: {m["prep"]["excluded"]}'],
        ['Заготовка', 'Факт, подтверждённый', m['prep']['fact'], 'Только валидные записи'],
        ['Заготовка', 'Выполнение', m['prep']['rate'] if m['prep']['rate'] is not None else '', 'Доля: факт / план'],
        ['Сварка', 'Потребность, подтверждённая', m['weld']['need'], 'Потребность отдельного участка'],
        ['Сварка', 'Покрытие подтверждённых связей', m['weld']['coverage'] if m['weld']['coverage'] is not None else '',
         f'Подтверждено партий: {m["weld"]["verified_links"]}; непроверено: {m["weld"]["unverified_links"]}'],
        ['Сварка', 'Дефицит по подтверждённым партиям', m['weld']['shortage'], 'Не включает непроверенные партии'],
        ['Документация', 'План, подтверждённый', m['docs']['plan'], 'Независимый участок'],
        ['Документация', 'Факт, подтверждённый', m['docs']['fact'], 'Независимый участок'],
        ['Документация', 'Выполнение', m['docs']['rate'] if m['docs']['rate'] is not None else '', 'Доля: факт / план'],
    ]:
        writer.writerow(row)
    writer.writerow([])
    writer.writerow(['ИСТОЧНИКИ: строки, вошедшие в период'])
    writer.writerow(['Участок', 'Дата', 'ID', 'Партия', 'Сотрудник', 'План', 'Факт / потребность', 'Статус', 'Причина'])
    for section in TABLES:
        for row in report['records'][section]:
            plan = row.get('plan_qty', row.get('plan_docs', ''))
            fact = row.get('fact_qty', row.get('need_qty', row.get('fact_docs', '')))
            writer.writerow([LABELS[section], row['date'], row['record_id'], row.get('batch_id',''),
                             row.get('employee',''), plan, fact,
                             'Подтверждено' if row['verified'] else 'Исключено',
                             ' | '.join(problem['message'] for problem in row['issues'])])
    writer.writerow([])
    writer.writerow(['СВЯЗЬ ЗАГОТОВКА → СВАРКА'])
    writer.writerow(['Дата сварки', 'Партия', 'Потребность', 'Факт заготовки', 'Покрыто', 'Дефицит', 'Статус'])
    for link in report['linked']:
        writer.writerow([link['date'], link['batch_id'], link['need'],
                         link['prep_fact'] if link['verified'] else '',
                         link['covered'] if link['verified'] else '',
                         link['shortage'] if link['verified'] else '',
                         'Подтверждено' if link['verified'] else 'Непроверено: '+link['reason']])
    return '\ufeff' + stream.getvalue()


class HTTPHandler(BaseHTTPRequestHandler):
    server_version = 'OpsDesk/1.0'
    def log_message(self, fmt, *args):
        print('%s - %s' % (self.address_string(), fmt % args), file=sys.stderr)

    def json_response(self, status, obj):
        data = json.dumps(obj, ensure_ascii=False, allow_nan=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def body(self):
        size = int(self.headers.get('Content-Length', '0'))
        if size > 24_000_000:
            raise ValueError('Превышен размер запроса (24 МБ)')
        if size <= 0:
            raise ValueError('Пустой запрос')
        return json.loads(self.rfile.read(size).decode('utf-8'))

    def do_GET(self):
        parsed = urlparse(self.path)
        route = parsed.path
        if route.startswith('/api/'):
            try:
                params = parse_qs(parsed.query)
                start = params.get('start', ['2026-10-05'])[0]
                end = params.get('end', ['2026-10-14'])[0]
                if start > end or not all(re.fullmatch(r'\d{4}-\d\d-\d\d', d) for d in (start, end)):
                    raise ValueError('Некорректный период')
                with db_connect() as db:
                    init_db(db)
                    report = overview(db, start, end)
                    if route == '/api/state':
                        imported = db.execute("SELECT value FROM metadata WHERE key='imported_at'").fetchone()
                        report['imported_at'] = imported['value'] if imported else None
                        self.json_response(200, report)
                    elif route == '/api/export':
                        content = create_csv(report).encode('utf-8')
                        self.send_response(200)
                        self.send_header('Content-Type', 'text/csv; charset=utf-8')
                        self.send_header('Content-Disposition', f'attachment; filename="operations_{start}_{end}.csv"')
                        self.send_header('Content-Length', str(len(content)))
                        self.end_headers()
                        self.wfile.write(content)
                    else:
                        self.json_response(404, {'error': 'Адрес не найден'})
            except (ValueError, sqlite3.Error) as exc:
                self.json_response(400, {'error': str(exc)})
            return
        if route == '/':
            route = '/index.html'
        static = (ROOT / 'static' / route.lstrip('/')).resolve()
        if ROOT / 'static' not in static.parents or not static.is_file():
            self.send_error(404)
            return
        mime = {'html': 'text/html; charset=utf-8', 'css':'text/css; charset=utf-8',
                'js':'application/javascript; charset=utf-8', 'svg':'image/svg+xml'}.get(static.suffix.lstrip('.'), 'application/octet-stream')
        content = static.read_bytes()
        self.send_response(200)
        self.send_header('Content-Type', mime)
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def do_POST(self):
        self.modify('POST')

    def do_PATCH(self):
        self.modify('PATCH')

    def do_DELETE(self):
        self.modify('DELETE')

    def modify(self, method):
        try:
            route = urlparse(self.path).path
            if route == '/api/import' and method == 'POST':
                data = self.body()
                if not isinstance(data, dict) or not isinstance(data.get('files'), dict):
                    raise ValueError('Нужно передать три Excel-файла')
                decoded = {}
                for key in TABLES:
                    encoded = data['files'].get(key)
                    if not isinstance(encoded, str):
                        raise ValueError(f'Не выбран файл: {LABELS[key]}')
                    decoded[key] = base64.b64decode(encoded, validate=True)
                with db_connect() as db:
                    init_db(db)
                    counts = import_all(db, decoded)
                self.json_response(200, {'ok': True, 'counts': counts})
                return
            match = re.fullmatch(r'/api/records/(prep|weld|docs)(?:/(\d+))?', route)
            if not match:
                self.json_response(404, {'error': 'Адрес не найден'})
                return
            section = match.group(1)
            item_id = int(match.group(2)) if match.group(2) else None
            with db_connect() as db:
                init_db(db)
                if method == 'POST' and item_id is None:
                    payload = normalize_payload(section, self.body())
                    created_id = insert_record(db, section, payload)
                    db.commit()
                    self.json_response(201, {'ok':True,'id':created_id})
                elif method == 'PATCH' and item_id:
                    update_record(db, section, item_id, self.body())
                    db.commit()
                    self.json_response(200, {'ok':True})
                elif method == 'DELETE' and item_id:
                    delete_record(db, section, item_id)
                    db.commit()
                    self.json_response(200, {'ok':True})
                else:
                    self.json_response(405, {'error': 'Метод не поддерживается'})
        except (ValueError, KeyError, LookupError, sqlite3.Error) as exc:
            self.json_response(400 if not isinstance(exc, LookupError) else 404, {'error': str(exc)})


def bootstrap_demo(db):
    """Import bundled example workbooks only on first launch of a new database."""
    initialized = db.execute("SELECT value FROM metadata WHERE key = 'bootstrap_done'").fetchone()
    if initialized:
        return False
    # Never overwrite pre-existing rows, including datasets that were manually created.
    has_rows = any(db.execute(f'SELECT 1 FROM {section} LIMIT 1').fetchone() for section in TABLES)
    if not has_rows:
        examples = ROOT / 'examples'
        filenames = {
            'prep': '01_Заготовка.xlsx',
            'weld': '02_Потребность_сварки.xlsx',
            'docs': '03_Документация.xlsx',
        }
        if all((examples / filename).is_file() for filename in filenames.values()):
            payload = {section: (examples / filename).read_bytes()
                       for section, filename in filenames.items()}
            import_all(db, payload)
    db.execute("INSERT INTO metadata(key, value) VALUES('bootstrap_done', '1')")
    db.commit()
    return True


def main():
    with db_connect() as db:
        init_db(db)
        bootstrap_demo(db)
    host = os.getenv('OPS_HOST', '127.0.0.1')
    port = int(os.getenv('OPS_PORT', '8765'))
    server = ThreadingHTTPServer((host, port), HTTPHandler)
    print(f'Ops Desk → http://{host}:{port}', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
