import {createServerClient} from '@supabase/ssr';
import {cookies} from 'next/headers';
import Link from 'next/link';
import Yape from './Yape';


export default async function Payments({searchParams}:{searchParams:Promise<{error?:string}>}){
 const {error:checkoutError}=await searchParams;
 const jar=await cookies();
 const db=createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{cookies:{getAll:()=>jar.getAll(),setAll:()=>{}}});
 const {data,error}=await db.rpc('renewal_options');
 const testMode=process.env.VERCEL_ENV!=='production'&&process.env.MP_TEST_MODE==='true';
 const ready=Boolean(process.env.MP_ACCESS_TOKEN&&process.env.MP_WEBHOOK_SECRET&&process.env.MP_COLLECTOR_ID&&(testMode||process.env.SUPABASE_SERVICE_ROLE_KEY));
 const publicKey=process.env.NEXT_PUBLIC_MP_PUBLIC_KEY||'APP_USR-0d61b43e-5dc3-4526-805c-4771f69c118b';
 return <main className="shell"><Link href="/">Volver a MACAPP</Link><h1>Renovar suscripción</h1>{testMode&&<p>Modo de prueba: no se harán cobros reales ni se activarán suscripciones.</p>}{checkoutError&&<p role="alert">{checkoutError==='credencial'?'Mercado Pago rechazó la autorización de la cuenta vendedora.':'Mercado Pago no pudo crear el pago. Inténtalo de nuevo.'}</p>}{error?<p>Inicia sesión con la cuenta del dueño para renovar.</p>:data?.length?data.map((s:{business_id:string;name:string;period:number;amount:number})=><section className="card" key={s.business_id}><h2>{s.name}</h2><p>Mes pagado {s.period} · S/ {s.amount}</p><p>Pago por un mes de acceso.</p>{(!testMode||!ready)&&<form action="/api/pagos" method="post"><input type="hidden" name="business" value={s.business_id}/><input type="hidden" name="period" value={s.period}/><button className="btn" disabled={!ready}>Pagar con Mercado Pago</button></form>}{ready&&<Yape business={s.business_id} period={s.period} amount={s.amount} publicKey={publicKey}/>}{!ready&&<p>Pago en línea pendiente de activación. Puedes renovar con el administrador.</p>}</section>):<p>Solo el dueño de una barbería puede renovar su suscripción.</p>}</main>;
}

