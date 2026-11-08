'use client';
import type { DashboardMetrics, RecordView, Section } from '@/lib/model';

const fmt=(value:number)=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:1}).format(value);
const dayLabel=(date:string)=>date.slice(8,10)+'.'+date.slice(5,7);
export function ProductionLineChart({days}:{days:DashboardMetrics['days']}){
 if(!days.length)return <div className="chart-empty">Нет подтверждённых данных за выбранный период</div>;
 const max=Math.max(1,...days.flatMap(d=>[d.plan??0,d.fact??0]))*1.12;
 const x=(i:number)=>days.length===1?410:50+(i/(days.length-1))*720;
 const y=(n:number)=>190-n/max*153;
 const path=(field:'plan'|'fact')=>{
  let result='',drawing=false;
  days.forEach((d,i)=>{
   const v=d[field];
   if(v===null){drawing=false;return;}
   result+=(drawing?' L':' M')+x(i).toFixed(1)+' '+y(v).toFixed(1);
   drawing=true;
  });
  return result;
 };
 return <div className="chart-responsive"><svg viewBox="0 0 820 230" role="img" aria-label="Динамика плана и подтверждённого факта за выбранный период">
  {[0,0.25,0.5,0.75,1].map(n=><g key={n}><line x1="49" x2="785" y1={y(max*n)} y2={y(max*n)} stroke="#edf1eb"/><text x="4" y={y(max*n)+4} fontSize="10" fill="#95a398">{fmt(max*n)}</text></g>)}
  <path d={path('plan')} fill="none" stroke="#b9cabc" strokeWidth="2.5" strokeDasharray="6 5" strokeLinecap="round"/>
  <path d={path('fact')} fill="none" stroke="#557b5f" strokeWidth="3" strokeLinecap="round"/>
  {days.map((d,i)=>d.fact!==null?<circle key={d.date} cx={x(i)} cy={y(d.fact)} r="4.2" fill="#fff" stroke="#557b5f" strokeWidth="2.3"><title>{dayLabel(d.date)}: {fmt(d.fact)} ед.</title></circle>:null)}
  {days.map((d,i)=><text key={'x'+d.date} x={x(i)} y="216" textAnchor="middle" fontSize="10" fill="#8a978d">{dayLabel(d.date)}</text>)}
 </svg></div>;
}
export function DepartmentChart({section,rows}:{section:Section;rows:RecordView[]}){
 if(!rows.length)return <div className="chart-empty">Нет записей за выбранный период</div>;
 const max=Math.max(1,...rows.flatMap(r=>[r.plan??0,r.need??0,r.confirmed?r.fact??0:0]));
 return <div className="department-bars-scroll"><div className="department-bars" style={{minWidth:Math.max(560,rows.length*74)}}>
  {rows.map(row=>{
   const planned=section==='welding'?row.need??0:row.plan??0;
   const real=section==='welding'?null:row.confirmed?row.fact:null;
   return <div className="department-bar-item" key={row.id}>
    <div className="department-bar-columns">
     <span style={{height:Math.max(1,100*planned/max)+'%'}} className="bar-plan" title={'План/потребность: '+planned}/>
     {real!==null && <span style={{height:Math.max(real===0?1:3,100*real/max)+'%'}} className="bar-fact" title={'Подтверждённый факт: '+real}/>}
     {real===null && section!=='welding' && <span className="bar-unverified" title="Факт не подтверждён">—</span>}
    </div><span className="department-bar-label" title={row.batchId||row.recordKey}>{row.batchId||row.recordKey}</span>
   </div>;
  })}
 </div></div>;
}
