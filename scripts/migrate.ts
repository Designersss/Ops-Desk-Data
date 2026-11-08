import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { db } from '../src/lib/db';
async function main(){
 const schema=readFileSync(join(process.cwd(),'db','schema.sql'),'utf8');
 await db().query(schema);
 console.log('PostgreSQL schema ready');
 await db().end();
}
main().catch(e=>{console.error(e);process.exitCode=1});
