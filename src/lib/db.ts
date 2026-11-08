import { Pool, type PoolClient } from 'pg';
declare global { var __pbsDbPool: Pool | undefined; }
export function db():Pool{
  if(globalThis.__pbsDbPool)return globalThis.__pbsDbPool;
  if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL не задан. Проверьте .env и подключение PostgreSQL.');
  const pool=new Pool({connectionString:process.env.DATABASE_URL,max:10,idleTimeoutMillis:30000,connectionTimeoutMillis:10000});
  if(process.env.NODE_ENV!=='production')globalThis.__pbsDbPool=pool;
  return pool;
}
export async function transaction<T>(fn:(client:PoolClient)=>Promise<T>):Promise<T>{
  const client=await db().connect();
  try{
    await client.query('BEGIN');
    const result=await fn(client);
    await client.query('COMMIT');
    return result;
  }catch(e){await client.query('ROLLBACK');throw e;}
  finally{client.release();}
}
