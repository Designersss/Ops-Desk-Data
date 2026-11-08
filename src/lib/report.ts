import { OperationsAnalyzer,statusLabel } from './analytics';
import type { ProductionRecord,Range,RecordView } from './model';
const c=(value:unknown):string=>{
 let raw=value===null||value===undefined?'':String(value);
 // Defuse CSV formulas in text fields, while keeping numeric fields readable.
 if(typeof value==='string'&&/^[\s\t\r]*[=+\-@]/.test(raw))raw="'"+raw;
 return '"'+raw.replace(/"/g,'""')+'"';
};
const line=(values:unknown[])=>values.map(c).join(';');
const sectionNames={preparation:'Заготовка',welding:'Потребность сварки',documents:'Документация'};
export function reportCsv(rows:ProductionRecord[],range:Range):string{
 const {rows:filtered,metrics}=new OperationsAnalyzer().analyze(rows,range);
 const lines:string[]=[
  line(['Петро Билдинг Системс','Отчёт по производственным данным']),
  line(['Начало периода',range.from||'Все даты','Конец периода',range.to||'Все даты']),
  '',
  line(['Показатель','Значение','Единица']),
  line(['Заготовка — подтверждённый план',metrics.preparation.plan,'ед.']),
  line(['Заготовка — подтверждённый факт',metrics.preparation.fact,'ед.']),
  line(['Заготовка — выполнение',metrics.preparation.percent,'проценты']),
  line(['Сварка — потребность',metrics.welding.need,'ед.']),
  line(['Сварка — подтверждённая потребность',metrics.welding.confirmedNeed,'ед.']),
  line(['Сварка — покрыто',metrics.welding.covered,'ед.']),
  line(['Сварка — дефицит',metrics.welding.shortage,'ед.']),
  line(['Сварка — обеспеченность подтверждённых связей',metrics.welding.percent,'проценты']),
  line(['Документация — план',metrics.documents.plan,'док.']),
  line(['Документация — факт',metrics.documents.fact,'док.']),
  line(['Документация — выполнение',metrics.documents.percent,'проценты']),
  line(['Строки с проблемами',metrics.quality.problemRows,'записей']),
  line(['Сварка — непроверенные связи',metrics.quality.linkedUnconfirmed,'записей']),
  '',
  line(['Участок','Запись','Дата','Партия','Сотрудник','План','Факт','Потребность','Подтверждена','Статус','Подтверждённая заготовка','Покрытие','Дефицит','Замечания'])
 ];
 for(const r of filtered){
  lines.push(line([sectionNames[r.section],r.recordKey,r.date,r.batchId,r.employee,r.plan,r.fact,r.need,r.confirmed?'Да':'Нет',statusLabel(r),r.coverage?.confirmedFact,r.coverage?.covered,r.coverage?.shortage,r.issues.map(x=>x.message).join(' | ')]));
 }
 lines.push('',line(['Примечание','Неподтверждённые факты исключены из подтверждённых итогов; документация независима.']));
 return '\ufeff'+lines.join('\r\n')+'\r\n';
}
