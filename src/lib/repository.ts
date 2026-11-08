import type { PoolClient } from 'pg';
import { db, transaction } from './db';
import type { ImportStatus, ProductionRecord, RecordInput, Role, Section } from './model';

export class ConflictError extends Error {}
export class NotFoundError extends Error {}

const selectRecords=`SELECT id::int,section,record_key AS "recordKey",work_date::text AS date,
 batch_id AS "batchId",employee,plan_qty::int AS plan,fact_qty::int AS fact,need_qty::int AS need,
 version,created_at::text AS "createdAt",updated_at::text AS "updatedAt"
 FROM production_records`;
export async function listRecords():Promise<ProductionRecord[]>{
 const result=await db().query(selectRecords+' ORDER BY work_date ASC,id ASC');
 return result.rows as ProductionRecord[];
}
export async function listImports():Promise<ImportStatus[]>{
 const result=await db().query(`SELECT section,file_name AS "fileName",row_count AS count,imported_at::text AS "importedAt" FROM import_sources ORDER BY section`);
 return result.rows as ImportStatus[];
}
const insertSql=`INSERT INTO production_records(section,record_key,work_date,batch_id,employee,plan_qty,fact_qty,need_qty)
 VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id::int,version`;
const values=(record:RecordInput)=>[record.section,record.recordKey,record.date,record.batchId,record.employee,record.plan,record.fact,record.need];

async function insert(client:PoolClient,record:RecordInput):Promise<{id:number;version:number}>{
 const r=await client.query(insertSql,values(record));
 return r.rows[0] as {id:number;version:number};
}
async function audit(client:PoolClient,id:number,type:'created'|'updated'|'deleted',role:Role,before:ProductionRecord|null,after:RecordInput|null){
 await client.query(`INSERT INTO audit_events(record_id,event_type,role_name,before_state,after_state) VALUES($1,$2,$3,$4,$5)`,
 [id,type,role,before?JSON.stringify(before):null,after?JSON.stringify(after):null]);
}
export async function addRecord(record:RecordInput,role:Role){
 return transaction(async client=>{
   const result=await insert(client,record);
   await audit(client,result.id,'created',role,null,record);
   return result;
 });
}
export async function updateRecord(id:number,version:number,record:RecordInput,role:Role){
 return transaction(async client=>{
   const current=await client.query(selectRecords+' WHERE id=$1 FOR UPDATE',[id]);
   if(!current.rowCount)throw new NotFoundError('Запись не найдена');
   const original=current.rows[0] as ProductionRecord;
   if(original.section!==record.section)throw new ConflictError('Нельзя изменить участок существующей записи');
   if(original.version!==version)throw new ConflictError('Запись уже была изменена. Обновите страницу.');
   const r=await client.query(`UPDATE production_records SET record_key=$2,work_date=$3,batch_id=$4,employee=$5,plan_qty=$6,fact_qty=$7,need_qty=$8,version=version+1,updated_at=now() WHERE id=$1 RETURNING id::int,version`,[id,record.recordKey,record.date,record.batchId,record.employee,record.plan,record.fact,record.need]);
   await audit(client,id,'updated',role,original,record);
   return r.rows[0] as {id:number;version:number};
 });
}
export async function removeRecord(id:number,role:Role){
 return transaction(async client=>{
   const existing=await client.query(selectRecords+' WHERE id=$1 FOR UPDATE',[id]);
   if(!existing.rowCount)throw new NotFoundError('Запись не найдена');
   const original=existing.rows[0] as ProductionRecord;
   if(role!=='director'&&role!==original.section)throw new ConflictError('Нет доступа к чужому участку');
   await client.query('DELETE FROM production_records WHERE id=$1',[id]);
   await audit(client,id,'deleted',role,original,null);
 });
}
export async function replaceDataset(rows:RecordInput[],sources:Array<{section:Section;fileName:string;count:number}>,replace:boolean){
 return transaction(async client=>{
   // Lock concurrent imports/seeds for the whole transaction.
   await client.query('SELECT pg_advisory_xact_lock(84005123)');
   const existing=await client.query('SELECT count(*)::int AS n FROM production_records');
   if(existing.rows[0].n>0&&!replace)throw new ConflictError('Данные уже загружены. Для замены требуется подтверждение.');
   await client.query('TRUNCATE TABLE production_records, import_sources, audit_events RESTART IDENTITY');
   for(const row of rows)await insert(client,row);
   for(const source of sources)await client.query(
     'INSERT INTO import_sources(section,file_name,row_count) VALUES($1,$2,$3)',
     [source.section,source.fileName,source.count]
   );
   return {records:rows.length};
 });
}
