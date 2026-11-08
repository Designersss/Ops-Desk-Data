import {createHmac,timingSafeEqual} from 'node:crypto';
import { NextResponse } from 'next/server';
import type { Role, Section } from './model';
const ALL_ROLES:Role[]=['director','preparation','welding','documents'];
const COOKIE='pbs_role';
const maxAge=7*86400;
function key():string{
 const value=process.env.SESSION_SECRET;
 if(!value && process.env.NODE_ENV==='production')throw new Error('SESSION_SECRET должен быть задан в production.');
 return value||'dev-only-not-for-deployments';
}
function mac(data:string){return createHmac('sha256',key()).update(data).digest('base64url');}
export function sessionRole(request:Request):Role|null{
 const cookie=request.headers.get('cookie')||'';
 const token=cookie.split(';').map(part=>part.trim()).find(s=>s.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
 if(token){
  const parts=token.split('.');
  if(parts.length===3){
   const [role,expiry,sig]=parts;
   const msg=role+'.'+expiry;
   const expected=mac(msg);
   if(ALL_ROLES.includes(role as Role)&&Number(expiry)>Date.now()/1000&&sig.length===expected.length){
    if(timingSafeEqual(Buffer.from(sig),Buffer.from(expected)))return role as Role;
   }
  }
 }
 return process.env.NODE_ENV==='production'?null:'director';
}
export function canAccess(role:Role|null,section:Section):boolean{return role==='director'||role===section;}
export function issueRoleCookie(response:NextResponse,role:Role):void{
 const expiry=Math.floor(Date.now()/1000)+maxAge;
 const msg=role+'.'+expiry;
 response.cookies.set(COOKIE,msg+'.'+mac(msg),{httpOnly:true,sameSite:'strict',secure:process.env.NODE_ENV==='production',path:'/',maxAge});
}
export function authenticateRole(role:Role,pin:string):boolean{
 if(process.env.NODE_ENV!=='production')return true;
 const envKey:Record<Role,string|undefined>={
  director:process.env.DIRECTOR_PIN,
  preparation:process.env.PREPARATION_PIN,
  welding:process.env.WELDING_PIN,
  documents:process.env.DOCUMENTS_PIN,
 };
 const expected=envKey[role];
 if(!expected||!expected.trim())return false;
 const a=Buffer.from(pin);
 const b=Buffer.from(expected);
 return a.length===b.length&&timingSafeEqual(a,b);
}
export function sameOrigin(request:Request):boolean{
 const origin=request.headers.get('origin');
 if(!origin)return true;
 try{
  // Next.js may reconstruct Request.url with an internal hostname behind a reverse proxy.
  // Compare the browser Origin with the actual Host that reached the application.
  const requestHost=request.headers.get('host')||new URL(request.url).host;
  return new URL(origin).host.toLowerCase()===requestHost.toLowerCase();
 }catch{return false;}
}
