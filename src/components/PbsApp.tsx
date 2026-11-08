'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import {usePathname,useRouter} from 'next/navigation';
import {AlertCircle,BarChart3,ChevronDown,ChevronRight,Database,FileSpreadsheet,Files,LayoutDashboard,Menu,PanelLeftClose,PanelLeftOpen,Settings2,ShieldAlert,Wrench,X} from 'lucide-react';
import {api,jsonRequest,ApiError} from '@/lib/client';
import type {AppState,DashboardMetrics,ImportStatus,Range,RecordInput,RecordView,Role,Section} from '@/lib/model';
import {OverviewPage,QualityPage,ReportsPage,ImportPage,SettingsPage} from './DashboardPages';
import {ProductionPage,DetailPage} from './ProductionPages';
import {RecordForm} from './RecordForm';

const sections:Section[]=['preparation','welding','documents'];
const sectionNames:Record<Section,string>={preparation:'Заготовка',welding:'Потребность сварки',documents:'Документация'};
const roleNames:Record<Role,string>={director:'Директор',preparation:'Сотрудник · Заготовка',welding:'Сотрудник · Сварка',documents:'Сотрудник · Документация'};
type LiveState=AppState&{department:DashboardMetrics[Section]|null};
type PageRoute={kind:'overview'|'production'|'new'|'detail'|'quality'|'reports'|'settings'|'import'|'notFound';section?:Section;id?:number};
function routeFromPath(pathname:string):PageRoute {
 if(pathname==='/')return {kind:'overview'};
 if(pathname==='/quality')return {kind:'quality'};
 if(pathname==='/reports')return {kind:'reports'};
 if(pathname==='/settings')return {kind:'settings'};
 if(pathname==='/settings/import')return {kind:'import'};
 const match=/^\/production\/(preparation|welding|documents)(?:\/(new|record\/(\d+)))?$/.exec(pathname);
 if(match){
  const section=match[1] as Section;
  if(match[2]==='new')return {kind:'new',section};
  if(match[3])return {kind:'detail',section,id:Number(match[3])};
  return {kind:'production',section};
 }
 return {kind:'notFound'};
}
function computeRange(period:string,from:string,to:string):Range {
 if(period==='all')return {};
 if(period==='custom')return {from:from||undefined,to:to||undefined};
 const today=new Date(),start=new Date(today);
 start.setUTCDate(today.getUTCDate()-(period==='7'?6:29));
 return {from:start.toISOString().slice(0,10),to:today.toISOString().slice(0,10)};
}
const requestError=(error:unknown)=>error instanceof Error?error.message:'Не удалось выполнить действие';
export function PbsApp(){
 const router=useRouter(),pathname=usePathname(),route=useMemo(()=>routeFromPath(pathname),[pathname]);
 const [role,setRole]=useState<Role|null>(null);
 const [pinRequired,setPinRequired]=useState(false);
 const [sessionReady,setSessionReady]=useState(false);
 const [roleMenu,setRoleMenu]=useState(false);
 const [roleTarget,setRoleTarget]=useState<Role|null>(null);
 const [rolePin,setRolePin]=useState('');
 const [roleError,setRoleError]=useState('');
 const [collapsed,setCollapsed]=useState(false);
 const [mobileOpen,setMobileOpen]=useState(false);
 const [data,setData]=useState<LiveState|null>(null);
 const [loading,setLoading]=useState(true);
 const [dataError,setDataError]=useState('');
 const [actionError,setActionError]=useState<string|null>(null);
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState('');
 const [revision,setRevision]=useState(0);
 const [period,setPeriod]=useState('all');
 const [dateFrom,setDateFrom]=useState('');
 const [dateTo,setDateTo]=useState('');
 const range=useMemo(()=>computeRange(period,dateFrom,dateTo),[period,dateFrom,dateTo]);

 const navigate=useCallback((url:string)=>{router.push(url);setMobileOpen(false);setRoleMenu(false);setActionError(null);},[router]);
 const refresh=useCallback(()=>setRevision(n=>n+1),[]);
 useEffect(()=>{let active=true;
  api<{role:Role|null;pinRequired:boolean}>('/api/session').then(result=>{
   if(active){setRole(result.role);setPinRequired(result.pinRequired);setSessionReady(true);}
  }).catch(error=>{if(active){setRoleError(requestError(error));setSessionReady(true);}});
  return ()=>{active=false;};
 },[]);
 useEffect(()=>{
  if(role&&role!=='director'&&!(route.section===role&&['production','new','detail'].includes(route.kind))){
    router.replace('/production/'+role);
  }
 },[role,route.kind,route.section,router]);
 useEffect(()=>{
  if(!sessionReady)return;
  if(!role){setData(null);setLoading(false);return;}
  const selected=(route.kind==='overview'||route.kind==='reports');
  const query=new URLSearchParams();
  if(selected&&range.from)query.set('from',range.from);
  if(selected&&range.to)query.set('to',range.to);
  let active=true;
  setLoading(true);setDataError('');
  api<LiveState>('/api/state'+(query.size?'?'+query.toString():'')).then(result=>{
   if(active){setData(result);setLoading(false);}
  }).catch(error=>{
   if(active){setData(null);setDataError(requestError(error));setLoading(false);}
  });
  return ()=>{active=false;};
 },[role,sessionReady,route.kind,route.section,range.from,range.to,revision]);

 const switchRole=async(target:Role,pin='')=>{
  if(pinRequired&&!pin){setRoleTarget(target);setRolePin('');setRoleError('');setRoleMenu(false);return;}
  setRoleError('');
  try{
   const response=await api<{role:Role}>('/api/session',jsonRequest('POST',{role:target,pin}));
   setRole(response.role);setRoleTarget(null);setRoleMenu(false);setData(null);setRevision(n=>n+1);
   navigate(target==='director'?'/':'/production/'+target);
  }catch(error){setRoleError(requestError(error));}
 };
 const saveRecord=async(input:RecordInput,existing?:RecordView)=>{
  setBusy(true);setActionError(null);
  try{
   if(existing){await api('/api/records/'+existing.id,jsonRequest('PATCH',{version:existing.version,record:input}));}
   else{await api('/api/records',jsonRequest('POST',input));}
   setNotice(existing?'Запись обновлена, показатели пересчитаны':'Запись сохранена, показатели пересчитаны');
   refresh();
   if(!existing)navigate('/production/'+input.section);
  }catch(error){setActionError(requestError(error));throw error;}
  finally{setBusy(false);}
 };
 const deleteRecord=async(row:RecordView)=>{
  if(!window.confirm('Удалить запись '+row.recordKey+'? Связанные показатели будут пересчитаны.'))return;
  setBusy(true);setActionError(null);
  try{
   await api('/api/records/'+row.id,{method:'DELETE'});
   setNotice('Запись удалена, показатели пересчитаны');
   navigate('/production/'+row.section);refresh();
  }catch(error){setActionError(requestError(error));}
  finally{setBusy(false);}
 };
 const runImport=async(form:FormData)=>{
  setBusy(true);setActionError(null);
  try{
   await api('/api/import',{method:'POST',body:form});
   setNotice('Импорт завершён. Записи сохранены в PostgreSQL.');
   refresh();navigate('/');
  }catch(error){setActionError(requestError(error));throw error;}
  finally{setBusy(false);}
 };

 const title=route.kind==='overview'?'Обзор предприятия':route.kind==='quality'?'Качество данных':
  route.kind==='reports'?'Отчёты':route.kind==='settings'?'Настройки':
  route.kind==='import'?'Импорт данных':route.kind==='new'?'Добавить запись':
  route.kind==='detail'?'Детали записи':route.kind==='production'&&route.section?sectionNames[route.section]:'Страница не найдена';
 const description=route.kind==='overview'?'Все ключевые показатели производства в одном месте.':
  route.kind==='quality'?'Проблемы первичных данных и влияние на связанные показатели.':
  route.kind==='reports'?'Сводка и выгрузка отчёта по выбранному периоду.':
  route.kind==='settings'?'Состояние данных и первоначальная загрузка.':
  route.kind==='import'?'Импорт исходных Excel-файлов в PostgreSQL.':
  route.kind==='new'&&route.section?'Новая запись · '+sectionNames[route.section]:
  route.kind==='production'&&route.section?'План, факт и показатели участка.':
  route.kind==='detail'&&route.section?'Исходные поля, качество и связанные данные.':'';
 const navItems:[string,string,typeof LayoutDashboard][]=[
  ['/', 'Обзор',LayoutDashboard],['/quality','Качество данных',ShieldAlert],['/reports','Отчёты',BarChart3]
 ];
 const productionItems:[Section,typeof FileSpreadsheet][]=[['preparation',FileSpreadsheet],['welding',Wrench],['documents',Files]];
 const currentRecord=route.section&&typeof route.id==='number'?data?.rows.find(row=>row.id===route.id&&row.section===route.section):undefined;
 const scopedRows=route.section?data?.rows.filter(row=>row.section===route.section)||[]:[];
 const department=route.section?(role==='director'?data?.metrics?.[route.section]||null:data?.department||null):null;
 const periodVisible=role==='director'&&(route.kind==='overview'||route.kind==='reports');

 let content;
 if(!sessionReady||loading)content=<div className="page-loading"><span className="spinner"/> Загрузка данных…</div>;
 else if(!role)content=<section className="panel access-placeholder"><Database size={27}/><h2>Выберите рабочую роль</h2><p>Для доступа к данным выберите роль в нижней части меню и введите PIN.</p>{roleError&&<p className="form-error">{roleError}</p>}</section>;
 else if(dataError)content=<section className="panel access-placeholder"><AlertCircle size={26}/><h2>Не удалось загрузить данные</h2><p>{dataError}</p><p>Проверьте подключение PostgreSQL и выполнение миграций.</p><button className="btn btn-outline" onClick={refresh}>Повторить</button></section>;
 else if(!data)content=null;
 else if(route.kind==='overview'&&data.metrics)content=<OverviewPage metrics={data.metrics} rows={data.rows} onNavigate={navigate}/>;
 else if(route.kind==='production'&&route.section)content=<ProductionPage key={route.section} section={route.section} rows={scopedRows} metrics={department||null} onNavigate={navigate}/>;
 else if(route.kind==='new'&&route.section)content=<RecordForm key={route.section} section={route.section} busy={busy} error={actionError} onCancel={()=>navigate('/production/'+route.section)} onSubmit={async input=>{await saveRecord(input).catch(()=>{});}}/>;
 else if(route.kind==='detail'&&route.section&&currentRecord)content=<DetailPage key={currentRecord.id} section={route.section} row={currentRecord} allRows={data.rows} allowRelations={role==='director'} busy={busy} error={actionError} onNavigate={navigate} onUpdate={async input=>{await saveRecord(input,currentRecord);}} onDelete={()=>deleteRecord(currentRecord)}/>;
 else if(route.kind==='quality'&&data.metrics)content=<QualityPage metrics={data.metrics} onNavigate={navigate}/>;
 else if(route.kind==='reports'&&data.metrics)content=<ReportsPage metrics={data.metrics} range={range}/>;
 else if(route.kind==='settings')content=<SettingsPage imports={data.imports} onNavigate={navigate}/>;
 else if(route.kind==='import')content=<ImportPage imports={data.imports} busy={busy} error={actionError} onImport={async form=>{await runImport(form).catch(()=>{});}} onNavigate={navigate}/>;
 else content=<div className="panel access-placeholder"><h2>Запись не найдена</h2><button className="btn btn-outline" onClick={()=>navigate(route.section?'/production/'+route.section:'/')}>Вернуться</button></div>;

 return <div className={'app-shell pbs-next'+(collapsed?' collapsed':'')+(mobileOpen?' mobile-open':'')}>
  {mobileOpen&&<button className="mobile-backdrop" onClick={()=>setMobileOpen(false)} aria-label="Закрыть меню"/>}
  <aside className="sidebar">
   <div className="brand"><img src="/assets/pbs-logo.webp" width="47" height="47" alt="PBS" className="brand-logo"/><div className="brand-copy"><strong>Петро Билдинг<br/>Системс</strong><span>Панель управления</span></div><button className="icon-btn collapse-btn" onClick={()=>setCollapsed(v=>!v)} aria-label={collapsed?'Развернуть меню':'Свернуть меню'} title={collapsed?'Развернуть меню':'Свернуть меню'}>{collapsed?<PanelLeftOpen size={17}/>:<PanelLeftClose size={17}/>}</button></div>
   <div className="sidebar-body">
    {role==='director'&&<><div className="nav-label">РАБОЧЕЕ ПРОСТРАНСТВО</div><nav className="nav-group" aria-label="Основное меню">{navItems.map(([path,name,Icon])=><button key={path} className={'nav-link'+(pathname===path?' active':'')} onClick={()=>navigate(path)} title={name}><Icon size={18}/><span>{name}</span>{path==='/quality'&&data?.metrics?.quality.problemRows? <span className="nav-counter">{data.metrics.quality.problemRows}</span>:null}</button>)}</nav></>}
    {role&&<><div className="nav-label nav-label-spaced">{role==='director'?'ПРОИЗВОДСТВО':'МОЙ УЧАСТОК'}</div><nav className="nav-group" aria-label="Производственные участки">{productionItems.filter(([sec])=>role==='director'||role===sec).map(([sec,Icon])=><button key={sec} className={'nav-link'+(route.section===sec?' active':'')} onClick={()=>navigate('/production/'+sec)} title={sectionNames[sec]}><Icon size={18}/><span>{sectionNames[sec]}</span></button>)}</nav></>}
   </div>
   <div className="sidebar-foot">
    {role==='director'&&<button className={'nav-link settings-link'+(route.kind==='settings'||route.kind==='import'?' active':'')} onClick={()=>navigate('/settings')}><Settings2 size={17}/><span>Настройки</span></button>}
    <div className="role-selector">
     <button className="role-trigger" aria-label="Выбрать режим работы" onClick={()=>setRoleMenu(v=>!v)} aria-expanded={roleMenu} aria-haspopup="listbox" title="Выбрать режим работы"><span className="role-avatar">{role==='director'?'Д':role?sectionNames[role][0]:'?'}</span><span className="role-copy"><strong>{role==='director'?'Директор':role?'Сотрудник':'Выбрать роль'}</strong><small>{role==='director'?'Все участки':role?sectionNames[role]:'Не выполнен вход'}</small></span><ChevronDown size={15} className="role-chevron"/></button>
     {roleMenu&&<div className="role-menu" role="listbox" aria-label="Выберите роль"><div className="role-menu-heading">РЕЖИМ РАБОТЫ</div>{(['director',...sections] as Role[]).map(item=><button className={'role-option'+(role===item?' selected':'')} key={item} onClick={()=>switchRole(item)} role="option" aria-selected={role===item}><span className="role-mark">{item==='director'?'Д':sectionNames[item][0]}</span><span className="role-option-copy"><strong>{roleNames[item]}</strong><small>{item==='director'?'Все участки и аналитика':'Только свой участок'}</small></span>{role===item&&<ChevronRight size={16}/>}</button>)}</div>}
    </div>
   </div>
  </aside>
  <div className="workspace">
   <header className="topbar"><div className="topbar-left"><button className="icon-btn mobile-menu" aria-label="Открыть меню" onClick={()=>setMobileOpen(true)}><Menu size={21}/></button><span className="crumb-root">{role==='director'?'Рабочее пространство':'Мой участок'}</span><ChevronRight size={14} className="crumb-chevron"/><strong>{route.section?sectionNames[route.section]:title}</strong>{(route.kind==='detail'||route.kind==='new')&&<><ChevronRight size={14} className="crumb-chevron"/><span className="crumb-leaf">{route.kind==='new'?'Добавить запись':currentRecord?.recordKey||'Запись'}</span></>}</div></header>
   <main className="main-content"><div className="content-container">
    <div className="page-heading"><div><h1>{route.kind==='detail'&&currentRecord?currentRecord.recordKey:title}</h1><p>{description}</p></div>
     {periodVisible&&<div className="heading-actions"><label className="period-filter-inline"><span>Период</span><select value={period} onChange={e=>setPeriod(e.target.value)} className="period-select"><option value="all">Весь период</option><option value="7">Последние 7 дней</option><option value="30">Последние 30 дней</option><option value="custom">Произвольный период</option></select></label>{period==='custom'&&<div className="period-custom-dates"><label>С <input aria-label="Начало периода" type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)}/></label><label>По <input aria-label="Конец периода" type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)}/></label></div>}</div>}
    </div>
    {notice&&<div className="success-message" role="status">{notice}<button aria-label="Закрыть сообщение" onClick={()=>setNotice('')}><X size={15}/></button></div>}
    {content}
   </div></main>
  </div>
  {roleTarget&&<div className="pin-overlay" role="presentation"><form className="pin-dialog panel" onSubmit={async e=>{e.preventDefault();await switchRole(roleTarget,rolePin);}}><div className="pin-head"><h2>{roleNames[roleTarget]}</h2><button type="button" className="icon-btn" onClick={()=>setRoleTarget(null)} aria-label="Закрыть"><X size={18}/></button></div><p>Введите PIN, чтобы открыть рабочий кабинет.</p><label>PIN <input type="password" autoComplete="off" required value={rolePin} onChange={e=>setRolePin(e.target.value)}/></label>{roleError&&<div className="form-error" role="alert">{roleError}</div>}<div className="pin-actions"><button className="btn btn-outline" type="button" onClick={()=>setRoleTarget(null)}>Отмена</button><button className="btn btn-primary" type="submit">Продолжить</button></div></form></div>}
 </div>;
}
