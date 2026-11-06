/** PBS interface: navigation and visual interactions; server data integration is separate. */
const $ = (selector) => document.querySelector(selector);
const pages = {
  overview:{title:'Обзор предприятия',short:'Обзор',eyebrow:'ОПЕРАЦИОННАЯ АНАЛИТИКА',desc:'Все ключевые показатели производства в одном месте.'},
  preparation:{title:'Заготовка',short:'Заготовка',eyebrow:'ПРОИЗВОДСТВО',desc:'Планы, факты и состояние производственных партий.'},
  welding:{title:'Потребность сварки',short:'Потребность сварки',eyebrow:'ПРОИЗВОДСТВО',desc:'Заявки на сварку и обеспеченность материалами.'},
  documents:{title:'Документация',short:'Документация',eyebrow:'ПРОИЗВОДСТВО',desc:'Контроль выполнения документационных работ.'},
  quality:{title:'Качество данных',short:'Качество данных',eyebrow:'КОНТРОЛЬ',desc:'Подозрительные значения, пропуски и их влияние на показатели.'},
  reports:{title:'Отчёты',short:'Отчёты',eyebrow:'АНАЛИТИКА',desc:'Подготовка и выгрузка управленческой отчётности.'},
  settings:{title:'Настройки',short:'Настройки',eyebrow:'СИСТЕМА',desc:'Загрузка и состояние производственных данных.'},
  import:{title:'Импорт данных',short:'Импорт данных',eyebrow:'СИСТЕМА',desc:'Первоначальная загрузка данных из трёх Excel-файлов.'},
};
const elIcon = (id, cls='ico') => `<svg class="${cls}" aria-hidden="true"><use href="#i-${id}"/></svg>`;
let currentPage='overview';
let chartMode='days';
let toastTimeout;
function openImportModal(){openModal('ИМПОРТ ДАННЫХ','Выбор Excel-файлов',`<p>Выберите файлы для трёх производственных участков.</p><div class="import-form">${[{name:'Заготовка',id:'prep'},{name:'Потребность сварки',id:'weld'},{name:'Документация',id:'doc'}].map(item=>`<label class="import-file-label"><span>${item.name}</span><input type="file" accept=".xlsx,.xls" aria-label="${item.name}" id="import-${item.id}"></label>`).join('')}</div><p class="import-warning">При повторной загрузке понадобится подтвердить замену существующих записей.</p>`,`<button class="btn btn-outline" data-close="modal">Отмена</button><button class="btn btn-primary" data-action="importPreview">Продолжить</button>`)}
const issueRows = [
  {id:'P-003',title:'Аномальный факт: 1 200 ед.',sub:'Заготовка · значение требует проверки',severity:'bad',impact:'Связанные партии сварки нельзя считать обеспеченными.'},
  {id:'P-005',title:'Повторяющийся идентификатор',sub:'Заготовка · возможный дубль записи',severity:'bad',impact:'Нельзя однозначно сопоставить партию со сваркой.'},
  {id:'Факт',title:'Отрицательное значение: −5',sub:'Заготовка · недопустимый факт',severity:'warn',impact:'Показатель партии необходимо исключить из подтверждённых.'},
  {id:'Факт',title:'Не заполнен факт',sub:'Заготовка · пропущено обязательное поле',severity:'warn',impact:'Нет подтверждённого фактического объёма.'},
  {id:'Связь',title:'Неоднозначное соответствие',sub:'Заготовка → Потребность сварки',severity:'warn',impact:'Требуется уточнение исходной партии.'}
];
function overview(){return `
  <section class="kpi-grid" aria-label="Ключевые показатели">
    <article class="panel kpi-card"><div class="kpi-head"><div class="kpi-label">Выполнение заготовки</div><span class="kpi-icon">${elIcon('box')}</span></div><div class="kpi-value">72,5<small>%</small></div><div class="kpi-foot stack"><div class="progress-mini"><span></span></div><span>290 из 400 ед. · подтверждённые</span></div></article>
    <article class="panel kpi-card"><div class="kpi-head"><div class="kpi-label">Потребность сварки</div><span class="kpi-icon">${elIcon('weld')}</span></div><div class="kpi-value">750<small>ед.</small></div><div class="kpi-foot">8 партий в работе</div></article>
    <article class="panel kpi-card"><div class="kpi-head"><div class="kpi-label">Документация</div><span class="kpi-icon">${elIcon('files')}</span></div><div class="kpi-value">6<small>записей</small></div><div class="kpi-foot"><strong>Независимый участок</strong></div></article>
    <article class="panel kpi-card pressable" data-go="quality" tabindex="0" role="button"><div class="kpi-head"><div class="kpi-label">Требуют внимания</div><span class="kpi-icon alert-icon">${elIcon('alert')}</span></div><div class="kpi-value">5<small>проблем</small></div><div class="kpi-foot"><span class="warning">Есть недостоверные показатели</span>${elIcon('chevron')}</div></article>
  </section>
  <section class="dashboard-two-col" aria-label="Аналитика и качество данных">
    <article class="panel chart-card"><div class="panel-heading"><div><h2>Динамика выполнения</h2><p>План и факт по дням</p></div><div class="legend"><span><i class="legend-dot"></i>Факт</span><span><i class="legend-dot outline"></i>План</span></div></div>
      <div class="chart-area" id="chartArea">${renderChart()}</div>
    </article>
    <article class="panel quality-card"><div class="panel-heading quality-header"><div><h2>Контроль качества</h2><p>Обнаруженные проблемы в исходных данных</p></div><span class="quality-heading-right">5 проблем</span></div>
      <div class="quality-rows">${issueRows.slice(0,3).map((r,i)=>`<div class="issue-row" role="button" tabindex="0" data-issue="${i}"><span class="issue-marker ${r.severity==='warn'?'soft':''}">${elIcon('alert')}</span><div class="issue-copy"><strong>${r.title}</strong><small>${r.sub}</small></div>${elIcon('chevron')}</div>`).join('')}</div>
      <div class="quality-footer"><button class="text-link" data-go="quality">Все замечания ${elIcon('chevron')}</button></div>
    </article>
  </section>
  <section class="panel table-card"><div class="panel-heading table-heading"><div><h2>Сводка по участкам</h2><p>Состояние данных и результатов по направлениям</p></div><button class="subtle-action" data-open="tableInfo">${elIcon('info')} О показателях</button></div>
    <div class="table-wrap"><table class="data-table"><thead><tr><th>УЧАСТОК</th><th>ПЛАН</th><th>ФАКТ / ПОТРЕБНОСТЬ</th><th>ПОКАЗАТЕЛЬ</th><th>СОСТОЯНИЕ</th><th></th></tr></thead><tbody>
      <tr data-go="preparation" tabindex="0"><td class="name-cell"><span class="name-content"><span class="table-icon">${elIcon('box')}</span>Заготовка</span></td><td class="num">400 ед.</td><td class="num">290 ед.</td><td class="num">72,5%</td><td><span class="status status-warn">Частично подтверждено</span></td><td>${elIcon('chevron','row-next')}</td></tr>
      <tr data-go="welding" tabindex="0"><td class="name-cell"><span class="name-content"><span class="table-icon">${elIcon('weld')}</span>Потребность сварки</span></td><td class="muted-cell">—</td><td class="num">750 ед. потребность</td><td class="muted-cell">Не определён</td><td><span class="status status-bad">Есть зависимости</span></td><td>${elIcon('chevron','row-next')}</td></tr>
      <tr data-go="documents" tabindex="0"><td class="name-cell"><span class="name-content"><span class="table-icon">${elIcon('files')}</span>Документация</span></td><td class="muted-cell">—</td><td class="num">6 записей</td><td class="muted-cell">Отдельный расчёт</td><td><span class="status status-good">Независимо</span></td><td>${elIcon('chevron','row-next')}</td></tr>
    </tbody></table></div>
  </section>`}
function renderChart(){return `<svg class="main-chart" viewBox="0 0 680 232" preserveAspectRatio="none" role="img" aria-label="График выполнения по датам"><defs><linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#73927a" stop-opacity=".18"/><stop offset="100%" stop-color="#73927a" stop-opacity="0"/></linearGradient></defs>
  ${[24,72,120,168].map((y,i)=>`<line class="chart-grid" x1="39" y1="${y}" x2="666" y2="${y}"/><text class="chart-label" x="0" y="${y+4}">${100-i*25}%</text>`).join('')}
  <path d="M40 166 C 84 151 113 142 148 151 S 213 120 253 124 S 316 67 352 94 S 421 78 452 64 S 530 75 558 48 S 618 59 663 29 L663 181 L40 181 Z" fill="url(#chartFill)"/>
  <path class="chart-secondary" d="M40 106 C88 104 109 95 148 105 S223 81 253 87 S321 77 352 69 S418 66 452 61 S528 53 558 50 S625 43 663 36"/>
  <path class="chart-line" d="M40 166 C84 151 113 142 148 151 S213 120 253 124 S316 67 352 94 S421 78 452 64 S530 75 558 48 S618 59 663 29"/>
  <circle class="chart-point" cx="452" cy="64" r="5"/><path d="M452 70v110" stroke="#a8bbae" stroke-dasharray="4 5" stroke-width="1"/>
  ${['01.10','03.10','05.10','07.10','09.10','11.10','13.10'].map((x,i)=>`<text class="chart-label" x="${36+i*104}" y="213">${x}</text>`).join('')}
  </svg><div class="chart-tooltip"><span>09 октября</span><br><strong>81,6%</strong> <span>выполнено</span></div>`}
function normalRows(type){
 const isPrep=type==='preparation',isWeld=type==='welding';
 const data=isPrep?[
  ['P-001','05.10.2026','100 ед.','95 ед.','Подтверждено','good'],['P-003','07.10.2026','120 ед.','1 200 ед.','Проверить','bad'],['P-005','09.10.2026','—','—','Дублирование','warn'],['P-007','11.10.2026','—','−5 ед.','Проверить','bad'],['P-008','13.10.2026','—','Не заполнено','Не заполнено','warn']]
 :isWeld?[
  ['Партия 01','05.10.2026','100 ед.','—','Требует сверки','warn'],['Партия 02','06.10.2026','150 ед.','—','Требует сверки','warn'],['Партия 03','07.10.2026','180 ед.','—','Связанная ошибка','bad'],['Партия 04','08.10.2026','90 ед.','—','Требует сверки','warn']]
 :[
  ['Документ 01','05.10.2026','Оформление','—','Отдельный учёт','good'],['Документ 02','06.10.2026','Согласование','—','Отдельный учёт','good'],['Документ 03','08.10.2026','Оформление','—','Отдельный учёт','good'],['Документ 04','12.10.2026','Проверка','—','Отдельный учёт','good']];
 return data.map((r,i)=>`<tr data-record="${i}" tabindex="0"><td class="name-cell">${r[0]}</td><td>${r[1]}</td><td class="num">${r[2]}</td><td class="num">${r[3]}</td><td><span class="status status-${r[5]}">${r[4]}</span></td><td>${elIcon('chevron','row-next')}</td></tr>`).join('');
}
function sectionPage(type){const name=pages[type].short,count={preparation:9,welding:8,documents:6}[type];return `
  <div class="view-info-bar"><p>Всего записей в исходном файле: <strong>${count}</strong></p><button class="btn btn-primary" data-open="addRecord">${elIcon('plus')} Добавить запись</button></div>
  <section class="panel view-table"><div class="table-toolbar"><strong>Журнал · ${name}</strong><div class="table-toolbar-actions"><button class="subtle-action" data-open="filters">${elIcon('filter')} Фильтры</button></div></div>
    <div class="table-wrap"><table class="data-table" id="recordsTable"><thead><tr><th>ЗАПИСЬ</th><th>ДАТА</th><th>${type==='preparation'?'ПЛАН':type==='welding'?'ПОТРЕБНОСТЬ':'ОПЕРАЦИЯ'}</th><th>ФАКТ</th><th>СОСТОЯНИЕ</th><th></th></tr></thead><tbody>${normalRows(type)}</tbody></table></div>
  </section>`}
function qualityPage(){return `<div class="small-intro">${elIcon('shield')}Ошибки заготовки не должны превращать показатели связанных партий сварки в «подтверждённые». Документация учитывается независимо.</div><section class="panel"><div class="panel-heading"><div><h2>Замечания к данным</h2><p>Замечания, выявленные в исходных данных</p></div><span class="quality-heading-right">5 замечаний</span></div><div class="quality-item-list">${issueRows.map((r,i)=>`<button class="quality-list-item" data-issue="${i}"><span class="issue-marker ${r.severity==='warn'?'soft':''}">${elIcon('alert')}</span><div><strong>${r.title}</strong><p>${r.sub} · ${r.impact}</p></div>${elIcon('chevron')}</button>`).join('')}</div></section>`}
function reportsPage(){return `<section class="panel report-feature"><div><h2>Управленческая отчётность</h2><p>Единый отчёт по заготовке, сварке, документации и качеству данных за выбранный период.</p></div></section><div style="height:18px"></div><section class="config-grid"><article class="panel config-card"><strong>Сводка руководителя</strong><p>Ключевые показатели по участкам, состояние план/факт и отклонения.</p></article><article class="panel config-card"><strong>Качество данных</strong><p>Список замечаний, связанные показатели и первичные записи.</p></article></section>`}
function settingsPage(){return `<section class="panel settings-overview">
  <div class="settings-overview-icon">${elIcon('database')}</div>
  <div class="settings-overview-copy"><h2>Импорт данных</h2><p>Загрузка исходных Excel-файлов в единую систему хранения и просмотр состояния импортированных записей.</p><div class="settings-summary"><span>3 источника</span><span>23 записи</span></div></div>
  <button class="btn btn-outline" data-go="import">Открыть ${elIcon('chevron')}</button>
  </section>`}
function importPage(){return `
  <button class="back-link" data-go="settings">${elIcon('arrow-left')} Настройки</button>
  <section class="panel import-hero"><div class="import-hero-icon">${elIcon('database')}</div>
  <div class="import-hero-copy"><span class="import-overline">СОСТОЯНИЕ ДАННЫХ</span><h2>Исходные данные загружены</h2><p>Три Excel-файла объединены в одну структуру. После загрузки записи можно изменять в рабочих разделах независимо от исходных файлов.</p></div>
  <span class="status status-good import-status">Загружено</span></section>
  <section class="panel import-sources"><div class="panel-heading import-heading"><div><h2>Загруженные источники</h2><p>Состав и количество записей по каждому участку</p></div><span class="import-total">23 записи</span></div>
  <div class="source-list">
    ${[
      {title:'Заготовка',filename:'01_Заготовка.xlsx',count:9},
      {title:'Потребность сварки',filename:'02_Потребность_сварки.xlsx',count:8},
      {title:'Документация',filename:'03_Документация.xlsx',count:6}
    ].map(item=>`<div class="source-row"><span class="source-file-icon">${elIcon('files')}</span><div class="source-file-copy"><strong>${item.title}</strong><small>${item.filename}</small></div><div class="source-count">${item.count} записей</div><span class="source-check">${elIcon('check')}</span></div>`).join('')}
  </div></section>
  <section class="panel import-action-panel"><div><h2>Загрузить исходные файлы</h2><p>Для первоначальной настройки или повторной загрузки данных выберите по одному файлу для каждого участка. Повторная загрузка требует отдельного подтверждения, чтобы не потерять исправления.</p></div><button class="btn btn-primary" data-open="importFiles">${elIcon('upload')} Выбрать файлы</button></section>
  <div class="import-hint">${elIcon('info')} Изменение записей выполняется в разделах «Заготовка», «Потребность сварки» и «Документация».</div>`}
function getPage(){let hash=location.hash.replace('#','');return pages[hash]?hash:'overview'}
function navigate(page){if(!pages[page])return;if(location.hash!==`#${page}`)location.hash=page;renderPage();}
function renderPage(){currentPage=getPage();const p=pages[currentPage];$('#pageTitle').textContent=p.title;$('#pageDescription').textContent=p.desc;$('#crumbCurrent').textContent=p.short;$('.page-eyebrow').innerHTML=`${p.eyebrow} <span class="eyebrow-separator">/</span> ${p.short.toUpperCase()}`;$('#pageBody').innerHTML=currentPage==='overview'?overview():['preparation','welding','documents'].includes(currentPage)?sectionPage(currentPage):currentPage==='quality'?qualityPage():currentPage==='reports'?reportsPage():currentPage==='import'?importPage():settingsPage();$('.heading-actions').classList.toggle('hidden',!['overview','reports'].includes(currentPage));document.title=`${p.short} — Петро Билдинг Системс`;document.querySelectorAll('.nav-link').forEach(btn=>{const active=btn.dataset.page===(currentPage==='import'?'settings':currentPage);btn.classList.toggle('active',active);if(active)btn.setAttribute('aria-current','page');else btn.removeAttribute('aria-current')});$('#mainContent').scrollTop=0;$('#appShell').classList.remove('mobile-open');}
function showToast(msg){const box=$('#toast');box.textContent=msg;box.classList.add('show');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>box.classList.remove('show'),3200)}
function openModal(kicker,title,body,actions){$('#modalKicker').textContent=kicker;$('#modalTitle').textContent=title;$('#modalBody').innerHTML=body;$('#modalActions').innerHTML=actions||`<button class="btn btn-primary" data-close="modal">Понятно</button>`;$('#modalOverlay').classList.remove('hidden');$('#modalOverlay').setAttribute('aria-hidden','false');$('#modalClose').focus();}
function closeModal(){const modal=$('#modalOverlay');modal.classList.add('hidden');modal.setAttribute('aria-hidden','true')}
function openIssue(i){const r=issueRows[i];if(!r)return;openModal('КАЧЕСТВО ДАННЫХ',r.title,`<div class="form-row"><span>Источник</span><strong>${r.sub.split(' · ')[0]}</strong></div><div class="form-row"><span>Запись</span><strong>${r.id}</strong></div><div class="form-row"><span>Влияние</span><strong style="max-width:210px;text-align:right">${r.impact}</strong></div>`,`<button class="btn btn-outline" data-close="modal">Закрыть</button><button class="btn btn-primary" data-open="editIssue">Исправить запись ${elIcon('chevron')}</button>`)}
function openAction(action){if(action==='tableInfo')openModal('МЕТОДОЛОГИЯ','Как читать показатели',`<p>Значения заготовки показаны только по подтверждённым записям. Некорректные факты исключены из достоверных расчётов.</p><p>Потребность сварки отображается отдельно. Если связанная партия заготовки ошибочна, обеспеченность нельзя считать определённой.</p><p>Документация не зависит от других участков.</p>`);
 else if(action==='export')openModal('ОТЧЁТНОСТЬ','Скачать отчёт',`<p>Выбранный период: <strong>${$('#periodLabel').textContent}</strong>.</p><label class="field-label" for="formatChoice">Формат файла</label><select class="form-input" id="formatChoice"><option>Excel (.xlsx)</option><option>CSV (.csv)</option></select>`,`<button class="btn btn-outline" data-close="modal">Отмена</button><button class="btn btn-primary" data-action="exportPreview">${elIcon('download')} Скачать отчёт</button>`);
 else if(action==='addRecord')openModal('НОВАЯ ЗАПИСЬ','Добавить запись',`<label class="field-label" for="recordId">Номер партии / документа</label><input class="form-input" id="recordId" placeholder="Например, P-009"><label class="field-label" for="recordDate">Дата</label><input class="form-input" type="date" id="recordDate" value="2026-10-15"><label class="field-label" for="recordValue">Значение</label><input class="form-input" type="number" id="recordValue" placeholder="0">`,`<button class="btn btn-outline" data-close="modal">Отмена</button><button class="btn btn-primary" data-action="savePreview">Сохранить</button>`);
 else if(action==='editIssue')openModal('РЕДАКТИРОВАНИЕ','Исправить значение',`<label class="field-label" for="issueValue">Новое значение</label><input class="form-input" id="issueValue" type="number" placeholder="Введите значение">`,`<button class="btn btn-outline" data-close="modal">Отмена</button><button class="btn btn-primary" data-action="savePreview">Сохранить</button>`);
 else if(action==='filters')openModal('ФИЛЬТРЫ','Фильтрация записей',`<label class="field-label">Состояние записи</label><select class="form-input"><option>Все состояния</option><option>Подтверждено</option><option>Требует проверки</option></select><label class="field-label">Период</label><select class="form-input"><option>Все даты</option><option>Текущий месяц</option></select>`,`<button class="btn btn-outline" data-close="modal">Отмена</button><button class="btn btn-primary" data-action="filterPreview">Применить</button>`);
 else if(action==='importFiles')openImportModal();
}
document.addEventListener('click',event=>{
 const nav=event.target.closest('[data-page],[data-go]');if(nav){navigate(nav.dataset.page||nav.dataset.go);closeModal();return}
 const issue=event.target.closest('[data-issue]');if(issue){openIssue(Number(issue.dataset.issue));return}
 const rec=event.target.closest('[data-record]');if(rec){openModal('ПЕРВИЧНАЯ ЗАПИСЬ','Просмотр записи',`<div class="form-row"><span>Раздел</span><strong>${pages[currentPage].short}</strong></div><div class="form-row"><span>Номер строки</span><strong>№ ${Number(rec.dataset.record)+1}</strong></div>`,`<button class="btn btn-outline" data-close="modal">Закрыть</button><button class="btn btn-primary" data-open="editIssue">Редактировать</button>`);return}
 const open=event.target.closest('[data-open]');if(open){openAction(open.dataset.open);return}
 const close=event.target.closest('[data-close]');if(close){closeModal();return}
 const act=event.target.closest('[data-action]');if(act){closeModal();showToast(act.dataset.action==='exportPreview'?'Экспорт ещё не подключён':act.dataset.action==='importPreview'?'Выбранные файлы не загружены: импорт ещё не подключён':'Изменения пока не сохраняются');return}
 const period=event.target.closest('[data-period]');if(period){const text=period.dataset.period;if(text==='Произвольный период'){openModal('ПЕРИОД','Выбрать даты',`<label class="field-label">Начало периода</label><input type="date" class="form-input" value="2026-10-01" id="dateFrom"><label class="field-label">Конец периода</label><input type="date" class="form-input" value="2026-10-15" id="dateTo">`,`<button class="btn btn-outline" data-close="modal">Отмена</button><button class="btn btn-primary" data-action="periodPreview">Применить</button>`)}else{$('#periodLabel').textContent=text;$('#periodMenu').querySelectorAll('[data-period]').forEach(el=>el.classList.toggle('selected',el===period));showToast('Период выбран')}$('#periodMenu').classList.add('hidden');$('#periodTrigger').setAttribute('aria-expanded','false');return}
 if(event.target.id==='periodTrigger'||event.target.closest('#periodTrigger')){const menu=$('#periodMenu');menu.classList.toggle('hidden');$('#periodTrigger').setAttribute('aria-expanded',String(!menu.classList.contains('hidden')));return}
 if(!event.target.closest('#periodMenu')){$('#periodMenu').classList.add('hidden');$('#periodTrigger').setAttribute('aria-expanded','false')}
});
document.addEventListener('keydown',event=>{if(event.key==='Escape'){closeModal();$('#periodMenu').classList.add('hidden')}if(event.key==='Enter'&&event.target.matches('[data-record],[data-issue],tr[data-go],article[data-go]'))event.target.click()});
$('#mobileMenu').addEventListener('click',()=>$('#appShell').classList.toggle('mobile-open'));
$('#mobileBackdrop').addEventListener('click',()=>$('#appShell').classList.remove('mobile-open'));
$('#collapseBtn').addEventListener('click',()=>$('#appShell').classList.toggle('collapsed'));
$('#modalOverlay').addEventListener('click',event=>{if(event.target.id==='modalOverlay')closeModal()});
$('#modalClose').addEventListener('click',closeModal);
$('#exportTrigger').addEventListener('click',()=>openAction('export'));
window.addEventListener('hashchange',renderPage);
renderPage();
