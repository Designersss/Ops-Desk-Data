'use client';
import {useMemo,useState} from 'react';
import {ArrowLeft,ChevronRight,Info,Plus,PenLine,Trash2,AlertTriangle} from 'lucide-react';
import {DepartmentChart} from './Chart';
import {RecordForm} from './RecordForm';
import type {DashboardMetrics,ProductionRecord,RecordInput,RecordView,Section} from '@/lib/model';
import {statusLabel} from '@/lib/analytics';

const labels:Record<Section,string>={preparation:'Заготовка',welding:'Потребность сварки',documents:'Документация'};
const num=(n:number|null|undefined)=>n===null||n===undefined?'—':new Intl.NumberFormat('ru-RU',{maximumFractionDigits:1}).format(n);
const percent=(n:number|null|undefined)=>n===null||n===undefined?'—':num(n)+'%';
const fmtDate=(iso:string)=>iso.split('-').reverse().join('.');
export function StatusTag({row}:{row:RecordView}){
 const kind=row.status==='confirmed'||row.status==='covered'?'good':row.status==='shortage'||row.status==='unconfirmed'?'warn':'bad';
 return <span className={'status status-'+kind}>{statusLabel(row)}</span>;
}
export function EmployeeName({name}:{name:string|null}){
 return <span className={'journal-employee-name'+(!name?' no-employee':'')} title={name||'Не указан'}>{name||'Не указан'}</span>;
}
type DeptMetrics=DashboardMetrics[Section];
export function ProductionPage({section,rows,metrics,onNavigate}:{section:Section;rows:RecordView[];metrics:DeptMetrics|null;onNavigate:(url:string)=>void}){
 const [employee,setEmployee]=useState('all');
 const [status,setStatus]=useState('all');
 const [from,setFrom]=useState('');
 const [to,setTo]=useState('');
 const people=useMemo(()=>Array.from(new Set(rows.map(r=>r.employee||'').filter(Boolean))).sort((a,b)=>a.localeCompare(b,'ru')),[rows]);
 const hasUnknown=rows.some(r=>!r.employee);
 const filtered=rows.filter(r=>(employee==='all'||(employee==='unassigned'?!r.employee:r.employee===employee))
  &&(status==='all'||r.status===status)
  &&(!from||r.date>=from)&&(!to||r.date<=to));
 const reset=()=>{setEmployee('all');setStatus('all');setFrom('');setTo('');};
 const summary=metrics;
 const cards=section==='preparation'?[
  ['Выполнение',percent(summary&&'percent'in summary?summary.percent:null),'По подтверждённым записям'],
  ['Подтверждённый факт',num(summary&&'fact'in summary?summary.fact:null)+' ед.','Учтённый объём'],
  ['Всего записей',num(rows.length),'В журнале участка'],
  ['Требуют проверки',num(rows.filter(r=>!r.confirmed).length),'Не учитываются в подтверждённых суммах']
 ]:section==='welding'?[
  ['Потребность',num(summary&&'need'in summary?summary.need:null)+' ед.','Все заявки'],
  ['Обеспеченность',percent(summary&&'percent'in summary?summary.percent:null),'Только подтверждённые связи'],
  ['Подтверждённые партии',num(summary&&'linkedCount'in summary?summary.linkedCount:null),'Из '+rows.length],
  ['Не подтверждены',num(summary&&'unconfirmedCount'in summary?summary.unconfirmedCount:null),'Связи с заготовкой']
 ]:[
  ['Выполнение',percent(summary&&'percent'in summary?summary.percent:null),'Факт относительно плана'],
  ['Готово документов',num(summary&&'fact'in summary?summary.fact:null),'Подтверждённый факт'],
  ['Запланировано',num(summary&&'plan'in summary?summary.plan:null),'Подтверждённый план'],
  ['Всего записей',num(rows.length),'В журнале участка']
 ];
 return <div className="page-stack">
  <section className="department-analytics" aria-label="Показатели участка">
   <div className="department-section-label">ПОКАЗАТЕЛИ УЧАСТКА</div>
   <div className="department-metrics">{cards.map(([title,value,hint])=><article className="panel dept-metric" key={title}><span>{title}</span><strong>{value}</strong><small>{hint}</small></article>)}</div>
   <article className="panel dept-chart-panel"><div className="dept-chart-header"><div><h2>{section==='welding'?'Потребность по партиям':'План и факт по записям'}</h2><p>{section==='preparation'?'Факт с ошибками исключён из подтверждённых показателей':section==='welding'?'Потребности отдельных партий':'Независимые показатели документации'}</p></div><div className="dept-legend"><span><i className="dept-legend-plan"/> {section==='welding'?'Потребность':'План'}</span>{section!=='welding'&&<span><i className="dept-legend-fact"/> Факт</span>}</div></div><DepartmentChart section={section} rows={rows}/></article>
  </section>
  <div className="view-info-bar"><p>Показано записей: <strong>{filtered.length}</strong> из {rows.length}</p><button className="btn btn-primary" onClick={()=>onNavigate('/production/'+section+'/new')}><Plus size={16}/> Добавить запись</button></div>
  <section className="panel view-table">
   <div className="table-toolbar"><strong>Журнал · {labels[section]}</strong></div>
   <div className="journal-filters" aria-label="Фильтры журнала">
    <label className="journal-filter-field"><span>Сотрудник</span><select className="journal-filter-control" value={employee} onChange={e=>setEmployee(e.target.value)}><option value="all">Все сотрудники</option>{people.map(person=><option value={person} key={person}>{person}</option>)}{hasUnknown&&<option value="unassigned">Не указан</option>}</select></label>
    <label className="journal-filter-field"><span>Состояние</span><select className="journal-filter-control" value={status} onChange={e=>setStatus(e.target.value)}><option value="all">Все состояния</option><option value="confirmed">Подтверждено</option><option value="attention">Требует проверки</option><option value="unconfirmed">Связь не подтверждена</option><option value="shortage">Недостаточно</option><option value="covered">Обеспечено</option></select></label>
    <label className="journal-filter-field"><span>Дата от</span><input className="journal-filter-control" type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label>
    <label className="journal-filter-field"><span>Дата до</span><input className="journal-filter-control" type="date" value={to} onChange={e=>setTo(e.target.value)}/></label>
    <button type="button" className="journal-filter-clear" onClick={reset}>Сбросить</button>
   </div>
   <div className="table-wrap"><table className="data-table">
    <thead><tr><th>ЗАПИСЬ</th><th>ДАТА</th><th>СОТРУДНИК</th>{section!=='documents'&&<th>ПАРТИЯ</th>}<th>{section==='welding'?'ПОТРЕБНОСТЬ':'ПЛАН'}</th><th>{section==='welding'?'ПОКРЫТО':'ФАКТ'}</th><th>СОСТОЯНИЕ</th><th/></tr></thead>
    <tbody>{filtered.length===0?<tr><td colSpan={section==='documents'?7:8} className="empty-data">По выбранным фильтрам нет записей</td></tr>:filtered.map(row=><tr key={row.id} tabIndex={0} onClick={()=>onNavigate('/production/'+section+'/record/'+row.id)} onKeyDown={e=>{if(e.key==='Enter')onNavigate('/production/'+section+'/record/'+row.id)}} aria-label={'Открыть запись '+row.recordKey}>
     <td className="name-cell">{row.recordKey}</td><td>{fmtDate(row.date)}</td><td><EmployeeName name={row.employee}/></td>
     {section!=='documents'&&<td>{row.batchId}</td>}
     <td className="num">{num(section==='welding'?row.need:row.plan)}</td><td className="num">{section==='welding'?num(row.coverage?.covered):num(row.fact)}</td><td><StatusTag row={row}/></td><td><ChevronRight size={16}/></td>
    </tr>)}</tbody>
   </table></div>
  </section>
 </div>;
}
export function DetailPage({section,row,allRows,allowRelations,onNavigate,onUpdate,onDelete,busy,error}:{section:Section;row:RecordView;allRows:RecordView[];allowRelations:boolean;onNavigate:(url:string)=>void;onUpdate:(input:RecordInput)=>Promise<void>;onDelete:()=>Promise<void>;busy:boolean;error:string|null}){
 const [editing,setEditing]=useState(false);
 const listUrl='/production/'+section;
 if(editing)return <RecordForm section={section} record={row} busy={busy} error={error} onCancel={()=>setEditing(false)} onSubmit={async input=>{await onUpdate(input);setEditing(false)}}/>;
 const stats=section==='welding'?[
  ['Потребность',num(row.need)+' ед.'],['Подтверждённая заготовка',row.coverage?.confirmedFact===null||row.coverage?.confirmedFact===undefined?'Не определена':num(row.coverage.confirmedFact)+' ед.'],['Дефицит',row.coverage?.shortage===null||row.coverage?.shortage===undefined?'Не определён':num(row.coverage.shortage)+' ед.']
 ]:[
  ['План',num(row.plan)+(section==='documents'?' док.':' ед.')],['Факт',row.fact===null?'Не заполнено':num(row.fact)+(section==='documents'?' док.':' ед.')],['Выполнение',row.confirmed&&row.plan?percent(Math.round((row.fact??0)/row.plan*10000)/100):'Не подтверждено']
 ];
 const linked=allowRelations&&section!=='documents'?allRows.filter(r=>r.section!=='documents'&&r.section!==section&&r.batchId===row.batchId):[];
 return <div className="record-detail">
  <div className="record-detail-toolbar"><button className="back-link record-back" onClick={()=>onNavigate(listUrl)}><ArrowLeft size={16}/> К журналу «{labels[section]}»</button><div className="record-detail-actions"><button className="btn btn-outline" onClick={onDelete} disabled={busy}><Trash2 size={15}/> Удалить</button><button className="btn btn-primary" onClick={()=>setEditing(true)}><PenLine size={16}/> Редактировать запись</button></div></div>
  <div className="record-detail-identity"><div><span className="record-detail-subline">{row.batchId?'Партия '+row.batchId:'Документация'} · {fmtDate(row.date)}</span><h2>Показатели {section==='preparation'?'заготовки':section==='welding'?'потребности сварки':'документации'}</h2><p>Запись {row.recordKey}</p></div><StatusTag row={row}/></div>
  <div className="record-stats">{stats.map(([title,value])=><div key={title} className="detail-stat"><span>{title}</span><strong>{value}</strong></div>)}</div>
  <div className="record-detail-grid"><section className="panel record-card"><div className="record-card-head"><h3>Основная информация</h3><p>Исходные данные записи</p></div><dl className="detail-fields">{[['Номер записи',row.recordKey],['Дата',fmtDate(row.date)],['Сотрудник',row.employee||'Не указан'],...(row.batchId?[['Партия',row.batchId]]:[])].map(([key,value])=><div className="detail-pair" key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl></section>
   <section className="panel record-card"><div className="record-card-head"><h3>Проверка данных</h3><p>Статус и достоверность расчётов</p></div><div className="record-quality"><StatusTag row={row}/>{row.issues.length?row.issues.map(issue=><p key={issue.code}><AlertTriangle size={14}/> {issue.message}</p>):<p>{row.status==='unconfirmed'?'Обеспеченность не определена: отсутствует достоверная связанная заготовка.':'Ошибок в исходных полях не обнаружено.'}</p>}</div></section>
  </div>
  {section!=='documents'&&<section className="panel record-card record-relations"><div className="record-card-head"><h3>{section==='preparation'?'Связанная потребность сварки':'Связанная заготовка'}</h3><p>Сопоставление по номеру партии</p></div>{allowRelations?<div className="related-records">{linked.length?linked.map(item=><button key={item.id} className="related-record" onClick={()=>onNavigate('/production/'+item.section+'/record/'+item.id)}>{item.recordKey} · {labels[item.section]} <ChevronRight size={16}/></button>):<p className="detail-empty">Связанные записи не найдены</p>}</div>:<p className="detail-empty">У сотрудника есть доступ только к записям своего участка</p>}<p className="record-relation-note"><Info size={15}/> Недостоверная заготовка не считается подтверждённой обеспеченностью сварки.</p></section>}
  {error&&<p role="alert" className="form-error">{error}</p>}
 </div>;
}
