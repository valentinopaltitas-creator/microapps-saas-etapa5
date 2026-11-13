'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { db } from '../../lib/supabase';
type Shop = {name:string; slug:string; plan:string; active:boolean; income:number; expenses:number};
const money = (n:number) => new Intl.NumberFormat('es-PE',{style:'currency',currency:'PEN'}).format(n);
export default function Admin(){
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
  const income=shops.reduce((n,b)=>n+Number(b.income),0);
  const expenses=shops.reduce((n,b)=>n+Number(b.expenses),0);
  const filtered=shops.filter(b=>b.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return <main className="shell admin"><header className="top"><strong className="logo">MAC<span>APP</span></strong><Link href="/">Mi barbería</Link></header><h1>Administración general</h1>{status?<p role="status">{status}</p>:<>
  <section className="grid" aria-label="Totales acumulados">{[["Barberías activas",shops.filter(b=>b.active).length],["Ingresos registrados",money(income)],["Gastos registrados",money(expenses)],["Saldo de caja",money(income-expenses)]].map(([title,value])=><article className="card" key={title}><span className="muted">{title}</span><div className="stat">{value}</div></article>)}</section>
  <section className="card"><h2>Barberías ({shops.length})</h2>{shops.length>0&&<label>Buscar por nombre <input className="search" type="search" value={query} onChange={e=>setQuery(e.target.value)}/></label>}{filtered.length?<div className="tablewrap"><table className="table"><thead><tr>{['Negocio','Plan','Estado','Ingresos','Gastos','Saldo'].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{filtered.map(b=><tr key={b.slug}><td>{b.name}</td><td>{b.plan}</td><td>{b.active?'Activa':'Inactiva'}</td><td>{money(b.income)}</td><td>{money(b.expenses)}</td><td>{money(b.income-b.expenses)}</td></tr>)}</tbody></table></div>:<p>{shops.length?'Sin coincidencias.':'Aún no hay barberías registradas.'}</p>}</section>
  <section className="card"><h2>Ingresos de MACAPP por suscripciones</h2><p>Pendiente de conectar la facturación. El plan de una barbería por sí solo no acredita un pago.</p></section></>}</main>
}
