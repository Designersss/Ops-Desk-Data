import { NextResponse } from 'next/server';
import {canAccess,sameOrigin,sessionRole} from '@/lib/auth';
import {jsonError,HttpError} from '@/lib/http';
import {normalizeInput,updateSchema} from '@/lib/model';
import {listRecords,removeRecord,updateRecord} from '@/lib/repository';
export const runtime='nodejs';
type Context={params:Promise<{id:string}>};
function parseId(raw:string){const n=Number(raw);if(!Number.isSafeInteger(n)||n<1)throw new HttpError(400,'Некорректный идентификатор');return n;}
export async function PATCH(request:Request,{params}:Context){
 try{
  if(!sameOrigin(request))throw new HttpError(403,'Недопустимый источник запроса');
  const role=sessionRole(request);
  if(!role)throw new HttpError(401,'Необходим вход');
  const id=parseId((await params).id);
  const previous=(await listRecords()).find(r=>r.id===id);
  if(!previous)throw new HttpError(404,'Запись не найдена');
  if(!canAccess(role,previous.section))throw new HttpError(403,'Нет доступа к этому участку');
  const payload=updateSchema.parse(await request.json());
  if(payload.record.section!==previous.section)throw new HttpError(422,'Нельзя переносить запись в другой участок');
  return NextResponse.json(await updateRecord(id,payload.version,normalizeInput(payload.record),role),{headers:{'Cache-Control':'no-store'}});
 }catch(e){return jsonError(e);}
}
export async function DELETE(request:Request,{params}:Context){
 try{
  if(!sameOrigin(request))throw new HttpError(403,'Недопустимый источник запроса');
  const role=sessionRole(request);
  if(!role)throw new HttpError(401,'Необходим вход');
  const id=parseId((await params).id);
  const previous=(await listRecords()).find(r=>r.id===id);
  if(!previous)throw new HttpError(404,'Запись не найдена');
  if(!canAccess(role,previous.section))throw new HttpError(403,'Нет доступа к этому участку');
  await removeRecord(id,role);
  return NextResponse.json({deleted:true},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return jsonError(e);}
}
