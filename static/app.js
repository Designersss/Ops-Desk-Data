(() => {
  'use strict';
  const $ = (sel) => document.querySelector(sel);
  const app = $('#app');
  const config = {
    prep: {title:'Заготовка', desc:'Фактический выпуск по партиям. Данные участвуют в расчёте обеспеченности сварки.', fields:[['record_id','ID записи','text'], ['date','Дата','date'], ['batch_id','Партия','text'], ['employee','Сотрудник','text'], ['plan_qty','План, шт.','number'], ['fact_qty','Факт, шт.','number']]},
    weld: {title:'Потребность сварки', desc:'Плановая потребность сварочного участка по партиям. Обеспеченность зависит от подтверждённого факта заготовки.', fields:[['record_id','ID записи','text'], ['date','Дата','date'], ['batch_id','Партия','text'], ['need_qty','Потребность, шт.','number']]},
    docs: {title:'Документация', desc:'План и факт оформления документов. Независимый участок, на расчёты сварки не влияет.', fields:[['record_id','ID записи','text'], ['date','Дата','date'], ['employee','Сотрудник','text'], ['plan_docs','План, док.','number'], ['fact_docs','Факт, док.','number']]}
  };
  let state = null, view = (location.hash || '#overview').slice(1), editContext = null;
  let toastTimer;
  const escapeHtml = (v) => String(v === null || v === undefined ? '' : v).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const num = (v) => v === null || v === undefined ? '—' : new Intl.NumberFormat('ru-RU', {maximumFractionDigits: 1}).format(v);
  const pct = (v) => v === null || v === undefined ? '—' : new Intl.NumberFormat('ru-RU', {style:'percent', maximumFractionDigits:1}).format(v);
  const fmtDate = (s) => s ? `${s.slice(8,10)}.${s.slice(5,7)}.${s.slice(0,4)}` : '—';
  const dateLabel = (s) => s ? `${s.slice(8,10)}.${s.slice(5,7)}` : '—';
  const value = (r,k) => num(r[k]);
  const periodParams = () => new URLSearchParams({start:$('#date-from').value,end:$('#date-to').value}).toString();

  async function request(path, options={}) {
    const response = await fetch(path, {cache:'no-store', ...options});
    const json = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(json.error || `Ошибка запроса: ${response.status}`);
    return json;
  }
  async function refresh() {
    try {
      state = await request('/api/state?' + periodParams());
      render();
    } catch (err) {
      app.innerHTML = `<div class="notice warning"><span class="notice-icon">!</span><div><h3>Ошибка загрузки</h3><p>${escapeHtml(err.message)}</p></div></div>`;
      showToast(err.message);
    }
  }
  function showToast(text) {
    const toast = $('#toast'); toast.textContent=text; toast.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 3600);
  }
  function go(name) {
    view = ['overview','prep','weld','docs','quality','import'].includes(name) ? name : 'overview';
    if (location.hash !== '#'+view) history.replaceState(null,'','#'+view);
    render();
    window.scrollTo({top:0,behavior:'smooth'});
  }
  function badge(ok, issues) {
    if(ok) return '<span class="pill ok">✓ Подтверждено</span>';
    const warning = issues && issues.every(i => i.severity==='warning');
    return `<span class="pill ${warning?'warn':'bad'}">${warning?'! Проверить':'× Ошибка'}</span>`;
  }
  function header(kicker, title, desc, extra='') {
    return `<div class="page-heading"><div><div class="eyebrow">${kicker}</div><h1>${title}</h1><p class="subheading">${desc}</p></div>${extra}</div>`;
  }
  function boxTitle(title, desc='', extra='') {
    return `<div class="panel-header"><div><h2>${title}</h2>${desc ? `<p class="panel-description">${desc}</p>`:''}</div>${extra}</div>`;
  }
  function stat(title, total, detail, symbol) {
    return `<div class="kpi"><div class="kpi-top"><span>${title}</span><span class="kpi-symbol">${symbol}</span></div><div class="kpi-num mono">${total}</div><div class="kpi-sub">${detail}</div></div>`;
  }
  function svgChart(rows, keys, colors, title) {
    if (!rows.length) return '<div class="empty">За выбранный период нет данных</div>';
    const W=740,H=226,L=39,R=14,T=22,B=36, PW=W-L-R,PH=H-T-B;
    const maximum=Math.max(1,...rows.flatMap(r=>keys.map(k=>r[k]===null?0:Number(r[k]||0))));
    const ceiling=Math.ceil(maximum / (maximum>100?50:maximum>20?10:5)) * (maximum>100?50:maximum>20?10:5) || 1;
    const coord=(v,i)=>({x:L+(rows.length===1 ? PW/2 : PW*i/(rows.length-1)), y:T+PH*(1-v/ceiling)});
    let lines = '';
    for(let i=0;i<=4;i++){
      const y=T+i*PH/4, val=ceiling*(1-i/4);
      lines+=`<line x1="${L}" x2="${W-R}" y1="${y}" y2="${y}" stroke="#edf1f2" stroke-width="1"/><text x="${L-8}" y="${y+4}" text-anchor="end" font-size="10" fill="#9ba8ad">${num(val)}</text>`;
    }
    rows.forEach((r,i)=>{const pt=coord(0,i);lines+=`<text x="${pt.x}" y="${H-10}" text-anchor="middle" font-size="10" fill="#97a5ab">${escapeHtml(dateLabel(r.date))}</text>`});
    keys.forEach((key,series)=>{
      const color=colors[series];let prev=false;
      const path=rows.map((r,i)=>{if(r[key]===null){prev=false;return '';}
        const pt=coord(Number(r[key]),i),command=prev?'L':'M';prev=true;
        return `${command}${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
      }).join(' ');
      lines+=`<path d="${path}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;
      rows.forEach((r,i)=>{if(r[key]===null)return;const pt=coord(Number(r[key]),i); lines+=`<circle cx="${pt.x}" cy="${pt.y}" r="4" fill="#fff" stroke="${color}" stroke-width="2"><title>${escapeHtml(title[series])}: ${num(r[key])} (${fmtDate(r.date)})</title></circle>`;});
    });
    const legend=keys.map((k,i)=>`<span><i class="legend-dot" style="background:${colors[i]}"></i>${title[i]}</span>`).join('');
    return `<div class="chart-legend">${legend}</div><svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="График: ${escapeHtml(title.join(', '))}">${lines}</svg>`;
  }
  function table(headers, body, cls='') {
    return `<div class="table-wrap ${cls}"><table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${body || `<tr><td colspan="${headers.length}"><div class="empty">Нет записей за выбранный период</div></td></tr>`}</tbody></table></div>`;
  }

  function overviewPage() {
    const m=state.metrics, quality=state.quality;
    const warn=quality.bad_records||quality.unverified_links;
    const announce=warn ? `<div class="notice warning"><div class="notice-icon">!</div><div><h3>Есть данные, требующие проверки</h3><p>${quality.bad_records} проблемных записей · ${quality.unverified_links} непроверенных связей «Заготовка → Сварка». Ошибочные значения не включены в подтверждённые расчёты.</p></div><button class="text-link" data-nav="quality">Открыть контроль качества →</button></div>` : `<div class="notice"><div class="notice-icon" style="background:#e8f7f1;color:#23806e">✓</div><div><h3>Данные проверены</h3><p>Ошибок в выбранном периоде не обнаружено.</p></div></div>`;
    const cards=`<div class="grid-kpi">
      ${stat('Заготовка · выполнение',pct(m.prep.rate),`Факт <strong>${num(m.prep.fact)}</strong> / план <strong>${num(m.prep.plan)}</strong> · исключено ${m.prep.excluded} строк`,'▤')}
      ${stat('Сварка · потребность',num(m.weld.need),`Подтверждённые записи: <strong>${m.weld.verified}</strong> · исключено ${m.weld.excluded}`,'⌁')}
      ${stat('Обеспеченность сварки',pct(m.weld.coverage),`Проверено <strong>${m.weld.verified_links}</strong> из <strong>${state.linked.length}</strong> партий · дефицит ${num(m.weld.shortage)}`,'↗')}
      ${stat('Документация · выполнение',pct(m.docs.rate),`Факт <strong>${num(m.docs.fact)}</strong> / план <strong>${num(m.docs.plan)}</strong> · исключено ${m.docs.excluded} строк`,'▧')}
    </div>`;
    const charts=`<div class="two-cols">
      <section class="panel">${boxTitle('Выпуск заготовки','План и факт по подтверждённым записям; ошибочные строки исключены')}${svgChart(state.daily,['prep_plan','prep_fact'],['#a2bdc0','#237c71'],['План','Факт'])}</section>
      <section class="panel">${boxTitle('Документация','Независимый участок — план и факт по датам')}${svgChart(state.daily,['docs_plan','docs_fact'],['#c8d2dd','#647b9b'],['План','Факт'])}</section>
    </div>`;
    const daily=state.daily.map(r=>`<tr><td class="strong mono">${fmtDate(r.date)}</td><td class="mono">${num(r.prep_plan)}</td><td class="mono">${num(r.prep_fact)}</td><td class="mono">${num(r.weld_need)}</td><td class="mono">${num(r.weld_shortage)} ${r.unverified_links?`<span class="pill warn" title="Непроверенные связи отсутствуют в этом дефиците">+ ${r.unverified_links} непровер.</span>`:''}</td><td class="mono">${num(r.docs_plan)}</td><td class="mono">${num(r.docs_fact)}</td><td><button class="action-link" data-action="drill" data-date="${r.date}">Записи →</button></td></tr>`).join('');
    const linked=state.linked.map(r=>`<tr><td class="strong">${escapeHtml(r.batch_id)}</td><td class="mono">${num(r.need)}</td><td class="mono">${r.verified?num(r.prep_fact):'—'}</td><td class="mono">${r.verified?num(r.covered):'—'}</td><td class="mono">${r.verified?num(r.shortage):'—'}</td><td>${r.verified?badge(true):`<span class="pill blocked" title="${escapeHtml(r.reason)}">Не проверено</span>`}</td><td><button class="action-link" data-action="link-detail" data-batch="${escapeHtml(r.batch_id)}">Источники →</button></td></tr>`).join('');
    return header('СВОДНЫЙ ОБЗОР', 'Панель руководителя','Оперативная картина по трём участкам. Для связанных расчётов используются только подтверждённые исходные данные.') + announce + cards + charts
      + `<section class="panel">${boxTitle('Сводка по дням','Кликните «Записи», чтобы увидеть первичные строки и перейти к исправлению',`<span class="panel-label">${state.daily.length} дат</span>`)}${table(['Дата','План заготовки','Факт заготовки','Потребность сварки','Дефицит*','План документов','Факт документов','Детали'],daily)}<p class="minor" style="margin-bottom:0">* Дефицит показан только для подтверждённых пар партий. Непроверенные партии не включены и помечены отдельно. «—» означает отсутствие подтверждённых данных, а не ноль.</p></section>`
      + `<section class="panel">${boxTitle('Откуда берётся обеспеченность сварки','Сопоставление по номеру партии; для непроверенных связей цифры факта, покрытия и дефицита скрыты',`<span class="linked-summary"><b>${num(m.weld.linked_covered)} / ${num(m.weld.linked_need)}</b> ед. покрыто</span>`)}${table(['Партия','Потребность','Факт заготовки','Покрыто','Дефицит','Качество связи','Детали'],linked)}</section>`;
  }
  function rowHint(row) {
    return !row.issues.length ? 'Нет замечаний' : row.issues.map(i=>i.message).join(' · ');
  }
  function sectionPage(section) {
    const c=config[section], list=state.records[section];
    const invalid=list.filter(r=>!r.verified).length, verified=list.length-invalid;
    const hint = section === 'prep' ? 'План и факт суммируются только по подтверждённым записям. Факт по партии передаётся в расчёт обеспеченности сварки лишь после проверки.' : section==='weld' ? 'Потребность — собственный показатель участка. Для расчёта обеспеченности используется факт заготовки той же партии. При ошибке источника связь помечается как непроверенная.' : 'Документация рассчитывается отдельно от заготовки и сварки, поэтому изменение данных других участков её не затрагивает.';
    const head=header('РАБОЧЕЕ МЕСТО',c.title,c.desc,`<button class="button button-primary" data-action="add" data-section="${section}">+ Добавить запись</button>`);
    const stats=`<div class="section-stats"><div class="small-stat"><b>${list.length}</b> записей</div><div class="small-stat"><b>${verified}</b> подтверждено</div><div class="small-stat"><b>${invalid}</b> требуют проверки</div></div><div class="section-explain">${hint}</div>`;
    const cols=[...c.fields.map(([name,title])=>title),'Качество','Действия'];
    const rows=list.map(r=>{
      const cells=c.fields.map(([key,title,type])=>`<td class="${key==='record_id'?'strong ':''} ${type==='number'?'mono':''}">${key==='date'?fmtDate(r[key]):type==='number'?value(r,key):escapeHtml(r[key])||'<span class="muted">нет значения</span>'}</td>`).join('');
      return `<tr title="${escapeHtml(rowHint(r))}">${cells}<td>${badge(r.verified,r.issues)} ${!r.verified?`<span class="minor" style="display:block;max-width:250px;white-space:normal;margin-top:4px">${escapeHtml(rowHint(r))}</span>`:''}</td><td><div class="small-actions"><button class="action-link" data-action="edit" data-section="${section}" data-id="${r.id}">Изменить</button><button class="action-link" data-action="delete" data-section="${section}" data-id="${r.id}" style="color:#ad6765">Удалить</button></div></td></tr>`;
    }).join('');
    let summary='';
    if(section==='prep') summary=`Факт: <b>${num(state.metrics.prep.fact)}</b> / план: <b>${num(state.metrics.prep.plan)}</b> · выполнение <b>${pct(state.metrics.prep.rate)}</b>`;
    if(section==='weld') summary=`Потребность: <b>${num(state.metrics.weld.need)}</b> · обеспеченность подтверждённых партий <b>${pct(state.metrics.weld.coverage)}</b>`;
    if(section==='docs') summary=`Факт: <b>${num(state.metrics.docs.fact)}</b> / план: <b>${num(state.metrics.docs.plan)}</b> · выполнение <b>${pct(state.metrics.docs.rate)}</b>`;
    return head + stats + `<section class="panel">${boxTitle('Рабочие записи','Изменение строки сразу влияет на расчёты и отчёт',`<span class="panel-label">${summary}</span>`)}${table(cols,rows)}</section>`;
  }
  function qualityPage() {
    const list=state.issues, q=state.quality;
    const byType=[['Заготовка',q.bad_by_section.prep],['Потребность сварки',q.bad_by_section.weld],['Документация',q.bad_by_section.docs]];
    const blocks=byType.map(([n,v])=>`<div class="quality-card"><small>${n} · проблемные записи</small><b>${v}</b></div>`).join('');
    const rows=list.map(r=>{
      const section=r.section === 'link' ? 'Сопоставление партий' : config[r.section].title;
      const target=r.section === 'link' ? 'prep' : r.section;
      const label=r.section === 'link'?'Проверить заготовку':'Исправить';
      return `<tr><td class="strong">${escapeHtml(section)}</td><td class="mono">${fmtDate(r.date)}</td><td class="strong">${escapeHtml(r.record_id)}</td><td>${escapeHtml(r.batch_id||'—')}</td><td><span class="pill ${r.severity==='blocked'?'blocked':r.severity==='warning'?'warn':'bad'}">${r.severity==='blocked'?'Связь':r.severity==='warning'?'Проверить':'Ошибка'}</span></td><td class="issue-message">${escapeHtml(r.message)}</td><td><button class="action-link" data-action="quality-fix" data-section="${target}" data-id="${r.section==='link'?'':r.row_id}" data-batch="${escapeHtml(r.batch_id||'')}">${label} →</button></td></tr>`;
    }).join('');
    return header('DATA QUALITY', 'Контроль качества данных', 'Проблемы видны директору и сотрудникам. Пока источник не исправлен, связанный результат не считается достоверным.')
      + `<div class="quality-card-grid">${blocks}</div>`
      + `<div class="section-explain">Проверки: пропуски, отрицательные и дробные значения, дубли ID или партии, некорректная дата, факт более 300% плана (эвристика для ручной проверки). При любой проблеме запись исключается из подтверждённой суммы. Для сварки заблокирована только связка с проблемной заготовкой; собственная подтверждённая потребность остаётся доступной.</div>`
      + `<section class="panel">${boxTitle('Замечания и непроверенные связи',`${q.bad_records} проблемных записей · ${q.unverified_links} связей без подтверждения`)}${table(['Участок','Дата','ID','Партия','Статус','Проблема','Действие'],rows,'issues-list')}</section>`;
  }
  function importPage() {
    const stamp=state.imported_at ? new Date(state.imported_at).toLocaleString('ru-RU') : 'Импорт ещё не выполнялся';
    return header('ИМПОРТ И ХРАНЕНИЕ', 'Загрузка Excel-файлов', 'Выберите по одному файлу для каждого участка. Система сохранит данные в SQLite и больше не будет читать исходные XLSX.')
      + `<div class="import-note"><b>Как работает:</b> все три файла сначала проверяются на структуру, затем одним действием заменяют текущие данные в базе. Ошибочные строки сохраняются с отметкой проверки. После импорта удалите XLSX-файлы из папки examples — таблицы, исправления и отчёт продолжат работать. <br><b>Последняя загрузка:</b> ${escapeHtml(stamp)}.</div>`
      + `<div class="import-box"><div class="upload-row"><label for="upload-prep">01 · Заготовка</label><input type="file" id="upload-prep" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" /></div>
      <div class="upload-row"><label for="upload-weld">02 · Потребность сварки</label><input type="file" id="upload-weld" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" /></div>
      <div class="upload-row"><label for="upload-docs">03 · Документация</label><input type="file" id="upload-docs" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" /></div>
      <div class="import-action"><button class="button button-primary" data-action="import">Импортировать три файла</button><small>Важно: импорт заменяет текущие записи. Для обычных исправлений используйте рабочие разделы.</small></div></div>`;
  }
  function detailPage(day=null,batch=null) {
    const selected={};
    for(const s in config) selected[s]=state.records[s].filter(r=>day?r.date===day:batch?r.batch_id===batch:false);
    const pieces=[];
    for(const s of ['prep','weld','docs']) {
      if(batch && s==='docs') continue;
      const cols=config[s].fields;
      const rows=selected[s].map(r=>`<tr>${cols.map(([f,_,t])=>`<td>${f==='date'?fmtDate(r[f]):t==='number'?num(r[f]):escapeHtml(r[f])}</td>`).join('')}<td>${badge(r.verified,r.issues)}</td><td><button class="action-link" data-action="edit" data-section="${s}" data-id="${r.id}">Изменить</button></td></tr>`).join('');
      pieces.push(`<section class="panel">${boxTitle(config[s].title,`${selected[s].length} первичных записей`)}${table([...cols.map(x=>x[1]),'Статус','Действие'],rows)}</section>`);
    }
    return header('ДЕТАЛИ РАСЧЁТА', day ? `Первичные записи · ${fmtDate(day)}` : `Партия ${escapeHtml(batch)}`, 'Это исходные строки в базе данных, из которых построены показатели. Их можно исправить прямо отсюда.',`<button class="button button-secondary" data-action="back">← К сводке</button>`) + pieces.join('');
  }
  let details = null;
  function render() {
    if(!state) return;
    document.querySelectorAll('[data-nav]').forEach(el=>el.classList.toggle('active',el.getAttribute('data-nav')===view));
    const n=state.quality.bad_records + state.quality.unverified_links;
    $('#sidebar-alert').textContent=n||'';
    $('#sidebar-alert').style.display=n?'':'none';
    if(view==='overview') app.innerHTML=overviewPage();
    else if(config[view]) app.innerHTML=sectionPage(view);
    else if(view==='quality') app.innerHTML=qualityPage();
    else if(view==='import') app.innerHTML=importPage();
    else if(view==='details' && details) app.innerHTML=detailPage(details.day,details.batch);
    else {view='overview';app.innerHTML=overviewPage();}
  }
  function editor(section,id=null) {
    const entry=id===null?null:state.records[section].find(r=>r.id===Number(id));
    if(id!==null&&!entry) {go(section);showToast('Запись не найдена в выбранном периоде');return;}
    editContext={section,id:entry?entry.id:null};
    $('#editor-title').textContent=entry?`Изменить ${entry.record_id}`:`Новая запись · ${config[section].title}`;
    $('#editor-error').classList.add('hidden');
    $('#editor-fields').innerHTML=config[section].fields.map(([field,label,type])=>{
      const val=entry?entry[field]:(field==='date'?$('#date-to').value:'');
      const attrs=type==='number'?'step="1" inputmode="numeric"':'';
      return `<div class="form-field ${field==='employee'?'wide':''}"><label for="field-${field}">${escapeHtml(label)}</label><input id="field-${field}" name="${field}" type="${type}" ${attrs} value="${escapeHtml(val??'')}" placeholder="${escapeHtml(label)}" /></div>`;
    }).join('');
    $('#editor-modal').showModal();
  }
  function closeEditor(){$('#editor-modal').close();editContext=null;}
  async function saveEditor(event){
    event.preventDefault();if(!editContext)return;
    const {section,id}=editContext;
    const fields={};
    for(const [field,_,type] of config[section].fields){let v=$('#field-'+field).value;fields[field]=type==='number'?(v===''?null:Number(v)):v;}
    const error=$('#editor-error');error.classList.add('hidden');
    try{
      const endpoint='/api/records/'+section+(id!==null?'/'+id:'');
      await request(endpoint,{method:id!==null?'PATCH':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(fields)});
      closeEditor();await refresh();showToast('Запись сохранена · показатели пересчитаны');
    } catch(err){error.classList.remove('hidden');error.textContent=err.message;}
  }
  async function removeRecord(section,id){
    const entry=state.records[section].find(r=>r.id===Number(id));
    if(!entry||!window.confirm(`Удалить запись ${entry.record_id}? Изменение сохранится в базе данных.`))return;
    try{await request('/api/records/'+section+'/'+id,{method:'DELETE'});await refresh();showToast('Запись удалена · показатели пересчитаны');}
    catch(err){showToast(err.message);}
  }
  async function importExcel() {
    const files={};
    for(const key of ['prep','weld','docs']){
      const input=$('#upload-'+key);
      if(!input.files.length){showToast('Выберите все три Excel-файла');return;}
      files[key]=input.files[0];
      if(!files[key].name.toLowerCase().endsWith('.xlsx')||files[key].size>5_000_000){showToast('Нужны файлы .xlsx до 5 МБ каждый');return;}
    }
    if(!window.confirm('Новая загрузка заменит текущие записи и внесённые исправления. Продолжить?'))return;
    try {
      const payload={files:{}};
      for(const key of Object.keys(files)){
        const bytes=new Uint8Array(await files[key].arrayBuffer());
        let chars=''; const chunk=8192;
        for(let i=0;i<bytes.length;i+=chunk)chars+=String.fromCharCode(...bytes.subarray(i,i+chunk));
        payload.files[key]=btoa(chars);
      }
      const result=await request('/api/import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      go('overview');await refresh();showToast(`Импорт завершён: ${Object.values(result.counts).reduce((a,b)=>a+b,0)} записей`);
    } catch(err){showToast('Импорт не выполнен: '+err.message);}
  }
  document.addEventListener('click', async event=>{
    const el=event.target.closest('[data-action],[data-nav]');if(!el)return;
    if(el.hasAttribute('data-nav')){event.preventDefault();details=null;go(el.dataset.nav);return;}
    const action=el.dataset.action;
    if(action==='period'){
      if($('#date-from').value>$('#date-to').value){showToast('Дата начала позже даты конца');return;}
      await refresh();return;
    }
    if(action==='export'){
      const anchor=document.createElement('a');anchor.href='/api/export?'+periodParams();anchor.download='operations.csv';document.body.append(anchor);anchor.click();anchor.remove();showToast('Отчёт CSV сформирован');return;
    }
    if(action==='add'){editor(el.dataset.section);return;}
    if(action==='edit'){editor(el.dataset.section,el.dataset.id);return;}
    if(action==='delete'){await removeRecord(el.dataset.section,el.dataset.id);return;}
    if(action==='close-editor'){closeEditor();return;}
    if(action==='import'){await importExcel();return;}
    if(action==='back'){details=null;go('overview');return;}
    if(action==='drill'){details={day:el.dataset.date,batch:null};view='details';render();window.scrollTo({top:0,behavior:'smooth'});return;}
    if(action==='link-detail'){details={day:null,batch:el.dataset.batch};view='details';render();window.scrollTo({top:0,behavior:'smooth'});return;}
    if(action==='quality-fix'){
      const s=el.dataset.section,id=el.dataset.id,batch=el.dataset.batch;
      if(id){editor(s,id);return;}
      if(batch){const prep=state.records.prep.filter(r=>r.batch_id===batch);if(prep.length===1){editor('prep',prep[0].id);return;}}
      go('prep');showToast('Найдите и исправьте соответствующую строку заготовки');return;
    }
  });
  $('#editor-form').addEventListener('submit',saveEditor);
  window.addEventListener('hashchange',()=>{if(location.hash.slice(1)!==view){details=null;go(location.hash.slice(1));}});
  if(!['overview','prep','weld','docs','quality','import'].includes(view))view='overview';
  refresh();
})();
