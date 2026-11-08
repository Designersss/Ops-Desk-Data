'use client';
import {useState,type FormEvent} from 'react';
import {AlertTriangle,ArrowLeft,ArrowRight,CheckCircle2,ChevronRight,Database,Download,FileSpreadsheet,Info,Upload} from 'lucide-react';
import {ProductionLineChart} from './Chart';
import type {DashboardMetrics,ImportStatus,Range,RecordView,Section} from '@/lib/model';
import {statusLabel} from '@/lib/analytics';

const fmt=(n:number|null|undefined)=>n===null||n===undefined?'—':new Intl.NumberFormat('ru-RU',{maximumFractionDigits:1}).format(n);
const pct=(n:number|null|undefined)=>n===null||n===undefined?'—':fmt(n)+'%';
const names:Record<Section,string>={preparation:'Заготовка',welding:'Потребность сварки',documents:'Документация'};
const sectionUrl=(section:Section)=>'/production/'+section;

export function OverviewPage({metrics,rows,onNavigate}:{metrics:DashboardMetrics;rows:RecordView[];onNavigate:(url:string)=>void}){
 const issueRecords=new Set(metrics.quality.issues.map(issue=>issue.id));
 const data=[
  {name:'Заготовка',path:sectionUrl('preparation'),plan:fmt(metrics.preparation.plan)+' ед.',fact:fmt(metrics.preparation.fact)+' ед.',result:pct(metrics.preparation.percent),status:'Частично подтверждено'},
  {name:'Потребность сварки',path:sectionUrl('welding'),plan:'—',fact:fmt(metrics.welding.need)+' ед.',result:pct(metrics.welding.percent),status:metrics.welding.unconfirmedCount?'Есть неподтверждённые связи':'Проверено'},
  {name:'Документация',path:sectionUrl('documents'),plan:fmt(metrics.documents.plan)+' док.',fact:fmt(metrics.documents.fact)+' док.',result:pct(metrics.documents.percent),status:'Независимый участок'},
 ];
 return <div className="page-stack">
  <section className="kpi-grid" aria-label="Ключевые показатели">
   <article className="panel kpi-card"><div className="kpi-head"><div className="kpi-label">Выполнение заготовки</div><span className="kpi-icon"><FileSpreadsheet size={17}/></span></div><div className="kpi-value">{pct(metrics.preparation.percent)}</div><div className="kpi-foot">Факт {fmt(metrics.preparation.fact)} из {fmt(metrics.preparation.plan)} ед. · подтверждено</div></article>
   <article className="panel kpi-card"><div className="kpi-head"><div className="kpi-label">Потребность сварки</div><span className="kpi-icon"><Database size={17}/></span></div><div className="kpi-value">{fmt(metrics.welding.need)} <small>ед.</small></div><div className="kpi-foot">{metrics.welding.linkedCount} из {metrics.welding.totalCount} партий с проверенной обеспеченностью</div></article>
   <article className="panel kpi-card"><div className="kpi-head"><div className="kpi-label">Документация</div><span className="kpi-icon"><FileSpreadsheet size={17}/></span></div><div className="kpi-value">{pct(metrics.documents.percent)}</div><div className="kpi-foot">{fmt(metrics.documents.fact)} из {fmt(metrics.documents.plan)} документов · независимо</div></article>
   <button type="button" className="panel kpi-card kpi-click" onClick={()=>onNavigate('/quality')}><div className="kpi-head"><div className="kpi-label">Требуют внимания</div><span className="kpi-icon alert-icon"><AlertTriangle size={18}/></span></div><div className="kpi-value">{metrics.quality.problemRows} <small>записей</small></div><div className="kpi-foot"><span className="warning">Есть недостоверные значения</span><ChevronRight size={16}/></div></button>
  </section>
  <section className="dashboard-two-col">
   <article className="panel chart-card"><div className="panel-heading"><div><h2>Динамика выполнения</h2><p>План и подтверждённый факт за выбранный период</p></div><div className="legend"><span><i className="legend-dot"/> Факт</span><span><i className="legend-dot outline"/> План</span></div></div><div className="chart-area"><ProductionLineChart days={metrics.days}/></div></article>
   <article className="panel quality-card"><div className="panel-heading quality-header"><div><h2>Контроль качества</h2><p>Замечания к первичным записям</p></div><span className="quality-heading-right">{metrics.quality.problemRows} строк</span></div>
    <div className="quality-rows">{metrics.quality.issues.filter(i=>issueRecords.has(i.id)).slice(0,3).map((issue,i)=><button className="issue-row" key={issue.id+'-'+issue.code+'-'+i} onClick={()=>onNavigate(sectionUrl(issue.section)+'/record/'+issue.id)}><span className="issue-marker"><AlertTriangle size={16}/></span><span className="issue-copy"><strong>{issue.recordKey}: {issue.message}</strong><small>{names[issue.section]}</small></span><ChevronRight size={15}/></button>)}
    {!metrics.quality.issues.length && <p className="quality-clear">Замечаний за выбранный период нет</p>}</div>
    <div className="quality-footer"><button className="text-link" onClick={()=>onNavigate('/quality')}>Все замечания <ChevronRight size={15}/></button></div>
   </article>
  </section>
  <section className="panel table-card"><div className="panel-heading table-heading"><div><h2>Сводка по участкам</h2><p>Данные и результаты по направлениям</p></div></div><div className="table-wrap"><table className="data-table"><thead><tr><th>УЧАСТОК</th><th>ПЛАН</th><th>ФАКТ / ПОТРЕБНОСТЬ</th><th>ВЫПОЛНЕНИЕ</th><th>СОСТОЯНИЕ</th><th/></tr></thead><tbody>{data.map(item=><tr key={item.name} tabIndex={0} onClick={()=>onNavigate(item.path)} onKeyDown={e=>{if(e.key==='Enter')onNavigate(item.path)}}><td className="name-cell">{item.name}</td><td>{item.plan}</td><td className="num">{item.fact}</td><td className="num">{item.result}</td><td>{item.status}</td><td><ChevronRight size={16}/></td></tr>)}</tbody></table></div></section>
  <p className="methodology-text"><Info size={15}/> Показатели «Заготовки» формируются по проверенным записям; связанные расчёты сварки не считаются подтверждёнными при ошибках источника. Документация не зависит от остальных участков.</p>
 </div>;
}
export function QualityPage({metrics,onNavigate}:{metrics:DashboardMetrics;onNavigate:(url:string)=>void}){
 const byRecord=new Map<number,{section:Section;key:string;messages:string[]}>();
 for(const issue of metrics.quality.issues){
  const found=byRecord.get(issue.id)||{section:issue.section,key:issue.recordKey,messages:[]};
  found.messages.push(issue.message);byRecord.set(issue.id,found);
 }
 return <div className="page-stack"><div className="small-intro"><AlertTriangle size={18}/> Ошибочные факты исключаются из подтверждённых итогов. Недостоверность заготовки влияет на обеспеченность связанных партий сварки, но не на документацию.</div>
  <section className="panel"><div className="panel-heading"><div><h2>Замечания к данным</h2><p>Проблемных записей: {metrics.quality.problemRows}. Связей сварки без подтверждения: {metrics.quality.linkedUnconfirmed}.</p></div></div>
   <div className="quality-item-list">{[...byRecord.entries()].map(([id,item])=><button className="quality-list-item" key={id} onClick={()=>onNavigate(sectionUrl(item.section)+'/record/'+id)}><span className="issue-marker"><AlertTriangle size={17}/></span><div><strong>{item.key} · {names[item.section]}</strong><p>{item.messages.join('; ')}</p></div><ChevronRight size={16}/></button>)}{!byRecord.size&&<div className="empty-data"><CheckCircle2 size={19}/> Нет замечаний за выбранный период</div>}</div>
  </section>
 </div>;
}
export function ReportsPage({metrics,range}:{metrics:DashboardMetrics;range:Range}){
 const params=new URLSearchParams();
 if(range.from)params.set('from',range.from);
 if(range.to)params.set('to',range.to);
 const href='/api/report'+(params.size?'?'+params.toString():'');
 return <div className="page-stack"><section className="panel report-feature"><div><h2>Управленческая отчётность</h2><p>Сводные показатели, первичные записи, качество данных и подтверждённые связи за выбранный период. Отчёт формируется из базы данных на момент скачивания.</p></div><a className="btn btn-primary" href={href}><Download size={17}/> Скачать отчёт CSV</a></section>
  <section className="report-totals">{[
   ['Заготовка',pct(metrics.preparation.percent),fmt(metrics.preparation.fact)+' из '+fmt(metrics.preparation.plan)+' ед.'],
   ['Сварка',pct(metrics.welding.percent),metrics.welding.linkedCount+' подтверждённых партий'],
   ['Документация',pct(metrics.documents.percent),fmt(metrics.documents.fact)+' из '+fmt(metrics.documents.plan)+' док.']
  ].map(([title,value,sub])=><article className="panel dept-metric" key={title}><span>{title}</span><strong>{value}</strong><small>{sub}</small></article>)}</section>
  <p className="methodology-text"><Info size={15}/> Сварочная обеспеченность рассчитывается только для проверенных пар «потребность — заготовка». Отдельная потребность сварки учитывается независимо от качества исходного факта заготовки.</p>
 </div>;
}
export function SettingsPage({imports,onNavigate}:{imports:ImportStatus[];onNavigate:(url:string)=>void}){
 return <section className="panel settings-overview"><span className="settings-overview-icon"><Database size={27}/></span><div className="settings-overview-copy"><h2>Импорт данных</h2><p>Первоначальная загрузка трёх Excel-файлов в общую базу. После загрузки система работает без них.</p><div className="settings-summary"><span>{imports.length} источника</span><span>{imports.reduce((n,i)=>n+i.count,0)} записей</span></div></div><button className="btn btn-outline" onClick={()=>onNavigate('/settings/import')}>Открыть <ChevronRight size={15}/></button></section>;
}
export function ImportPage({imports,busy,error,onImport,onNavigate}:{imports:ImportStatus[];busy:boolean;error:string|null;onImport:(form:FormData)=>Promise<void>;onNavigate:(url:string)=>void}){
 const [files,setFiles]=useState<Partial<Record<Section,File>>>({});
 const [replace,setReplace]=useState(false);
 const sections:Section[]=['preparation','welding','documents'];
 const onSubmit=async(e:FormEvent<HTMLFormElement>)=>{
  e.preventDefault();
  const data=new FormData();
  for(const section of sections){
   if(!files[section])return;
   data.set(section,files[section]);
  }
  data.set('replace',String(replace));
  await onImport(data);
 };
 return <div className="page-stack import-screen">
  <button className="back-link" onClick={()=>onNavigate('/settings')}><ArrowLeft size={16}/> Настройки</button>
  <section className="panel import-hero"><span className="import-hero-icon"><Database size={26}/></span><div className="import-hero-copy"><span className="import-overline">СОСТОЯНИЕ ДАННЫХ</span><h2>{imports.length===3?'Исходные данные загружены':'Первоначальная загрузка данных'}</h2><p>Храним записи в PostgreSQL. Excel используется только в момент импорта, после чего для работы системы не требуется.</p></div><span className={'status '+(imports.length===3?'status-good':'status-warn')}>{imports.length===3?'Загружено':'Ожидает импорта'}</span></section>
  <section className="panel import-sources"><div className="panel-heading"><div><h2>Источники</h2><p>Состав и количество импортированных записей</p></div></div><div className="source-list">{sections.map(section=>{
   const item=imports.find(source=>source.section===section);
   return <div className="source-row" key={section}><span className="source-file-icon"><FileSpreadsheet size={20}/></span><div className="source-file-copy"><strong>{names[section]}</strong><small>{item?.fileName||'Ещё не загружен'}</small></div><div className="source-count">{item?.count??0} записей</div>{item&&<CheckCircle2 size={17} color="#6b9774"/>}</div>;
  })}</div></section>
  <section className="panel create-card import-upload"><div className="create-card-head"><span className="create-card-step"><Upload size={16}/></span><div><h2>Загрузить три файла</h2><p>Выберите .xlsx с исходными колонками каждого участка.</p></div></div>
   <form onSubmit={onSubmit}><div className="import-file-grid">{sections.map(section=><label className="import-file-choice" key={section}><span>{names[section]}</span><input type="file" accept=".xlsx" required onChange={e=>setFiles(prev=>({...prev,[section]:e.target.files?.[0]}))}/></label>)}</div>
    {imports.length>0&&<label className="import-confirm"><input type="checkbox" checked={replace} onChange={e=>setReplace(e.target.checked)}/><span>Заменить все текущие записи новыми из файлов. Существующие изменения будут удалены.</span></label>}
    {error&&<p role="alert" className="form-error">{error}</p>}
    <div className="create-form-actions"><button type="submit" disabled={busy||sections.some(section=>!files[section])||(imports.length>0&&!replace)} className="btn btn-primary"><Upload size={16}/>{busy?'Импортирование…':'Импортировать данные'}</button></div>
   </form>
  </section><p className="methodology-text"><Info size={15}/> Повторная загрузка заменяет все три набора атомарно: если один файл некорректен, существующая база останется без изменений.</p>
 </div>;
}
