import {cookies} from 'next/headers';
import {createServerClient,} from '@supabase/ssr';
import {createClient} from '@supabase/supabase-js';
import {createHmac} from 'node:crypto';
export async function POST(req:Request){
 const origin=new URL(req.url).origin;
 const respond=(message:string,status=200)=>Response.json({message},{status});
 if(req.headers.get('origin')!==origin)return respond('Solicitud inválida',403);
 const testMode=process.env.VERCEL_ENV!=='production'&&process.env.MP_TEST_MODE==='true';
 const access=process.env.MP_ACCESS_TOKEN?.trim(),secret=process.env.MP_WEBHOOK_SECRET,key=process.env.SUPABASE_SERVICE_ROLE_KEY,collector=process.env.MP_COLLECTOR_ID;
 if(!access||!secret||!collector||(!testMode&&!key))return respond('Pago pendiente de activación',503);
 const jar=await cookies();
 const db=createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{cookies:{getAll:()=>jar.getAll(),setAll:()=>{}}});
 const {data:{user}}=await db.auth.getUser();
 if(!user?.email)return respond('Inicia sesión como dueño',401);
 const input=await req.json();
 if(typeof input.token!=='string'||input.token.length>200)return respond('Código inválido',400);
 const {data}=await db.rpc('renewal_options');
 const shop=data?.find((s:{business_id:string;period:number})=>s.business_id===input.business&&s.period===input.period);
 if(!shop)return respond('Actualiza la renovación antes de pagar',409);
 const ref=['macapp',shop.business_id,shop.period,shop.amount].join(':');
 const sign=createHmac('sha256',secret).update(ref).digest('hex');
 const idem=createHmac('sha256',secret).update(user.id+':'+input.token).digest('hex');
 const r=await fetch('https://api.mercadopago.com/v1/payments',{method:'POST',headers:{Authorization:'Bearer '+access,'Content-Type':'application/json','X-Idempotency-Key':idem},body:JSON.stringify({token:input.token,transaction_amount:shop.amount,description:'MACAPP · mes '+shop.period,installments:1,payment_method_id:'yape',payer:{email:user.email},external_reference:ref+':'+sign,notification_url:origin+'/api/pagos/notificacion'})});
 if(!r.ok)return respond('Yape no pudo aprobar la operación. Revisa el código y el estado de tu pago.',422);
 const pay=await r.json();
 if(pay.status!=='approved')return respond('Pago '+(pay.status==='rejected'?'rechazado.':'pendiente de confirmación.'));
 if(pay.live_mode===testMode||String(pay.collector_id)!==collector||pay.currency_id!=='PEN'||pay.transaction_amount!==shop.amount)return respond('El pago requiere revisión del administrador.',409);
 if(testMode)return respond('Prueba aprobada. No se cobró dinero ni se activó una suscripción real.');
 if(testMode)return respond('Prueba aprobada. No se cobró dinero ni se activó una suscripción real.');
 const server=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,key!);
 const {error}=await server.rpc('apply_mp_payment',{b:shop.business_id,p:shop.period,a:shop.amount,payment_id:String(pay.id)});
 return respond(error?'Pago aprobado. La activación está pendiente de conciliación.':'Pago aprobado. Tu acceso ya fue renovado.');
}

