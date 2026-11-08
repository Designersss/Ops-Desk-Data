export class ApiError extends Error {
  constructor(public readonly status:number,message:string){super(message);}
}
export async function api<T>(url:string,init?:RequestInit):Promise<T>{
  const response=await fetch(url,{credentials:'same-origin',cache:'no-store',...init});
  if(!response.ok){
    let message='Ошибка запроса';
    try{const body=await response.json() as {error?:string};message=body.error||message;}catch{}
    throw new ApiError(response.status,message);
  }
  return response.json() as Promise<T>;
}
export function jsonRequest(method:'POST'|'PATCH'|'DELETE',payload?:unknown):RequestInit{
  return {method,headers:{'Content-Type':'application/json'},body:payload===undefined?undefined:JSON.stringify(payload)};
}
