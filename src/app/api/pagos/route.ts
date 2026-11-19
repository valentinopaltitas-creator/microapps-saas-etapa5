import {cookies} from 'next/headers';
import {createServerClient} from '@supabase/ssr';
import {createHmac} from 'node:crypto';
export async function POST(req:Request){
 const origin=new URL(req.url).origin;
 if(req.headers.get('origin')!==origin)return new Response(null,{status:403});
 const token=process.env.MP_ACCESS_TOKEN,secret=process.env.MP_WEBHOOK_SECRET;
 if(!token||!secret||!process.env.MP_COLLECTOR_ID||!process.env.SUPABASE_SERVICE_ROLE_KEY)return new Response('Pagos pendientes de activación',{status:503});
 if(!/^[!-~]+$/.test(token.trim()))return Response.redirect(origin+'/pagos?error=credencial',303);
 const jar=await cookies();
 const db=createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{cookies:{getAll:()=>jar.getAll(),setAll:()=>{}}});
 const form=await req.formData();
 const {data}=await db.rpc('renewal_options');
 const shop=data?.find((s:{business_id:string;period:number})=>s.business_id===form.get('business')&&String(s.period)===form.get('period'));
 if(!shop)return new Response('Actualiza la página de renovación.',{status:409});
 const ref=['macapp',shop.business_id,shop.period,shop.amount].join(':');
 const sig=createHmac('sha256',secret).update(ref).digest('hex');
 const r=await fetch('https://api.mercadopago.com/checkout/preferences',{method:'POST',headers:{Authorization:'Bearer '+token.trim(),'Content-Type':'application/json'},body:JSON.stringify({items:[{id:ref,title:'MACAPP · '+shop.name+' · mes '+shop.period,quantity:1,currency_id:'PEN',unit_price:shop.amount}],external_reference:ref+':'+sig,notification_url:origin+'/api/pagos/notificacion',back_urls:{success:origin+'/',failure:origin+'/pagos',pending:origin+'/pagos'},auto_return:'approved'})});
  if(!r.ok){
   console.error('Mercado Pago: error al crear preferencia',r.status);
   const reason=r.status===401||r.status===403?'credencial':'proveedor';
   return Response.redirect(origin+'/pagos?error='+reason,303);
 }
 const {init_point}=await r.json();
 return Response.redirect(init_point,303);
}
