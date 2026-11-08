import ExcelJS from 'exceljs';
import type { RecordInput,Section } from './model';
import { HttpError } from './http';

const headers:Record<Section,string[]>={
 preparation:['record_id','date','batch_id','employee','plan_qty','fact_qty'],
 welding:['record_id','date','batch_id','need_qty'],
 documents:['record_id','date','employee','plan_docs','fact_docs']
};
function unwrap(value:ExcelJS.CellValue):unknown{
 if(value&&typeof value==='object'&&!(value instanceof Date)){
  if('result' in value)return value.result;
  if('text' in value)return value.text;
  if('richText' in value)return value.richText.map(r=>r.text).join('');
 }
 return value;
}
function stringValue(value:unknown,name:string,required=true):string|null{
 if(value===null||value===undefined||value===''){
  if(required)throw new HttpError(422,'Не заполнено обязательное поле: '+name);
  return null;
 }
 if(typeof value!=='string'&&typeof value!=='number')throw new HttpError(422,'Некорректное поле: '+name);
 const text=String(value).trim();
 if(required&&!text)throw new HttpError(422,'Не заполнено поле: '+name);
 if(text.length>200)throw new HttpError(422,'Слишком длинное значение: '+name);
 return text||null;
}
function intValue(value:unknown,name:string,required:boolean):number|null{
 if(value===null||value===undefined||value===''){
  if(required)throw new HttpError(422,'Отсутствует число: '+name);
  return null;
 }
 const n=typeof value==='number'?value:typeof value==='string'&&value.trim()?Number(value):NaN;
 if(!Number.isSafeInteger(n)||Math.abs(n)>1_000_000_000)throw new HttpError(422,'Некорректное целое число: '+name);
 return n;
}
function isoDate(value:unknown):string {
 if(value instanceof Date) {
  if(Number.isNaN(value.getTime()))throw new HttpError(422,'Некорректная дата');
  return value.toISOString().slice(0,10);
 }
 if(typeof value==='number'){
  const date=new Date(Date.UTC(1899,11,30)+Math.round(value*86400000));
  if(Number.isNaN(date.getTime()))throw new HttpError(422,'Некорректная дата');
  return date.toISOString().slice(0,10);
 }
 if(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value))return value;
 throw new HttpError(422,'Неподдерживаемая дата в Excel');
}
export async function parseWorkbook(section:Section,buffer:Buffer):Promise<RecordInput[]>{
 const workbook=new ExcelJS.Workbook();
 try{await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);}
 catch{throw new HttpError(422,'Не удалось прочитать XLSX для участка '+section);}
 const sheet=workbook.getWorksheet('Данные')||workbook.worksheets[0];
 if(!sheet)throw new HttpError(422,'В Excel нет листа с данными');
 const expected=headers[section];
 const actual=expected.map((_,i)=>String(unwrap(sheet.getCell(1,i+1).value)||'').trim());
 if(actual.some((v,i)=>v!==expected[i]))throw new HttpError(422,'Несовпадение колонок для '+section+': ожидаются '+expected.join(', '));
 const output:RecordInput[]=[];
 if(sheet.rowCount>50001)throw new HttpError(413,'В одном файле допускается не более 50 000 строк');
 for(let rowNum=2;rowNum<=sheet.rowCount;rowNum++){
  const values=expected.map((_,i)=>unwrap(sheet.getCell(rowNum,i+1).value));
  if(values.every(value=>value===null||value===undefined||value===''))continue;
  const at=(i:number)=>values[i];
  const rowKey=stringValue(at(0),'record_id')!;
  const date=isoDate(at(1));
  if(section==='preparation'){
   output.push({section,recordKey:rowKey,date,batchId:stringValue(at(2),'batch_id')!,employee:stringValue(at(3),'employee')!,plan:intValue(at(4),'plan_qty',true),fact:intValue(at(5),'fact_qty',false),need:null});
  }else if(section==='welding'){
   output.push({section,recordKey:rowKey,date,batchId:stringValue(at(2),'batch_id')!,employee:null,plan:null,fact:null,need:intValue(at(3),'need_qty',true)});
  }else{
   output.push({section,recordKey:rowKey,date,batchId:null,employee:stringValue(at(2),'employee')!,plan:intValue(at(3),'plan_docs',true),fact:intValue(at(4),'fact_docs',false),need:null});
  }
 }
 if(!output.length)throw new HttpError(422,'Файл '+section+' не содержит записей');
 return output;
}
export async function parseUpload(file:File,section:Section):Promise<RecordInput[]>{
 if(!file.name.toLowerCase().endsWith('.xlsx'))throw new HttpError(422,'Поддерживаются только файлы .xlsx');
 if(file.size>2_000_000||file.size===0)throw new HttpError(413,'Размер каждого файла должен быть от 1 байта до 2 МБ');
 const content=Buffer.from(await file.arrayBuffer());
 return parseWorkbook(section,content);
}
