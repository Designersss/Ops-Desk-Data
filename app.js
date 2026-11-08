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

// Role selection affects the visible screens only; the backend will enforce access rights later.
const roleProfiles={
 director:{title:'Директор',subtitle:'Все участки',mark:'Д',home:'overview'},
 preparation:{title:'Сотрудник',subtitle:'Заготовка',mark:'З',home:'preparation'},
 welding:{title:'Сотрудник',subtitle:'Потребность сварки',mark:'С',home:'welding'},
 documents:{title:'Сотрудник',subtitle:'Документация',mark:'Д',home:'documents'}
};
let activeRole='director';
try{const stored=localStorage.getItem('pbs-view-role');if(roleProfiles[stored])activeRole=stored;}catch(error){}
const isDirector=()=>activeRole==='director';
const canView=page=>isDirector()||page===activeRole;
function closeRoleMenu(){
 $('#roleMenu').classList.add('hidden');
 $('#roleTrigger').setAttribute('aria-expanded','false');
}
function syncRoleUi(){
 const profile=roleProfiles[activeRole],director=isDirector();
 $('#appShell').classList.toggle('employee-mode',!director);
 document.querySelectorAll('.director-only').forEach(el=>el.classList.toggle('hidden',!director));
 document.querySelectorAll('.production-link').forEach(el=>el.classList.toggle('hidden',!director&&el.dataset.page!==activeRole));
 $('#productionNavLabel').textContent=director?'ПРОИЗВОДСТВО':'МОЙ УЧАСТОК';
 $('#roleTitle').textContent=profile.title;
 $('#roleSubtitle').textContent=profile.subtitle;
 $('#roleAvatar').textContent=profile.mark;
 $('#crumbRoot').textContent=director?'Рабочее пространство':'Мой участок';
 $('#roleMenu').querySelectorAll('[data-role]').forEach(el=>{
  const selected=el.dataset.role===activeRole;
  el.classList.toggle('selected',selected);
  el.setAttribute('aria-selected',String(selected));
 });
}
function selectRole(role){
 if(!roleProfiles[role])return;
 activeRole=role;
 try{localStorage.setItem('pbs-view-role',activeRole);}catch(error){}
 closeRoleMenu();
 closeModal();
 syncRoleUi();
 navigate(roleProfiles[activeRole].home);
}

const elIcon = (id, cls='ico') => `<svg class="${cls}" aria-hidden="true"><use href="#i-${id}"/></svg>`;
let currentPage='overview';
let chartMode='days';
let toastTimeout;
function openImportModal(){openModal('ИМПОРТ ДАННЫХ','Выбор Excel-файлов',`<p>Выберите файлы для трёх производственных участков.</p><div class="import-form">${[{name:'Заготовка',id:'prep'},{name:'Потребность сварки',id:'weld'},{name:'Документация',id:'doc'}].map(item=>`<label class="import-file-label"><span>${item.name}</span><input type="file" accept=".xlsx,.xls" aria-label="${item.name}" id="import-${item.id}"></label>`).join('')}</div><p class="import-warning">При повторной загрузке понадобится подтвердить замену существующих записей.</p>`,`<button class="btn btn-outline" data-close="modal">Отмена</button><button class="btn btn-primary" data-action="importPreview">Продолжить</button>`)}
// Each record has its own route and is displayed by one reusable screen per section.
// Static source values mirror the three provided Excel files; backend persistence is a later stage.
const records = {
  preparation: [
    {id:'P-001',date:'2026-10-05',batch:'LOT-01',employee:'Анна Соколова',plan:100,fact:90},
    {id:'P-002',date:'2026-10-06',batch:'LOT-02',employee:'Анна Соколова',plan:100,fact:100},
    {id:'P-003',date:'2026-10-07',batch:'LOT-03',employee:'Иван Морозов',plan:100,fact:1200},
    {id:'P-004',date:'2026-10-08',batch:'LOT-04',employee:'Иван Морозов',plan:100,fact:-5},
    {id:'P-005',date:'2026-10-09',batch:'LOT-05',employee:'Анна Соколова',plan:100,fact:80},
    {id:'P-005',date:'2026-10-09',batch:'LOT-05',employee:'Анна Соколова',plan:100,fact:80},
    {id:'P-006',date:'2026-10-12',batch:'LOT-06',employee:'Иван Морозов',plan:100,fact:0},
    {id:'P-007',date:'2026-10-13',batch:'LOT-07',employee:'Анна Соколова',plan:100,fact:null},
    {id:'P-008',date:'2026-10-14',batch:'LOT-08',employee:'Иван Морозов',plan:100,fact:100},
  ],
  welding: [
    {id:'W-001',date:'2026-10-05',batch:'LOT-01',need:110},
    {id:'W-002',date:'2026-10-06',batch:'LOT-02',need:90},
    {id:'W-003',date:'2026-10-07',batch:'LOT-03',need:130},
    {id:'W-004',date:'2026-10-08',batch:'LOT-04',need:100},
    {id:'W-005',date:'2026-10-09',batch:'LOT-05',need:100},
    {id:'W-006',date:'2026-10-12',batch:'LOT-06',need:20},
    {id:'W-007',date:'2026-10-13',batch:'LOT-07',need:100},
    {id:'W-008',date:'2026-10-14',batch:'LOT-08',need:100},
  ],
  documents: [
    {id:'D-001',date:'2026-10-05',employee:'Мария Лебедева',plan:5,fact:4},
    {id:'D-002',date:'2026-10-06',employee:'Олег Волков',plan:4,fact:4},
    {id:'D-003',date:'2026-10-07',employee:'Мария Лебедева',plan:5,fact:3},
    {id:'D-004',date:'2026-10-09',employee:'Олег Волков',plan:3,fact:2},
    {id:'D-005',date:'2026-10-12',employee:'Мария Лебедева',plan:4,fact:0},
    {id:'D-006',date:'2026-10-14',employee:'Олег Волков',plan:5,fact:5},
  ]
};
const numberLabel = (n, unit='ед.') => n === null || n === undefined ? 'Не заполнено' : `${n.toLocaleString('ru-RU')} ${unit}`;
const dateLabel = date => new Intl.DateTimeFormat('ru-RU',{day:'2-digit',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(`${date}T12:00:00Z`));
const dateShort = date => date.split('-').reverse().join('.');
const routeFor = (type, index) => `${type}/${index}`;
const validPrep = record => record.fact !== null && record.fact >= 0 && record.fact <= record.plan * 3 && records.preparation.filter(r => r.id === record.id).length === 1;
const preparationMatches = batch => records.preparation.map((item,index)=>({item,index})).filter(({item})=>item.batch===batch);
function stateFor(type,record){
  if(type === 'preparation'){
    if(records.preparation.filter(r=>r.id===record.id).length > 1) return {kind:'warn',label:'Дублирование',reason:'Идентификатор записи повторяется. Сопоставление партии со сваркой неоднозначно.'};
    if(record.fact === null) return {kind:'warn',label:'Нет факта',reason:'Фактический объём не заполнен. Показатель нельзя считать подтверждённым.'};
    if(record.fact < 0) return {kind:'bad',label:'Ошибка факта',reason:'Фактический объём отрицательный. Значение требует исправления.'};
    if(record.fact > record.plan * 3) return {kind:'bad',label:'Проверить факт',reason:'Факт существенно превышает план. Данные требуют подтверждения.'};
    return {kind:'good',label:'Подтверждено',reason:'В записи не обнаружено очевидных проблем качества.'};
  }
  if(type === 'welding'){
    const matches=preparationMatches(record.batch);
    if(matches.length !== 1 || !validPrep(matches[0].item)) return {kind:'bad',label:'Связанная ошибка',reason:'Данные связанной партии заготовки не подтверждены. Обеспеченность нельзя определять.'};
    return matches[0].item.fact < record.need
      ? {kind:'warn',label:'Недостаточно',reason:'Подтверждённый объём заготовки меньше потребности сварки.'}
      : {kind:'good',label:'Обеспечено',reason:'Подтверждённого объёма заготовки достаточно для потребности сварки.'};
  }
  if(record.fact === 0) return {kind:'warn',label:'Без выполнения',reason:'Выполнение работ пока не зафиксировано.'};
  if(record.fact < record.plan) return {kind:'warn',label:'Частично выполнено',reason:'Фактическое количество документов меньше запланированного.'};
  return {kind:'good',label:'План выполнен',reason:'Фактическое количество документов соответствует плану.'};
}
const statusPill = state => `<span class="status status-${state.kind}">${state.label}</span>`;
const displayValue = (value,unit='ед.') => value === null ? '<span class="detail-missing">Не заполнено</span>' : numberLabel(value,unit);
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
 const heading = type === 'preparation' ? ['ЗАПИСЬ','ДАТА','ПАРТИЯ','ПЛАН','ФАКТ','СОСТОЯНИЕ'] :
   type === 'welding' ? ['ЗАПИСЬ','ДАТА','ПАРТИЯ','ПОТРЕБНОСТЬ','ОБЕСПЕЧЕННОСТЬ','СОСТОЯНИЕ'] :
   ['ЗАПИСЬ','ДАТА','СОТРУДНИК','ПЛАН','ФАКТ','СОСТОЯНИЕ'];
 const rows=records[type].map((r,i)=>{
   const state=stateFor(type,r);
   const balance=type === 'welding' ? preparationMatches(r.batch) : [];
   const linkedFact = balance.length === 1 && validPrep(balance[0].item) ? balance[0].item.fact : null;
   const cells = type==='preparation'
     ? [r.id,dateShort(r.date),r.batch,numberLabel(r.plan),displayValue(r.fact)]
     : type==='welding'
     ? [r.id,dateShort(r.date),r.batch,numberLabel(r.need),linkedFact === null ? 'Не определена' : numberLabel(linkedFact)]
     : [r.id,dateShort(r.date),r.employee,numberLabel(r.plan,'док.'),numberLabel(r.fact,'док.')];
   return `<tr data-record="${i}" data-filter-status="${state.kind}" data-filter-date="${r.date}" tabindex="0" aria-label="Открыть запись ${r.id}">${cells.map((cell,idx)=>`<td class="${idx===0?'name-cell':idx===3||idx===4?'num':''}">${cell}</td>`).join('')}<td>${statusPill(state)}</td><td>${elIcon('chevron','row-next')}</td></tr>`;
 }).join('');
 return {heading,rows};
}
function sectionPage(type){
 const name=pages[type].short, data=normalRows(type);
 return `${productionAnalytics(type)}<div class="view-info-bar"><p>Показано записей: <strong id="journalCount">${records[type].length}</strong> из ${records[type].length}</p><button class="btn btn-primary" data-open="addRecord">${elIcon('plus')} Добавить запись</button></div>
  <section class="panel view-table"><div class="table-toolbar"><strong>Журнал · ${name}</strong></div>
   <div class="journal-filters" id="journalFilters" aria-label="Фильтры записей">
     <div class="journal-filter-field"><label for="journalStatus">Состояние</label><select class="journal-filter-control" id="journalStatus"><option value="all">Все состояния</option><option value="good">Подтверждено</option><option value="warn">Требует внимания</option><option value="bad">Ошибка</option></select></div>
     <div class="journal-filter-field"><label for="journalFrom">Дата от</label><input class="journal-filter-control" id="journalFrom" type="date"></div>
     <div class="journal-filter-field"><label for="journalTo">Дата до</label><input class="journal-filter-control" id="journalTo" type="date"></div>
     <button type="button" class="journal-filter-clear" id="journalFilterReset">Сбросить</button>
   </div>
   <div class="table-wrap"><table class="data-table" id="recordsTable"><thead><tr>${data.heading.map(title=>`<th>${title}</th>`).join('')}<th></th></tr></thead><tbody>${data.rows}<tr class="journal-empty-row hidden" id="journalEmpty"><td colspan="7">По выбранным фильтрам записей нет</td></tr></tbody></table></div>
  </section>`;
}
function detailPair(label,value){return `<div class="detail-pair"><dt>${label}</dt><dd>${value}</dd></div>`;}
function detailStat(label,value,hint='',extra=''){return `<div class="detail-stat"><span>${label}</span><strong class="${extra}">${value}</strong>${hint?`<small>${hint}</small>`:''}</div>`;}
function recordDetailsPage(type,index){
 const r=records[type][index];
 if(!r)return sectionPage(type);
 const state=stateFor(type,r), isPrep=type==='preparation',isWeld=type==='welding';
 const linked=isPrep?records.welding.map((item,i)=>({item,index:i})).filter(({item})=>item.batch===r.batch):isWeld?preparationMatches(r.batch):[];
 let stats='',fields='',relation='',note='';
 if(isPrep){
   const valid=validPrep(r);
   stats=detailStat('План',numberLabel(r.plan),'Объём по записи')+detailStat('Факт',displayValue(r.fact),'Зафиксированное количество')+
     detailStat('Выполнение',valid?`${Math.round(r.fact/r.plan*1000)/10}%`:'Не определено',valid?'Факт относительно плана':'Требуется проверка записи',!valid?'detail-stat-alert':'');
   fields=detailPair('Номер записи',r.id)+detailPair('Дата',dateLabel(r.date))+detailPair('Партия',r.batch)+detailPair('Сотрудник',r.employee);
   relation=linked.length?linked.map(({item,index:i})=>`<button class="related-record" data-go="${routeFor('welding',i)}"><span class="related-icon">${elIcon('weld')}</span><span><strong>${item.id}</strong><small>Потребность сварки · ${numberLabel(item.need)}</small></span>${elIcon('chevron')}</button>`).join(''):'<div class="detail-empty">Связанных заявок на сварку нет.</div>';
   note=valid?'Показатели этой записи могут участвовать в расчёте обеспеченности связанной сварки.':'Связанные показатели сварки не следует считать достоверными до исправления данных.';
 } else if(isWeld){
   const source=linked.length===1?linked[0].item:null;
   const fact=source&&validPrep(source)?source.fact:null;
   const remainder=fact===null?null:Math.max(0,r.need-fact);
   stats=detailStat('Потребность',numberLabel(r.need),'Необходимый объём')+
      detailStat('Подтверждённая заготовка',fact===null?'Не определена':numberLabel(fact),fact===null?'Источник требует проверки':`Партия ${r.batch}`,fact===null?'detail-stat-alert':'')+
      detailStat('Недостаток',remainder===null?'Не определён':numberLabel(remainder),remainder===null?'Расчёт приостановлен':remainder===0?'Потребность закрыта':'Не хватает материала');
   fields=detailPair('Номер записи',r.id)+detailPair('Дата',dateLabel(r.date))+detailPair('Партия',r.batch)+detailPair('Участок','Потребность сварки');
   relation=linked.length?linked.map(({item,index:i})=>`<button class="related-record" data-go="${routeFor('preparation',i)}"><span class="related-icon">${elIcon('box')}</span><span><strong>${item.id}</strong><small>Заготовка · факт: ${displayValue(item.fact)}</small></span>${elIcon('chevron')}</button>`).join(''):'<div class="detail-empty">Соответствующая партия заготовки не найдена.</div>';
   note=fact===null?'Обеспеченность не рассчитывается, пока запись заготовки недостоверна или связь неоднозначна.':'Расчёт обеспеченности выполняется по подтверждённому факту заготовки той же партии.';
 } else {
   stats=detailStat('План',numberLabel(r.plan,'док.'),'Документов запланировано')+
     detailStat('Факт',numberLabel(r.fact,'док.'),'Документов выполнено')+
     detailStat('Выполнение',`${Math.round(r.fact/r.plan*1000)/10}%`,'Факт относительно плана');
   fields=detailPair('Номер записи',r.id)+detailPair('Дата',dateLabel(r.date))+detailPair('Сотрудник',r.employee)+detailPair('Участок','Документация');
   relation='<div class="detail-empty">Документация учитывается отдельно от заготовки и сварки.</div>';
   note='Показатели документации рассчитываются независимо от производственных партий.';
 }
 if(!isDirector() && (isPrep||isWeld)){
  relation='<div class="detail-empty">Записи другого участка доступны директору. Состояние связанного расчёта приведено выше.</div>';
  note='Из рабочего кабинета сотрудника можно открывать только записи своего участка.';
 }
 return `<div class="record-detail">
   <div class="record-detail-toolbar"><button class="back-link record-back" data-go="${type}">${elIcon('arrow-left')} К журналу «${pages[type].short}»</button><button class="btn btn-primary" data-edit-record="${index}">${elIcon('settings')} Редактировать запись</button></div>
   <div class="record-detail-identity"><div><span class="record-detail-subline">${isPrep||isWeld?`Партия ${r.batch}`:'Документ'} · ${dateLabel(r.date)}</span><h2>${isPrep?'Показатели заготовки':isWeld?'Показатели потребности':'Показатели документации'}</h2><p>Запись № ${index+1} из ${records[type].length}</p></div>${statusPill(state)}</div>
   <div class="record-stats">${stats}</div>
   <div class="record-detail-grid"><section class="panel record-card"><div class="record-card-head"><h3>Основная информация</h3><p>Исходные данные записи</p></div><dl class="detail-fields">${fields}</dl></section>
   <section class="panel record-card"><div class="record-card-head"><h3>Проверка данных</h3><p>Состояние записи и влияние на показатели</p></div>
      <div class="record-quality"><div class="record-quality-status">${statusPill(state)}</div><p>${state.reason}</p></div></section>
   </div>
   <section class="panel record-card record-relations"><div class="record-card-head"><h3>${isPrep?'Связанная потребность сварки':isWeld?'Связанная заготовка':'Связанные данные'}</h3><p>${isPrep||isWeld?'Записи сопоставлены по номеру партии':'Самостоятельный участок учёта'}</p></div><div class="related-records">${relation}</div><p class="record-relation-note">${elIcon('info')} ${note}</p></section>
  </div>`;
}
function openRecordEditor(type,index){
 if(!canView(type))return;
 const r=records[type]?.[index];if(!r)return;
 const fields=[['Номер записи','id',r.id,'text'],['Дата','date',r.date,'date']];
 if(type!=='documents')fields.push(['Номер партии','batch',r.batch,'text']);
 if(type!=='welding')fields.push(['Сотрудник','employee',r.employee,'text']);
 if(type==='welding')fields.push(['Потребность, ед.','need',r.need,'number']);
 else fields.push(['План', 'plan',r.plan,'number'],['Факт','fact',r.fact??'','number']);
 const content=`<div class="detail-edit-form">${fields.map(([label,key,val,kind])=>`<label class="detail-edit-field"><span>${label}</span><input class="form-input" type="${kind}" value="${val}" name="${key}"${kind==='number'?' step="1"':''}></label>`).join('')}</div>`;
 openModal('РЕДАКТИРОВАНИЕ ЗАПИСИ',`Редактировать ${r.id}`,content,`<button class="btn btn-outline" data-close="modal">Отмена</button><button class="btn btn-primary" data-action="savePreview">Сохранить</button>`);
}
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
function resolveRoute(){
 const route=decodeURIComponent(location.hash.slice(1));
 if(pages[route])return {page:route,index:null};
 const creating=/^(preparation|welding|documents)\/new$/.exec(route);
 if(creating)return {page:creating[1],index:null,create:true};
 const match=/^(preparation|welding|documents)\/(\d+)$/.exec(route);
 if(match){const index=Number(match[2]);if(Number.isSafeInteger(index)&&index<records[match[1]].length)return {page:match[1],index};}
 return {page:'overview',index:null};
}
function navigate(path){
 if(!pages[path]&&!/^(preparation|welding|documents)\/(?:\d+|new)$/.test(path))return;
 if(!canView(path.split('/')[0]))return;
 if(location.hash!==`#${path}`)location.hash=path;
 else renderPage();
}
function renderPage(){
 const route=resolveRoute();
 syncRoleUi();
 if(!canView(route.page)){
  const home=roleProfiles[activeRole].home;
  if(location.hash!=='#'+home)location.hash=home;
  return;
 }
 const p=pages[route.page],creating=route.create===true,detail=route.index!==null,record=detail?records[route.page][route.index]:null;
 currentPage=route.page;
 $('#pageTitle').textContent=creating?'Добавить запись':detail?record.id:p.title;
 $('#pageDescription').textContent=creating?`Новая запись · ${p.short}`:detail?`${p.short} · ${dateLabel(record.date)}`:p.desc;
 $('#crumbCurrent').textContent=p.short;
 $('#crumbDetail').textContent=creating?'Добавить запись':detail?record.id:'';
 $('#crumbDetailWrap').classList.toggle('hidden',!(detail||creating));
 $('#pageBody').innerHTML=creating?createRecordPage(route.page):detail?recordDetailsPage(route.page,route.index):
   route.page==='overview'?overview():['preparation','welding','documents'].includes(route.page)?sectionPage(route.page):
   route.page==='quality'?qualityPage():route.page==='reports'?reportsPage():route.page==='import'?importPage():settingsPage();
 $('.heading-actions').classList.toggle('hidden',creating||detail||!['overview','reports'].includes(route.page));
 $('#exportTrigger').classList.toggle('hidden',route.page!=='reports');
 document.title=`${creating?'Добавить запись — ':detail?record.id+' — ':''}${p.short} — Петро Билдинг Системс`;
 document.querySelectorAll('.nav-link').forEach(btn=>{const active=btn.dataset.page===(route.page==='import'?'settings':route.page);btn.classList.toggle('active',active);if(active)btn.setAttribute('aria-current','page');else btn.removeAttribute('aria-current')});
 $('#mainContent').scrollTop=0;
 $('#appShell').classList.remove('mobile-open');
}

function applyJournalFilters(){
 const table=$('#recordsTable');
 if(!table)return;
 const state=$('#journalStatus').value;
 const from=$('#journalFrom').value;
 const to=$('#journalTo').value;
 let visibleCount=0;
 table.querySelectorAll('tbody tr[data-record]').forEach(row=>{
  const visible=(state==='all'||row.dataset.filterStatus===state)
    &&(!from||row.dataset.filterDate>=from)
    &&(!to||row.dataset.filterDate<=to);
  row.classList.toggle('hidden',!visible);
  if(visible)visibleCount++;
 });
 $('#journalCount').textContent=String(visibleCount);
 $('#journalEmpty').classList.toggle('hidden',visibleCount!==0);
}
function currentPeriodText(){
 const el=$('#periodSelect');
 const value=el.value;
 if(value==='custom'){
  const from=$('#periodFrom').value;
  const to=$('#periodTo').value;
  return from||to?`${from||'Начало'} — ${to||'Конец'}`:'Произвольный период';
 }
 return el.options[el.selectedIndex]?.textContent||'Весь период';
}

function showToast(msg){const box=$('#toast');box.textContent=msg;box.classList.add('show');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>box.classList.remove('show'),3200)}
function openModal(kicker,title,body,actions){$('#modalKicker').textContent=kicker;$('#modalTitle').textContent=title;$('#modalBody').innerHTML=body;$('#modalActions').innerHTML=actions||`<button class="btn btn-primary" data-close="modal">Понятно</button>`;$('#modalOverlay').classList.remove('hidden');$('#modalOverlay').setAttribute('aria-hidden','false');$('#modalClose').focus();}
function closeModal(){const modal=$('#modalOverlay');modal.classList.add('hidden');modal.setAttribute('aria-hidden','true')}
function openIssue(i){if(!isDirector())return;const r=issueRows[i];if(!r)return;openModal('КАЧЕСТВО ДАННЫХ',r.title,`<div class="form-row"><span>Источник</span><strong>${r.sub.split(' · ')[0]}</strong></div><div class="form-row"><span>Запись</span><strong>${r.id}</strong></div><div class="form-row"><span>Влияние</span><strong style="max-width:210px;text-align:right">${r.impact}</strong></div>`,`<button class="btn btn-outline" data-close="modal">Закрыть</button><button class="btn btn-primary" data-open="editIssue">Исправить запись ${elIcon('chevron')}</button>`)}
function openAction(action){if(!isDirector()&&['tableInfo','export','editIssue','importFiles'].includes(action))return;
 if(action==='tableInfo')openModal('МЕТОДОЛОГИЯ','Как читать показатели',`<p>Значения заготовки показаны только по подтверждённым записям. Некорректные факты исключены из достоверных расчётов.</p><p>Потребность сварки отображается отдельно. Если связанная партия заготовки ошибочна, обеспеченность нельзя считать определённой.</p><p>Документация не зависит от других участков.</p>`);
 else if(action==='export')openModal('ОТЧЁТНОСТЬ','Скачать отчёт',`<p>Выбранный период: <strong>${currentPeriodText()}</strong>.</p><label class="field-label" for="formatChoice">Формат файла</label><select class="form-input" id="formatChoice"><option>Excel (.xlsx)</option><option>CSV (.csv)</option></select>`,`<button class="btn btn-outline" data-close="modal">Отмена</button><button class="btn btn-primary" data-action="exportPreview">${elIcon('download')} Скачать отчёт</button>`);
 else if(action==='addRecord'){if(['preparation','welding','documents'].includes(currentPage))navigate(currentPage+'/new');}
 else if(action==='editIssue')openModal('РЕДАКТИРОВАНИЕ','Исправить значение',`<label class="field-label" for="issueValue">Новое значение</label><input class="form-input" id="issueValue" type="number" placeholder="Введите значение">`,`<button class="btn btn-outline" data-close="modal">Отмена</button><button class="btn btn-primary" data-action="savePreview">Сохранить</button>`);

 else if(action==='importFiles')openImportModal();
}
document.addEventListener('submit',event=>{
 const form=event.target;
 if(form.id!=='newRecordForm')return;
 event.preventDefault();
 if(!canView(form.dataset.createType))return;
 showToast('Сохранение новых записей будет подключено вместе с базой данных');
});
document.addEventListener('click',event=>{
 const roleOption=event.target.closest('[data-role]');
 if(roleOption){selectRole(roleOption.dataset.role);return;}
 if(event.target.closest('#roleTrigger')){
  const menu=$('#roleMenu');
  menu.classList.toggle('hidden');
  $('#roleTrigger').setAttribute('aria-expanded',String(!menu.classList.contains('hidden')));
  return;
 }
 if(!event.target.closest('#roleSelector'))closeRoleMenu();
 const nav=event.target.closest('[data-page],[data-go]');if(nav){navigate(nav.dataset.page||nav.dataset.go);closeModal();return}
 const issue=event.target.closest('[data-issue]');if(issue){openIssue(Number(issue.dataset.issue));return}
 const rec=event.target.closest('[data-record]');if(rec){navigate(routeFor(currentPage,Number(rec.dataset.record)));return}
 const edit=event.target.closest('[data-edit-record]');if(edit){openRecordEditor(currentPage,Number(edit.dataset.editRecord));return}
 const open=event.target.closest('[data-open]');if(open){openAction(open.dataset.open);return}
 const close=event.target.closest('[data-close]');if(close){closeModal();return}
 const act=event.target.closest('[data-action]');if(act){closeModal();showToast(act.dataset.action==='exportPreview'?'Экспорт ещё не подключён':act.dataset.action==='importPreview'?'Выбранные файлы не загружены: импорт ещё не подключён':'Изменения пока не сохраняются');return}
 if(event.target.closest('#journalFilterReset')){
  $('#journalStatus').value='all';
  $('#journalFrom').value='';
  $('#journalTo').value='';
  applyJournalFilters();
  return;
 }
});
document.addEventListener('change',event=>{
 if(event.target.closest('#journalFilters'))applyJournalFilters();
 if(event.target.id==='periodSelect'){
  $('#periodCustomDates').classList.toggle('hidden',event.target.value!=='custom');
 }
});
document.addEventListener('keydown',event=>{if(event.key==='Escape'){closeModal();closeRoleMenu()}if(event.key==='Enter'&&event.target.matches('[data-record],[data-issue],tr[data-go],article[data-go]'))event.target.click()});
$('#mobileMenu').addEventListener('click',()=>$('#appShell').classList.toggle('mobile-open'));
$('#mobileBackdrop').addEventListener('click',()=>$('#appShell').classList.remove('mobile-open'));
$('#collapseBtn').addEventListener('click',()=>{
 const collapsed=$('#appShell').classList.toggle('collapsed');
 const label=collapsed?'Развернуть меню':'Свернуть меню';
 $('#collapseBtn').setAttribute('aria-label',label);
 $('#collapseBtn').setAttribute('title',label);
});
$('#modalOverlay').addEventListener('click',event=>{if(event.target.id==='modalOverlay')closeModal()});
$('#modalClose').addEventListener('click',closeModal);
$('#exportTrigger').addEventListener('click',()=>openAction('export'));
window.addEventListener('hashchange',renderPage);
renderPage();
