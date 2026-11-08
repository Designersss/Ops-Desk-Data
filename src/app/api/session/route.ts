import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRole,issueRoleCookie,sameOrigin,sessionRole } from '@/lib/auth';
import { jsonError,HttpError } from '@/lib/http';
import {sectionSchema} from '@/lib/model';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const roleSchema=z.union([z.literal('director'),sectionSchema]);
export async function GET(request:Request){
 try{return NextResponse.json({role:sessionRole(request),pinRequired:process.env.NODE_ENV==='production'},{headers:{'Cache-Control':'no-store'}});}
 catch(e){return jsonError(e);}
}
export async function POST(request:Request){
 try{
  if(!sameOrigin(request))throw new HttpError(403,'Недопустимый источник запроса');
  const body=z.object({role:roleSchema,pin:z.string().max(120).default('')}).parse(await request.json());
  if(!authenticateRole(body.role,body.pin))throw new HttpError(401,'Неверный PIN или роль не настроена');
  const response=NextResponse.json({role:body.role},{headers:{'Cache-Control':'no-store'}});
  issueRoleCookie(response,body.role);
  return response;
 }catch(e){return jsonError(e);}
}
