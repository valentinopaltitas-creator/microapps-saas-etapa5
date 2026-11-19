"use client";
import {useEffect,useState} from "react";
import {useParams} from "next/navigation";
import {db} from "@/lib/supabase";
type Service={id:string;name:string;price:number;duration_minutes:number};
type Info={id:string;name:string;slug:string;phone:string|null;services:Service[]};
export default function BookingPage(){
 const params=useParams<{slug:string}>();const slug=params.slug;
 const [info,setInfo]=useState<Info|null>(null),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[message,setMessage]=useState(''),[done,setDone]=useState(false);
 useEffect(()=>{let live=true;db().rpc('get_public_booking_info',{p_slug:slug}).then(({data,error})=>{if(!live)return;if(error)setMessage(error.message);else if(!data)setMessage('No encontramos este negocio.');else setInfo(data as Info);setLoading(false)});return()=>{live=false}},[slug]);
 async function submit(e:React.FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setMessage('');const f=new FormData(e.currentTarget);
  try{const date=new Date(String(f.get('starts')));if(Number.isNaN(date.getTime()))throw new Error('Selecciona una fecha válida');
   const {error}=await db().rpc('create_public_booking',{p_slug:slug,p_service:String(f.get('service')),p_name:String(f.get('name')),p_phone:String(f.get('phone')),p_starts:date.toISOString()});
   if(error)throw error;setDone(true);setMessage('¡Reserva recibida! El negocio podrá confirmarla.');
  }catch(e){setMessage(e instanceof Error?e.message:String(e))}finally{setBusy(false)}
 }
 return <div className="shell"><header className="top"><div className="logo">✂ MAC<span>APP</span></div><span className="muted small">Reservas en línea</span></header><div className="auth" style={{maxWidth:550,marginTop:30}}><div className="card"><h1>{info?.name||'Reservar una cita'}</h1>{loading?<p>Cargando servicios...</p>:!info?<p className="notice error">{message}</p>:done?<div className="notice"><h3>Solicitud registrada</h3><p>{message}</p><button className="btn" onClick={()=>{setDone(false);setMessage('')}}>Hacer otra reserva</button></div>:<><p className="muted">Selecciona el servicio y el horario que prefieras. No necesitas crear una cuenta.</p><p className="muted small">Horario piloto: lunes a sábado, 9:00 a 20:00 (hora de Perú). Reserva con al menos 1 hora de anticipación.</p>{message&&<p className="notice error" role="alert">{message}</p>}
 <form onSubmit={submit}><div className="field" style={{marginBottom:13}}><label htmlFor="service">Servicio</label><select id="service" name="service" required><option value="">Selecciona</option>{info.services.map(s=><option key={s.id} value={s.id}>{s.name} — S/ {Number(s.price).toFixed(2)} · {s.duration_minutes} min</option>)}</select></div>
 <div className="field" style={{marginBottom:13}}><label htmlFor="starts">Fecha y hora</label><input type="datetime-local" id="starts" name="starts" required/></div>
 <div className="field" style={{marginBottom:13}}><label htmlFor="name">Tu nombre</label><input id="name" name="name" minLength={2} maxLength={100} required/></div>
 <div className="field" style={{marginBottom:13}}><label htmlFor="phone">Teléfono de contacto</label><input id="phone" name="phone" minLength={7} maxLength={20} required/></div>
 <button className="btn" disabled={busy||!info.services.length} style={{width:'100%'}}>{busy?'Reservando...':'Solicitar reserva'}</button></form><p className="muted small">Tus datos se compartirán con esta barbería para gestionar la cita. No ingreses información sensible.</p></>}
 </div></div></div>
}
