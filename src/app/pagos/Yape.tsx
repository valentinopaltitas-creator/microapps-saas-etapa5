'use client';
import Script from 'next/script';
import {useState} from 'react';
type YapeSDK={yape:(options:{otp:string;phoneNumber:string})=>{create:()=>Promise<{id:string}>}};
declare global {interface Window {MercadoPago:new(key:string)=>YapeSDK}}
export default function Yape({business,period,amount,publicKey}:{business:string;period:number;amount:number;publicKey:string}){
 const [ready,setReady]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 return <section><Script src="https://sdk.mercadopago.com/js/v2" onReady={()=>setReady(true)}/><h3>Pagar con Yape</h3><form onSubmit={async e=>{
 e.preventDefault();if(busy)return;const form=e.currentTarget,d=new FormData(form);setBusy(true);setMessage('');
 try{
 const sdk=new window.MercadoPago(publicKey);
 const token=await sdk.yape({otp:String(d.get('otp')),phoneNumber:String(d.get('phone'))}).create();
 form.reset();
 const r=await fetch('/api/pagos/yape',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({business,period,token:token.id})});
 const result=await r.json();setMessage(result.message);
 }catch{setMessage('No se pudo confirmar el pago. Revisa tu renovación antes de volver a intentar.')}finally{setBusy(false)}
 }}><label>Celular asociado a Yape<input name="phone" inputMode="numeric" pattern="[0-9]{9}" maxLength={9} required autoComplete="tel"/></label><label>Código de aprobación de Yape<input name="otp" type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required autoComplete="off"/></label><p>Genera el código en Yape y autoriza el pago de S/ {amount} por un mes.</p><button className="btn" disabled={!ready||busy}>{busy?'Procesando…':'Pagar S/ '+amount+' con Yape'}</button></form><p role="status">{message}</p></section>
}
