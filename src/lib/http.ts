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
 console.error('PBS API error:',error);
 return NextResponse.json({error:'Серверная ошибка. Проверьте базу данных и журналы.'},{status:500});
}
