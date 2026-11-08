import 'dotenv/config';
import { db } from '../src/lib/db';
import { initialRecords,initialSources } from '../src/lib/seed-data';
import { replaceDataset } from '../src/lib/repository';

async function main(){
 const r=await db().query('SELECT count(*)::int AS n FROM production_records');
 if(r.rows[0].n>0){
  console.log('Existing data detected. Seed skipped; no changes overwritten.');
 }else{
  const result=await replaceDataset(initialRecords,initialSources,false);
  console.log('Seeded',result.records,'source records. Delete XLSX files freely after import.');
 }
 await db().end();
}
main().catch(e=>{console.error(e);process.exitCode=1});
