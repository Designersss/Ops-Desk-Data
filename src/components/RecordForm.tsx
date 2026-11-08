'use client';
import {useEffect,useState,type FormEvent} from 'react';
import {ArrowLeft,Info,Save} from 'lucide-react';
import type { ProductionRecord,RecordInput,Section } from '@/lib/model';
const titles:Record<Section,string>={preparation:'Заготовка',welding:'Потребность сварки',documents:'Документация'};
type Props={section:Section;record?:ProductionRecord|null;busy:boolean;error?:string|null;onSubmit:(input:RecordInput)=>Promise<void>;onCancel:()=>void};
type FieldName='recordKey'|'date'|'batchId'|'employee'|'plan'|'fact'|'need';
function TextField({name,label,value,onChange,required=false,kind='text',hint='',placeholder=''}:{name:FieldName;label:string;value:string;onChange:(value:string)=>void;required?:boolean;kind?:string;hint?:string;placeholder?:string}){
 return <label className="create-field"><span>{label}{required&&<em className="create-required"> *</em>}</span>
  <input name={name} className="create-field-control" value={value} onChange={e=>onChange(e.target.value)}
   required={required} type={kind} step={kind==='number'?'1':undefined} min={kind==='number'&&name!=='fact'?0:undefined} placeholder={placeholder}/>
  {hint&&<small className="create-field-help">{hint}</small>}
 </label>;
}
export function RecordForm({section,record,busy,error,onSubmit,onCancel}:Props){
 const [fields,setFields]=useState({recordKey:'',date:'',batchId:'',employee:'',plan:'',fact:'',need:''});
 useEffect(()=>{
  setFields({
   recordKey:record?.recordKey||'',date:record?.date||new Date().toISOString().slice(0,10),
   batchId:record?.batchId||'',employee:record?.employee||'',plan:record?.plan?.toString()||'',
   fact:record?.fact===null||record?.fact===undefined?'':String(record.fact),
   need:record?.need?.toString()||''
  });
 },[record,section]);
 const set=(name:keyof typeof fields,value:string)=>setFields(current=>({...current,[name]:value}));
 const onFormSubmit=async(event:FormEvent<HTMLFormElement>)=>{
  event.preventDefault();
  const data:RecordInput={
   section,recordKey:fields.recordKey.trim(),date:fields.date,
   batchId:section==='documents'?null:fields.batchId.trim(),
   employee:fields.employee.trim()||null,
   plan:section==='welding'?null:Number(fields.plan),
   fact:section==='welding'?null:fields.fact.trim()===''?null:Number(fields.fact),
   need:section==='welding'?Number(fields.need):null
  };
  try { await onSubmit(data); } catch { /* Request error is shown beside the form. */ }
 };

 return <div className="create-record-page">
  <button className="back-link" onClick={onCancel} type="button"><ArrowLeft size={15}/> К журналу «{titles[section]}»</button>
  <div className="create-record-layout">
   <form className="create-record-main" onSubmit={onFormSubmit}>
    <section className="panel create-card"><div className="create-card-head"><span className="create-card-step">01</span><div><h2>Основная информация</h2><p>Заполните сведения о производственной записи</p></div></div>
     <div className="create-field-grid">
      <TextField name="recordKey" value={fields.recordKey} onChange={value=>set('recordKey',value)} label="Номер записи" required placeholder={section==='preparation'?'P-009':section==='welding'?'W-009':'D-007'}/>
      <TextField name="date" value={fields.date} onChange={value=>set('date',value)} label="Дата" kind="date" required/>
      {section!=='documents' && <TextField name="batchId" value={fields.batchId} onChange={value=>set('batchId',value)} label="Номер партии" required placeholder="LOT-09" hint="Связь со сваркой определяется по этому номеру"/>}
      <TextField name="employee" value={fields.employee} onChange={value=>set('employee',value)} label="Сотрудник" required={section!=='welding'} placeholder={section==='welding'?'Необязательно':'Имя и фамилия'}/>
     </div>
    </section>
    <section className="panel create-card"><div className="create-card-head"><span className="create-card-step">02</span><div><h2>Показатели</h2><p>Значения производственного участка</p></div></div>
     <div className="create-field-grid">
      {section==='welding'
       ? <TextField name="need" value={fields.need} onChange={value=>set('need',value)} label="Потребность, ед." kind="number" required hint="Необходимое количество для сварки"/>
       : <><TextField name="plan" value={fields.plan} onChange={value=>set('plan',value)} label={section==='documents'?'План, док.':'План, ед.'} kind="number" required/>
          <TextField name="fact" value={fields.fact} onChange={value=>set('fact',value)} label={section==='documents'?'Факт, док.':'Факт, ед.'} kind="number" hint="Оставьте пустым, если факт пока неизвестен"/></>}
     </div>
     <p className="create-inline-note"><Info size={16}/>{section==='welding'?'Достоверность обеспеченности зависит от заготовки той же партии.':section==='documents'?'Показатели документации рассчитываются независимо от других участков.':'Необычные или отсутствующие факты будут отмечены как требующие проверки.'}</p>
    </section>
    {error&&<p role="alert" className="form-error">{error}</p>}
    <div className="create-form-actions"><button type="button" className="btn btn-outline" onClick={onCancel}>Отмена</button><button type="submit" disabled={busy} className="btn btn-primary"><Save size={17}/>{busy?'Сохранение…':record?'Сохранить изменения':'Добавить запись'}</button></div>
   </form>
   <aside className="create-record-aside"><article className="panel create-aside-card"><div className="create-aside-icon"><Info size={22}/></div><h3>{titles[section]}</h3><p>Запись будет доступна в журнале соответствующего участка. Расчёты пересчитываются на сервере после сохранения.</p><div className="create-aside-divider"/><div className="create-aside-caption">ПРАВИЛА</div><p>Поля со звёздочкой обязательны. Повторные идентификаторы и сомнительные значения видны в контроле качества.</p></article></aside>
  </div>
 </div>;
}
