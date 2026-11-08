import { NextResponse } from 'next/server';
import {sessionRole,sameOrigin} from '@/lib/auth';
import {jsonError,HttpError} from '@/lib/http';
import {SECTIONS,type Section} from '@/lib/model';
import {parseUpload} from '@/lib/importer';
import {replaceDataset} from '@/lib/repository';
export const runtime='nodejs';
export async function POST(request:Request){
 try{
  if(!sameOrigin(request))throw new HttpError(403,'Недопустимый источник запроса');
  if(sessionRole(request)!=='director')throw new HttpError(403,'Импорт доступен только директору');
  const form=await request.formData();
  const replace=form.get('replace')==='true';
  const sources:Array<{section:Section;fileName:string;count:number}>=[];
  const records=[];
  for(const section of SECTIONS){
   const file=form.get(section);
   if(!(file instanceof File))throw new HttpError(422,'Выберите XLSX для '+section);
   const entries=await parseUpload(file,section);
   sources.push({section,fileName:file.name,count:entries.length});
   records.push(...entries);
  }
  const result=await replaceDataset(records,sources,replace);
  return NextResponse.json({...result,sources},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return jsonError(e);}
}
