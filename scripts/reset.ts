import 'dotenv/config';
import {db} from '../src/lib/db';
import {initialRecords,initialSources} from '../src/lib/seed-data';
import {replaceDataset} from '../src/lib/repository';

// Explicit guard: NEVER erase existing edits on ordinary startup or migration.
async function main(){
 if(process.env.CONFIRM_RESET!=='YES'){
  throw new Error('Для удаления всех изменённых записей задайте CONFIRM_RESET=YES перед запуском pnpm db:reset.');
 }
 const result=await replaceDataset(initialRecords,initialSources,true);
 console.log('Replaced existing records with',result.records,'original educational rows.');
 await db().end();
}
main().catch(error=>{console.error(error);process.exitCode=1});
