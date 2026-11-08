import {sessionRole} from '@/lib/auth';
import {jsonError,HttpError} from '@/lib/http';
import {parseRange} from '@/lib/model';
import {listRecords} from '@/lib/repository';
import {reportCsv} from '@/lib/report';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 try{
  if(sessionRole(request)!=='director')throw new HttpError(403,'Отчёт доступен только директору');
  const range=parseRange(new URL(request.url).searchParams);
  const csv=reportCsv(await listRecords(),range);
  const file='pbs-report-'+(range.from||'all')+'-'+(range.to||'all')+'.csv';
  return new Response(csv,{status:200,headers:{
   'Content-Type':'text/csv; charset=utf-8',
   'Content-Disposition':'attachment; filename="'+file+'"',
   'Cache-Control':'no-store',
   'X-Content-Type-Options':'nosniff'
  }});
 }catch(e){return jsonError(e);}
}
