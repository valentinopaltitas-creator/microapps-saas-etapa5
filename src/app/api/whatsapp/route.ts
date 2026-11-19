import {createHmac,timingSafeEqual} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';

function equal(a:string,b:string){
  const left=Buffer.from(a),right=Buffer.from(b);
  return left.length===right.length && timingSafeEqual(left,right);
}
export function GET(req:Request){
  const q=new URL(req.url).searchParams;
  const token=process.env.WHATSAPP_VERIFY_TOKEN;
  if(!token)return new Response(null,{status:503});
  if(q.get('hub.mode')!=='subscribe'||!equal(q.get('hub.verify_token')||'',token))return new Response(null,{status:403});
  return new Response(q.get('hub.challenge'));
}
type Service={id:string;name:string};
type Change={value?:{metadata?:{phone_number_id?:string};messages?:{from:string;type:string;text?:{body:string}}[]}};
async function reply(text:string,slug:string){
  const url='https://macapp-barberias.vercel.app/reservar/'+encodeURIComponent(slug);
  const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const {data:shop,error}=await db.rpc('get_public_booking_info',{p_slug:slug});
  if(error)throw error;
  if(!shop)return 'Esta barbería no recibe reservas en este momento.';
  const services:Service[]=shop.services||[];
  if(!services.length)return 'La barbería aún no ha publicado servicios para reservar.';
  const fallback='Servicios de '+shop.name+': '+services.map(s=>s.name).join(', ')+'. Consulta y confirma tu reserva aquí: '+url;
  if(!process.env.OPENAI_API_KEY||!process.env.WHATSAPP_AI_MODEL||!text)return fallback;
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Lima',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const ai=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{Authorization:'Bearer '+process.env.OPENAI_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.WHATSAPP_AI_MODEL,response_format:{type:'json_object'},messages:[{role:'system',content:'Extrae de la solicitud un servicio y fecha explícitos. Responde JSON con service (id del catálogo o null) y day (YYYY-MM-DD o null). Hoy en Lima es '+today+'. Catálogo: '+JSON.stringify(services.map(s=>({id:s.id,name:s.name})))},{role:'user',content:text.slice(0,1000)}]}),signal:AbortSignal.timeout(8000)}).catch(()=>null);
  if(!ai?.ok)return fallback;
  let intent;
  try{intent=JSON.parse((await ai.json()).choices[0].message.content)}catch{return fallback}
  const service=services.find(s=>s.id===intent?.service);
  if(!service||!/^\d{4}-\d{2}-\d{2}$/.test(intent?.day||''))return fallback;
  const {data:slots,error:slotError}=await db.rpc('booking_slots',{p_slug:slug,p_service:service.id,p_day:intent.day});
  if(slotError)return fallback;
  const times=(slots||[]).slice(0,6).map((s:{starts_at:string})=>new Date(s.starts_at).toLocaleTimeString('es-PE',{timeZone:'America/Lima',hour:'2-digit',minute:'2-digit'}));
  return (times.length?service.name+' · '+intent.day+' (hora de Lima): '+times.join(', '):'No quedan horarios para '+service.name+' el '+intent.day)+'. Para elegir y confirmar: '+url;
}
export async function POST(req:Request){
  const secret=process.env.WHATSAPP_APP_SECRET;
  const number=process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token=process.env.WHATSAPP_ACCESS_TOKEN;
  const slug=process.env.WHATSAPP_BUSINESS_SLUG;
  const version=process.env.WHATSAPP_GRAPH_VERSION;
  if(!secret||!number||!token||!slug||!version)return new Response(null,{status:503});
  const raw=Buffer.from(await req.arrayBuffer());
  if(!equal(req.headers.get('x-hub-signature-256')||'','sha256='+createHmac('sha256',secret).update(raw).digest('hex')))return new Response(null,{status:403});
  const event=JSON.parse(raw.toString());
  if(event.object==='whatsapp_business_account'){
    for(const entry of event.entry||[])for(const change of (entry.changes||[]) as Change[]){
      if(change.value?.metadata?.phone_number_id!==number)continue;
      for(const msg of change.value.messages||[]){
        const body=await reply(msg.type==='text'?msg.text?.body||'':'',slug);
        const sent=await fetch('https://graph.facebook.com/'+version+'/'+number+'/messages',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({messaging_product:'whatsapp',to:msg.from,type:'text',text:{body}})});
        if(!sent.ok)return new Response(null,{status:502});
      }
    }
  }
  return new Response(null,{status:200});
}
