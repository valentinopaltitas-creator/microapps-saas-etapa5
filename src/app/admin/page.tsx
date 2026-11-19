'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { db } from '../../lib/supabase';
type Shop = {id:string;expiry:string;next_period:number;price:number;total:number;name:string; slug:string; active:boolean; income:number; expenses:number};
const money = (n:number) => new Intl.NumberFormat('es-PE',{style:'currency',currency:'PEN'}).format(n);
export default function Admin(){
  const [now,setNow]=useState(0);
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer)},[]);
  const [query,setQuery]=useState('');
  const [shops,setShops]=useState<Shop[]>([]);
  const [status,setStatus]=useState('Cargando panel…');
  useEffect(()=>{
    let live=true;
    async function refresh(){
      const {data,error}=await db().rpc('platform_overview');
      if(live){setShops(error?[]:data);setStatus(error?'Inicia sesión con la cuenta administradora para ver este panel.':'')}
    }
    const {data}=db().auth.onAuthStateChange(()=>{setTimeout(()=>{if(live)void refresh().catch(()=>{if(live)setStatus('No se pudo cargar el panel.')})},0)});
    return ()=>{live=false;data.subscription.unsubscribe()}
  },[]);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  async function renew(shop:Shop){
    const ref=window.prompt('Confirma que ya recibiste '+money(shop.price)+' por el mes '+shop.next_period+' de '+shop.name+'. Escribe la referencia única del pago:');
    if(!ref?.trim())return;
    setBusy(true);
    try{
      const {data,error}=await db().rpc('record_subscription',{p_business:shop.id,p_reference:ref.trim(),p_period:shop.next_period,p_amount:shop.price});
      if(error)throw error;
      setMessage('Pago registrado. Acceso hasta '+new Date(data).toLocaleDateString('es-PE',{timeZone:'America/Lima'}));
      const result=await db().rpc('platform_overview');
      if(result.error)throw result.error;
      setShops(result.data);
    }catch(e){setMessage(e&&typeof e==='object'&&'message' in e?String(e.message):'No se pudo verificar la operación. Reintenta con la misma referencia.')}
    finally{setBusy(false)}
  }
  const income=shops.reduce((n,b)=>n+Number(b.income),0);
  const expenses=shops.reduce((n,b)=>n+Number(b.expenses),0);
  const filtered=shops.filter(b=>b.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return <main className="shell admin"><header className="top"><strong className="logo">MAC<span>APP</span></strong><Link href="/">Mi barbería</Link></header><h1>Administración general</h1>{status?<p role="status">{status}</p>:<>
  <section className="grid" aria-label="Totales acumulados">{[["Barberías activas",shops.filter(b=>b.active && Date.parse(b.expiry)>now).length],["Ingresos registrados",money(income)],["Gastos registrados",money(expenses)],["Saldo de caja",money(income-expenses)]].map(([title,value])=><article className="card" key={title}><span className="muted">{title}</span><div className="stat">{value}</div></article>)}</section>
  <section className="card"><h2>Barberías ({shops.length})</h2>{shops.length>0&&<label>Buscar por nombre <input className="search" type="search" value={query} onChange={e=>setQuery(e.target.value)}/></label>}{filtered.length?<div className="tablewrap"><table className="table"><thead><tr>{['Negocio','Estado','Ingresos','Gastos','Saldo','Vigencia','Suscripción'].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{filtered.map(b=><tr key={b.slug}><td>{b.name}</td><td>{Date.parse(b.expiry)<=now?'Vencida':b.active?'Activa':'Inactiva'}</td><td>{money(b.income)}</td><td>{money(b.expenses)}</td><td>{money(b.income-b.expenses)}</td><td>{new Date(b.expiry).toLocaleDateString("es-PE",{timeZone:"America/Lima"})}</td><td><button className="btn" disabled={busy} onClick={()=>renew(b)}>Registrar pago · {money(b.price)}</button></td></tr>)}</tbody></table></div>:<p>{shops.length?'Sin coincidencias.':'Aún no hay barberías registradas.'}</p>}</section>
  {message&&<p role="status">{message}</p>}<section className="card"><h2>Ingresos de MACAPP por suscripciones</h2><p>Primer mes de prueba gratis. Primeros dos meses pagados: S/ 50 por mes. Desde el tercer mes pagado: S/ 80 por mes. Total de pagos registrados: {money(shops.reduce((sum,b)=>sum+Number(b.total),0))}.</p></section></>}</main>
}
