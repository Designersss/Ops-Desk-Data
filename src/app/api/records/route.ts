import { NextResponse } from 'next/server';
import { z } from 'zod';
import { canAccess,sameOrigin,sessionRole } from '@/lib/auth';
import { jsonError,HttpError } from '@/lib/http';
import { createSchema,normalizeInput } from '@/lib/model';
import { addRecord } from '@/lib/repository';
export const runtime='nodejs';
export async function POST(request:Request){
 try{
  if(!sameOrigin(request))throw new HttpError(403,'Недопустимый источник запроса');
  const role=sessionRole(request);
  if(!role)throw new HttpError(401,'Необходим вход');
  const input=normalizeInput(createSchema.parse(await request.json()));
  if(!canAccess(role,input.section))throw new HttpError(403,'Нет доступа к этому участку');
  const saved=await addRecord(input,role);
  return NextResponse.json(saved,{status:201,headers:{'Cache-Control':'no-store'}});
 }catch(e){return jsonError(e);}
}
