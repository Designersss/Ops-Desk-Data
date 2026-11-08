import 'dotenv/config';
import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import {Pool} from 'pg';
import {db} from '../src/lib/db';
import {initialRecords,initialSources} from '../src/lib/seed-data';
import {replaceDataset,listRecords,updateRecord,ConflictError} from '../src/lib/repository';
import {OperationsAnalyzer} from '../src/lib/analytics';
const enabled=process.env.INTEGRATION_TEST_DB==='1';
describe.runIf(enabled)('PostgreSQL durability and atomic imports',()=>{
 beforeAll(async()=>{await replaceDataset(initialRecords,initialSources,true);});
 afterAll(async()=>{await replaceDataset(initialRecords,initialSources,true);await db().end();});
 it('retains edited facts across independent connections and recalculates dependent metrics',async()=>{
  const before=await listRecords();
  const row=before.find(r=>r.recordKey==='P-003');
  if(!row)throw new Error('Missing P-003');
  await updateRecord(row.id,row.version,{section:'preparation',recordKey:row.recordKey,date:row.date,batchId:row.batchId,employee:row.employee,plan:row.plan,fact:120,need:null},'preparation');
  const independent=new Pool({connectionString:process.env.DATABASE_URL});
  const persisted=await independent.query('SELECT fact_qty::int AS fact FROM production_records WHERE id=$1',[row.id]);
  await independent.end();
  expect(persisted.rows[0].fact).toBe(120);
  const analysis=new OperationsAnalyzer().analyze(await listRecords());
  expect(analysis.metrics.welding.shortage).toBe(50);
  expect(analysis.metrics.documents.fact).toBe(18);
 });
 it('blocks concurrent stale updates rather than silently overwriting another edit',async()=>{
  const r=(await listRecords()).find(row=>row.recordKey==='P-001');
  if(!r)throw new Error('Missing P-001');
  const input={section:r.section,recordKey:r.recordKey,date:r.date,batchId:r.batchId,employee:r.employee,plan:r.plan,fact:88,need:r.need};
  await updateRecord(r.id,r.version,input,'preparation');
  await expect(updateRecord(r.id,r.version,{...input,fact:99},'preparation')).rejects.toBeInstanceOf(ConflictError);
 });
 it('a second import without explicit confirmation leaves stored edits intact',async()=>{
  await expect(replaceDataset(initialRecords,initialSources,false)).rejects.toBeInstanceOf(ConflictError);
  const r=(await listRecords()).find(row=>row.recordKey==='P-003');
  expect(r?.fact).toBe(120);
 });
});
