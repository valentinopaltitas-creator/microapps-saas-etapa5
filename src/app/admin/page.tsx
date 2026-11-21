'use client';
import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import {db} from '../../lib/supabase';
type Shop={id:string;name:string;slug:string;active:boolean;expiry:string;next_period:number;price:number;income:number;customers?:number;appointments?:number};
type Payment={reference:string;business_id:string;amount:number;period:number;ends_at:string};
const money=(n:number)=>new Intl.NumberFormat('es-PE',{style:'currency',currency:'PEN'}).format(Number(n)||0);
export default function Admin(){
 const [shops,setShops]=useState<Shop[]>([]),[payments,setPayments]=useState<Payment[]>([]);
 const [status,setStatus]=useState('Cargando panel…'),[query,setQuery]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const refresh=useCallback(async()=>{
  try{
   const {data,error}=await db().rpc('platform_overview');
   if(error)throw error;
   const rows=Array.isArray(data)?data:data?.businesses;
   if(!Array.isArray(rows))throw new Error('Formato de datos no disponible');
   setShops(rows);setPayments(Array.isArray(data?.payments)?data.payments:[]);setStatus('');
  }catch{setStatus('No se pudo abrir la administración. Inicia sesión con la cuenta administradora y vuelve a intentar.');}
 },[]);
 useEffect(()=>{void refresh();const {data}=db().auth.onAuthStateChange(()=>{setTimeout(()=>void refresh(),0)});return()=>data.subscription.unsubscribe()},[refresh]);
 async function renew(shop:Shop){
  const ref=window.prompt('Confirma que recibiste '+money(shop.price)+' del mes '+shop.next_period+' de '+shop.name+'. Escribe la referencia única del pago:');
  if(!ref?.trim())return;setBusy(true);
  try{const {error}=await db().rpc('record_subscription',{p_business:shop.id,p_reference:ref.trim(),p_period:shop.next_period,p_amount:shop.price});if(error)throw error;setMessage('Pago registrado.');await refresh();}
  catch(e){setMessage(e instanceof Error?e.message:'No se pudo registrar el pago.');}finally{setBusy(false)}
 }
 const filtered=shops.filter(b=>b.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
 return <main className="shell admin"><header className="top"><strong className="logo">MAC<span>APP</span></strong><Link href="/">Mi barbería</Link></header><h1>Administración general</h1><button className="btn" onClick={()=>void refresh()}>Actualizar panel</button>{status?<section className="card"><p role="status">{status}</p><Link href="/">Ir a iniciar sesión</Link></section>:<>
 <section className="grid">{[['Barberías registradas',shops.length],['Barberías activas',shops.filter(b=>b.active&&Date.parse(b.expiry)>Date.now()).length],['Ingresos registrados en barberías',money(shops.reduce((n,b)=>n+Number(b.income||0),0))]].map(([title,value])=><article className="card" key={title}><span className="muted">{title}</span><div className="stat">{value}</div></article>)}</section>
 <section className="card"><h2>Barberías ({shops.length})</h2><label>Buscar por nombre<input type="search" value={query} onChange={e=>setQuery(e.target.value)}/></label><div className="tablewrap"><table className="table"><thead><tr>{['Negocio','Estado','Ingresos','Vigencia','Suscripción'].map(t=><th key={t}>{t}</th>)}</tr></thead><tbody>{filtered.map(b=><tr key={b.id}><td>{b.name}</td><td>{Date.parse(b.expiry)<=Date.now()?'Vencida':b.active?'Activa':'Inactiva'}</td><td>{money(b.income)}</td><td>{b.expiry?new Date(b.expiry).toLocaleDateString('es-PE',{timeZone:'America/Lima'}):'Sin vigencia'}</td><td><button className="btn" disabled={busy} onClick={()=>void renew(b)}>Registrar pago · {money(b.price)}</button></td></tr>)}</tbody></table></div>{!filtered.length&&<p>Sin barberías que mostrar.</p>}</section>
 <section className="card"><h2>Pagos de suscripciones</h2><p>Hasta 100 pagos más recientes. Total de estos registros: {money(payments.reduce((n,p)=>n+Number(p.amount||0),0))}.</p><div className="tablewrap"><table className="table"><thead><tr><th>Negocio</th><th>Referencia</th><th>Mes</th><th>Importe</th></tr></thead><tbody>{payments.map(p=><tr key={p.reference}><td>{shops.find(s=>s.id===p.business_id)?.name||'Negocio'}</td><td>{p.reference}</td><td>{p.period}</td><td>{money(p.amount)}</td></tr>)}</tbody></table></div></section>
 {message&&<p role="status">{message}</p>}</>}</main>;
}
