import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { ConflictError,NotFoundError } from './repository';

export class HttpError extends Error {
 constructor(public readonly code:number,message:string){super(message);}
}
export function jsonError(error:unknown):NextResponse{
 if(error instanceof HttpError)return NextResponse.json({error:error.message},{status:error.code});
 if(error instanceof ConflictError)return NextResponse.json({error:error.message},{status:409});
 if(error instanceof NotFoundError)return NextResponse.json({error:error.message},{status:404});
 if(error instanceof ZodError)return NextResponse.json({error:'Неверные поля записи',details:error.issues.map(i=>({path:i.path,message:i.message}))},{status:422});
 if(error instanceof SyntaxError)return NextResponse.json({error:'Некорректный JSON'},{status:400});
 // Database connection failures are safe to describe without exposing credentials or SQL.
 const pgCode=(error&&typeof error==='object'&&'code' in error)?String(error.code):'';
 if(['ECONNREFUSED','EHOSTUNREACH','ENOTFOUND','ETIMEDOUT'].includes(pgCode)){
  console.error('PBS PostgreSQL connection failed:',error);
  return NextResponse.json({error:'Нет подключения к PostgreSQL. Проверьте Docker, порт базы данных и DATABASE_URL.'},{status:503});
 }
 if(pgCode==='28P01'){
  console.error('PBS PostgreSQL authentication failed:',error);
  return NextResponse.json({error:'Не удалось войти в PostgreSQL. Проверьте порт и учётные данные в DATABASE_URL.'},{status:503});
 }
 if(pgCode==='42P01'||pgCode==='3D000'){
  console.error('PBS PostgreSQL initialization failed:',error);
  return NextResponse.json({error:'База данных PBS не подготовлена. Проверьте подключение и выполните pnpm db:migrate.'},{status:503});
 }
 console.error('PBS API error:',error);
 return NextResponse.json({error:'Серверная ошибка. Проверьте базу данных и журналы.'},{status:500});
}
