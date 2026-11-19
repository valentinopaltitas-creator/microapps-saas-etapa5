import {createHmac,timingSafeEqual} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
function verify(input:string,signature:string,secret:string){
 if(!/^[a-f0-9]{64}$/i.test(signature))return false;
 return timingSafeEqual(createHmac('sha256',secret).update(input).digest(),Buffer.from(signature,'hex'));
}
export async function POST(req:Request){
 const testMode=process.env.VERCEL_ENV!=='production'&&process.env.MP_TEST_MODE==='true';
 const token=process.env.MP_ACCESS_TOKEN,secret=process.env.MP_WEBHOOK_SECRET,key=process.env.SUPABASE_SERVICE_ROLE_KEY,collector=process.env.MP_COLLECTOR_ID;
 if(!token||!secret||!key||!collector)return new Response(null,{status:503});
 if(!/^[!-~]+$/.test(token.trim()))return new Response(null,{status:503});
 const url=new URL(req.url),id=url.searchParams.get('data.id')||'',requestId=req.headers.get('x-request-id');
 const signature=Object.fromEntries((req.headers.get('x-signature')||'').split(',').map(p=>p.trim().split('=')));
 if(!/^\d+$/.test(id)||!requestId||!signature.ts||!verify('id:'+id+';request-id:'+requestId+';ts:'+signature.ts+';',signature.v1||'',secret))return new Response(null,{status:403});
 const r=await fetch('https://api.mercadopago.com/v1/payments/'+id,{headers:{Authorization:'Bearer '+token.trim()},cache:'no-store'});
 if(!r.ok)return new Response(null,{status:502});
 const pay=await r.json();
 if(pay.status!=='approved'||pay.live_mode===testMode||String(pay.id)!==id||String(pay.collector_id)!==collector||pay.currency_id!=='PEN')return new Response(null,{status:200});
 const parts=String(pay.external_reference||'').split(':');
 const [brand,b,p,a,sig]=parts;
 if(parts.length!==5||brand!=='macapp'||!verify(parts.slice(0,4).join(':'),sig,secret)||Number(a)!==pay.transaction_amount)return new Response(null,{status:200});
 if(testMode)return Response.json({ok:true,test:true});
 const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,key);
 const {error}=await db.rpc('apply_mp_payment',{b,p:Number(p),a:Number(a),payment_id:id});
 return new Response(null,{status:error?500:200});
}
