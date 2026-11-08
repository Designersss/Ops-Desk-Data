import type { DashboardMetrics, Issue, IssueCode, ProductionRecord, Range, RecordView, Section } from './model';

const sum = (rows: ProductionRecord[], field: 'plan'|'fact'|'need') =>
  rows.reduce((total,row)=>total+(row[field]??0),0);
const percent = (numerator:number,denominator:number): number|null =>
  denominator>0?Math.round((numerator/denominator)*10000)/100:null;
const inRange=(row:ProductionRecord,range:Range)=> (!range.from||row.date>=range.from) && (!range.to||row.date<=range.to);

export class DataQualityService {
  examine(row: ProductionRecord, all: ProductionRecord[]): Issue[] {
    const issues:Issue[]=[];
    const add=(code:IssueCode,message:string,severity:'warning'|'error'='error')=>{
      issues.push({id:row.id,section:row.section,recordKey:row.recordKey,code,message,severity});
    };
    if(all.some(other=>other.id!==row.id&&other.section===row.section&&other.recordKey===row.recordKey)){
      add('duplicate_key','Повторяется идентификатор записи');
    }
    if(row.section!=='documents'&&row.batchId && all.some(other=>other.id!==row.id&&other.section===row.section&&other.batchId===row.batchId)){
      add('duplicate_batch','Повторяется партия внутри участка');
    }
    if(row.section==='welding'){
      if(row.need===null || row.need<0) add('invalid_need','Некорректное количество потребности');
      return issues;
    }
    if(row.plan===null||row.plan<=0) add('invalid_plan','План должен быть больше нуля');
    if(!row.employee?.trim()) add('missing_employee','Не заполнен сотрудник');
    if(row.fact===null) add('missing_fact','Факт не заполнен','warning');
    else if(row.fact<0) add(row.section==='documents'?'negative_docs_fact':'negative_fact','Отрицательное значение факта');
    else if(row.plan!==null&&row.plan>0&&row.fact>row.plan*3) add('over_300_percent','Факт выше 300% плана — требуется подтверждение','warning');
    return issues;
  }
}

export class OperationsAnalyzer {
  constructor(private readonly quality = new DataQualityService()) {}

  analyze(all:ProductionRecord[], range:Range={}): {rows:RecordView[];metrics:DashboardMetrics} {
    const selected=all.filter(r=>inRange(r,range));
    // Evaluate duplicates against the entire source, not only the currently visible date range.
    const baseIssues=new Map(all.map(r=>[r.id,this.quality.examine(r,all)]));
    const prep=selected.filter(r=>r.section==='preparation');
    const weld=selected.filter(r=>r.section==='welding');
    const docs=selected.filter(r=>r.section==='documents');
    const good=(r:ProductionRecord)=>(baseIssues.get(r.id)?.length??0)===0;
    const goodPrep=prep.filter(good);
    const goodDocs=docs.filter(good);
    const goodWeld=weld.filter(good);
    const prepByBatch=new Map<string,ProductionRecord[]>();
    for(const r of prep){if(!r.batchId)continue;prepByBatch.set(r.batchId,[...(prepByBatch.get(r.batchId)||[]),r]);}
    const weldByBatch=new Map<string,ProductionRecord[]>();
    for(const r of weld){if(!r.batchId)continue;weldByBatch.set(r.batchId,[...(weldByBatch.get(r.batchId)||[]),r]);}

    const enriched:RecordView[]=selected.map(row=>{
      const issues=baseIssues.get(row.id)||[];
      const confirmed=issues.length===0;
      if(row.section!=='welding'){
        return {...row,issues,confirmed,status:confirmed?'confirmed':'attention',coverage:null};
      }
      const sources=row.batchId?prepByBatch.get(row.batchId)||[]:[];
      const peers=row.batchId?weldByBatch.get(row.batchId)||[]:[];
      const validSource=sources.length===1&&good(sources[0])&&peers.length===1&&confirmed;
      if(!validSource)return {...row,issues,confirmed,status:confirmed?'unconfirmed':'attention',coverage:{confirmedFact:null,covered:null,shortage:null,percent:null}};
      const fact=sources[0].fact??0;
      const need=row.need??0;
      const covered=Math.min(fact,need);
      const shortage=Math.max(0,need-fact);
      return {...row,issues,confirmed,status:shortage>0?'shortage':'covered',coverage:{confirmedFact:fact,covered,shortage,percent:percent(covered,need)}};
    });
    const coveredWeld=enriched.filter(r=>r.section==='welding'&&r.coverage?.covered!==null&&r.coverage?.covered!==undefined);
    const validatedNeed=coveredWeld.reduce((total,r)=>total+(r.need??0),0);
    const totalCovered=coveredWeld.reduce((total,r)=>total+(r.coverage?.covered??0),0);
    const daysMap=new Map<string,ProductionRecord[]>();
    for(const r of prep){const items=daysMap.get(r.date)||[];items.push(r);daysMap.set(r.date,items);}
    const days=[...daysMap.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([date,items])=>{
      const included=items.filter(good);
      const plan=included.length?sum(included,'plan'):null;
      const fact=included.length?sum(included,'fact'):null;
      return {date,plan,fact,percent:plan!==null&&fact!==null?percent(fact,plan):null};
    });
    const issues=selected.flatMap(r=>baseIssues.get(r.id)||[]);
    const badRows=selected.filter(r=>(baseIssues.get(r.id)?.length??0)>0).length;
    const metrics:DashboardMetrics={
      preparation:{plan:sum(goodPrep,'plan'),fact:sum(goodPrep,'fact'),percent:percent(sum(goodPrep,'fact'),sum(goodPrep,'plan')),confirmedCount:goodPrep.length,totalCount:prep.length},
      welding:{need:sum(goodWeld,'need'),confirmedNeed:validatedNeed,covered:totalCovered,shortage:coveredWeld.reduce((n,r)=>n+(r.coverage?.shortage??0),0),percent:percent(totalCovered,validatedNeed),linkedCount:coveredWeld.length,totalCount:weld.length,unconfirmedCount:weld.length-coveredWeld.length},
      documents:{plan:sum(goodDocs,'plan'),fact:sum(goodDocs,'fact'),percent:percent(sum(goodDocs,'fact'),sum(goodDocs,'plan')),totalCount:docs.length},
      quality:{problemRows:badRows,linkedUnconfirmed:weld.length-coveredWeld.length,issues},
      days
    };
    return {rows:enriched,metrics};
  }
}
export function statusLabel(row:RecordView):string{
  switch(row.status){
    case 'confirmed':return 'Подтверждено';
    case 'attention':return 'Требует проверки';
    case 'unconfirmed':return 'Связь не подтверждена';
    case 'shortage':return 'Недостаточно';
    case 'covered':return 'Обеспечено';
  }
}
