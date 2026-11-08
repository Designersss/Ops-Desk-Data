import { NextResponse } from 'next/server';
import { OperationsAnalyzer } from '@/lib/analytics';
import {sessionRole} from '@/lib/auth';
import {jsonError,HttpError} from '@/lib/http';
import {parseRange} from '@/lib/model';
import {listRecords,listImports} from '@/lib/repository';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 try{
  const role=sessionRole(request);
  if(!role)throw new HttpError(401,'Выберите роль и войдите в систему');
  const range=parseRange(new URL(request.url).searchParams);
  const [records,imports]=await Promise.all([listRecords(),listImports()]);
  const {rows,metrics}=new OperationsAnalyzer().analyze(records,range);
  const visible=role==='director'?rows:rows.filter(r=>r.section===role);
  const body={
   role,rows:visible,metrics:role==='director'?metrics:null,
   department:role==='director'?null:metrics[role],
   imports:role==='director'?imports:[],range
  };
  return NextResponse.json(body,{headers:{'Cache-Control':'no-store, max-age=0'}});
 }catch(e){return jsonError(e);}
}
