"use client";
import {useCallback,useEffect,useMemo,useState} from "react";
import type {FormEvent,ReactNode} from "react";
import {db} from "@/lib/supabase";
import Link from 'next/link';
import {QRCodeSVG} from "qrcode.react";
import {CalendarDays,Users,Wallet,Package,Truck,Link2,Scissors,LogOut,RefreshCw} from "lucide-react";
import type {User} from "@supabase/supabase-js";

type Business={id:string;owner_id:string;name:string;slug:string;phone:string|null;plan:string;active:boolean};
type Customer={id:string;name:string;phone:string;email:string|null;visits:number;points:number};
type Service={id:string;name:string;price:number;duration_minutes:number;active:boolean};
type Appt={id:string;customer_id:string;service_id:string;starts_at:string;status:string;price_snapshot:number};
type Cash={id:string;kind:string;amount:number;description:string;created_at:string};
type Product={id:string;name:string;sku:string|null;stock:number;min_stock:number;unit:string;cost:number};
type Supplier={id:string;name:string;phone:string|null;email:string|null};
type Price={id:string;product_id:string;supplier_id:string;price:number;recorded_at:string};
type Order={id:string;supplier_id:string;status:string;created_at:string;notes:string|null};
type OrderItem={id:string;order_id:string;product_id:string;qty:number;unit_price:number};
type Member={user_id:string;role:string};
type Tab='overview'|'appointments'|'customers'|'cash'|'inventory'|'suppliers'|'public'|'team';
const tabs:{id:Tab;label:string;icon:ReactNode}[]=[
{id:'overview',label:'Resumen',icon:<Scissors size={16}/>},{id:'appointments',label:'Reservas',icon:<CalendarDays size={16}/>},
{id:'customers',label:'Clientes',icon:<Users size={16}/>},{id:'cash',label:'Caja',icon:<Wallet size={16}/>},
{id:'inventory',label:'Inventario',icon:<Package size={16}/>},{id:'suppliers',label:'Proveedores',icon:<Truck size={16}/>},
{id:'public',label:'Enlace y QR',icon:<Link2 size={16}/>},{id:'team',label:'Equipo',icon:<Users size={16}/>}
];
const money=(n:number|string)=>`S/ ${Number(n||0).toFixed(2)}`;
const when=(s:string)=>new Date(s).toLocaleString('es-PE',{dateStyle:'short',timeStyle:'short'});
const err=(e:unknown)=>e instanceof Error?e.message:String(e);
const f=(data:FormData,k:string)=>String(data.get(k)||'').trim();
function Field({name,label,type='text',required=true,defaultValue,min,step,placeholder,children}:{name:string;label:string;type?:string;required?:boolean;defaultValue?:string|number;min?:string;step?:string;placeholder?:string;children?:ReactNode}){return <div className="field"><label htmlFor={name}>{label}</label>{children||<input id={name} name={name} type={type} required={required} defaultValue={defaultValue} min={min} step={step} placeholder={placeholder}/>}</div>}
function Form({children,onSubmit,submit}:{children:ReactNode;onSubmit:(d:FormData)=>Promise<void>;submit:string}){
 const [busy,setBusy]=useState(false);
 async function handle(e:FormEvent<HTMLFormElement>){e.preventDefault();const form=e.currentTarget;setBusy(true);try{await onSubmit(new FormData(form));form.reset();}catch(e){alert(err(e));}finally{setBusy(false);}}
 return <form className="form" onSubmit={handle}>{children}<button className="btn" disabled={busy}>{busy?'Guardando...':submit}</button></form>
}
function Table({heads,rows}:{heads:string[];rows:ReactNode[][]}){return <div className="tablewrap"><table className="table"><thead><tr>{heads.map((x,i)=><th key={i}>{x}</th>)}</tr></thead><tbody>{rows.length?rows.map((r,i)=><tr key={i}>{r.map((x,j)=><td key={j}>{x}</td>)}</tr>):<tr><td colSpan={heads.length} className="muted">Todavía no hay registros.</td></tr>}</tbody></table></div>}
export default function Home(){
 const [user,setUser]=useState<User|null>(null),[ready,setReady]=useState(false),[notice,setNotice]=useState('');
 const [businesses,setBusinesses]=useState<Business[]>([]),[businessId,setBusinessId]=useState(''),[tab,setTab]=useState<Tab>('overview');
 const [customers,setCustomers]=useState<Customer[]>([]),[services,setServices]=useState<Service[]>([]),[appts,setAppts]=useState<Appt[]>([]);
 const [cash,setCash]=useState<Cash[]>([]),[products,setProducts]=useState<Product[]>([]),[suppliers,setSuppliers]=useState<Supplier[]>([]);
 const [prices,setPrices]=useState<Price[]>([]),[orders,setOrders]=useState<Order[]>([]),[orderItems,setOrderItems]=useState<OrderItem[]>([]),[members,setMembers]=useState<Member[]>([]);
 const [invite,setInvite]=useState(''),[loading,setLoading]=useState(false);
 const b=businesses.find(x=>x.id===businessId)||null;
 const customerName=(id:string)=>customers.find(x=>x.id===id)?.name||'—';
 const serviceName=(id:string)=>services.find(x=>x.id===id)?.name||'—';
 const productName=(id:string)=>products.find(x=>x.id===id)?.name||'—';
 const supplierName=(id:string)=>suppliers.find(x=>x.id===id)?.name||'—';
 const publicUrl=typeof window==='undefined'||!b?'':`${window.location.origin}/reservar/${b.slug}`;
 const joinUrl=typeof window==='undefined'||!invite?'':`${window.location.origin}/?invite=${encodeURIComponent(invite)}`;
 const fail=(error:{message:string}|null)=>{if(error)throw new Error(error.message)};
 const loadBusinesses=useCallback(async()=>{
  const {data,error}=await db().from('businesses').select('*').order('created_at',{ascending:false});fail(error);
  const items=(data||[]) as Business[];setBusinesses(items);
  setBusinessId(old=>items.some(x=>x.id===old)?old:(items[0]?.id||''));
 },[]);
 const load=useCallback(async(id:string)=>{
  if(!id)return;setLoading(true);
  try{
   const tables=['customers','services','appointments','cash_entries','products','suppliers','supplier_prices','purchase_orders','purchase_order_items','business_members'] as const;
   const results=await Promise.all(tables.map(t=>db().from(t).select('*').eq('business_id',id)));
   const error=results.find(r=>r.error)?.error;if(error)throw error;
   setCustomers((results[0].data||[]) as Customer[]);setServices((results[1].data||[]) as Service[]);
   setAppts((results[2].data||[]) as Appt[]);setCash((results[3].data||[]) as Cash[]);
   setProducts((results[4].data||[]) as Product[]);setSuppliers((results[5].data||[]) as Supplier[]);
   setPrices((results[6].data||[]) as Price[]);setOrders((results[7].data||[]) as Order[]);
   setOrderItems((results[8].data||[]) as OrderItem[]);setMembers((results[9].data||[]) as Member[]);
  }catch(e){setNotice('Error al cargar: '+err(e));}finally{setLoading(false)}
 },[]);
 useEffect(()=>{
  let live=true;let subscription:ReturnType<ReturnType<typeof db>['auth']['onAuthStateChange']>['data']['subscription']|undefined;
  try{const client=db();client.auth.getUser().then(({data})=>{if(live){setUser(data.user);setReady(true);}}).catch(e=>{if(live){setNotice(err(e));setReady(true)}});
   const result=client.auth.onAuthStateChange((_event,session)=>{if(live){setUser(session?.user||null);if(!session){setBusinesses([]);setBusinessId('')}}});subscription=result.data.subscription;
  }catch(e){queueMicrotask(()=>{if(live){setNotice(err(e));setReady(true)}})}
  return()=>{live=false;subscription?.unsubscribe()};
 },[]);
 useEffect(()=>{if(user)loadBusinesses().catch(e=>setNotice(err(e)));},[user,loadBusinesses]);
 useEffect(()=>{if(businessId){let live=true;queueMicrotask(()=>{if(live)void load(businessId)});return()=>{live=false}}},[businessId,load]);
 useEffect(()=>{if(!user)return;const token=new URLSearchParams(window.location.search).get('invite');if(!token)return;
  db().rpc('accept_staff_invite',{p_token:token}).then(({error})=>{setNotice(error?'Invitación: '+error.message:'Te uniste al equipo correctamente');window.history.replaceState({},'', '/');void loadBusinesses();});
 },[user,loadBusinesses]);
 async function act(task:()=>Promise<void>,message='Guardado correctamente'){
  try{await task();setNotice(message);if(businessId)await load(businessId)}catch(e){setNotice('Error: '+err(e));throw e}
 }
 async function insert(table:string,values:Record<string,unknown>){const {error}=await db().from(table).insert({...values,business_id:businessId});fail(error)}
 async function update(table:string,id:string,values:Record<string,unknown>){const {error}=await db().from(table).update(values).eq('id',id).eq('business_id',businessId);fail(error)}
 const stats=useMemo(()=>({upcoming:appts.filter(x=>['pending','confirmed'].includes(x.status)).length,
  income:cash.filter(x=>x.kind==='income').reduce((s,x)=>s+Number(x.amount),0),
  expenses:cash.filter(x=>x.kind==='expense').reduce((s,x)=>s+Number(x.amount),0),
  low:products.filter(x=>x.stock<=x.min_stock).length}),[appts,cash,products]);
 const [gate,setGate]=useState<{key:string;state:string}|null>(null);
 const gateKey=(user?.id||'')+'/'+businessId;
 useEffect(()=>{
  if(!user)return;
  let live=true,revision=0;
  let timer:ReturnType<typeof setTimeout>;
  async function check(){
   const seq=++revision;
   try{
    const account=await db().rpc('account_access');
    if(account.error)throw account.error;
    let state=String(account.data);
    let remaining=60000;
    if(state==='active'&&businessId){
     const expiry=await db().rpc('my_access_until',{b:businessId});
     if(expiry.error)throw expiry.error;
     const ms=Date.parse(String(expiry.data))-Date.now();
     if(!(ms>0))state='expired';else remaining=Math.min(ms,remaining);
    }
    if(live&&seq===revision){
     setGate({key:gateKey,state});
     clearTimeout(timer);
     timer=setTimeout(()=>{if(live){setGate(null);void check()}},Math.max(1,remaining));
    }
   }catch{if(live&&seq===revision)setGate({key:gateKey,state:'error'})}
  }
  function focus(){setGate(null);void check()}
  void check();
  window.addEventListener('focus',focus);
  return ()=>{live=false;clearTimeout(timer);window.removeEventListener('focus',focus)};
 },[gateKey,businessId,user]);
 if(!ready)return <div className="shell">Cargando...</div>;
 if(!user)return <Auth notice={notice}/>;
 if(!gate||gate.key!==gateKey)return <main className="shell">Verificando acceso…</main>;
 if(gate.state==='expired'||gate.state==='error')return <main className="shell"><div className="card"><h1>{gate.state==='expired'?'Acceso suspendido':'No se pudo verificar el acceso'}</h1><p>{gate.state==='expired'?'El acceso a esta barbería ha vencido. Contacta con MACAPP para renovar.':'Recarga la página para volver a intentar.'}</p>{gate.state==='expired'&&<p><Link href="/pagos">Renovar suscripción</Link></p>}<button className="btn" onClick={()=>db().auth.signOut()}>Salir</button></div></main>;
 if(gate.state==='active'&&!b)return <main className="shell">Cargando barbería…</main>;
 if(!b)return <div className="shell"><header className="top"><div className="logo">MAC<span>APP</span></div><button className="btn alt" onClick={()=>db().auth.signOut()}>Salir</button></header><div className="auth"><div className="card"><h2>Crea tu primera barbería</h2><p className="muted">Cada negocio tendrá sus propios datos y un enlace público de reservas.</p>{notice&&<p className="notice">{notice}</p>}<Form submit="Crear barbería" onSubmit={async d=>{await act(async()=>{const {error}=await db().from('businesses').insert({owner_id:user.id,name:f(d,'name'),slug:f(d,'slug').toLowerCase(),phone:f(d,'phone')||null});fail(error);await loadBusinesses()},'Negocio creado')}}><Field name="name" label="Nombre del negocio" placeholder="Barbería Central"/><Field name="slug" label="Enlace único (letras, números y guiones)" placeholder="barberia-central"/><Field name="phone" label="WhatsApp (opcional)" required={false} placeholder="51999999999"/></Form></div></div></div>;
 return <div className="shell"><header className="top"><div className="logo">✂ MAC<span>APP</span></div><div className="row"><select aria-label="Negocio" value={businessId} onChange={e=>setBusinessId(e.target.value)} style={{width:210}}>{businesses.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select><button className="btn alt" title="Actualizar" onClick={()=>load(businessId)}><RefreshCw size={16}/></button><button className="btn ghost" onClick={()=>db().auth.signOut()}><LogOut size={16}/></button></div></header>
 <section className="hero"><div><span className="tag">BARBERÍAS · MVP ETAPAS 1–5</span><h1>{b.name}</h1><p>Reservas, clientes, caja, inventario y proveedores en un solo lugar.</p></div><div><div className="small">Tu enlace público</div><a style={{color:'#f5e8c8',wordBreak:'break-all'}} href={publicUrl} target="_blank" rel="noreferrer">{publicUrl}</a></div></section>
 {notice&&<div className={'notice '+(notice.startsWith('Error')?'error':'')} role="status">{notice} <button className="btn alt" style={{float:'right',padding:'2px 8px'}} onClick={()=>setNotice('')}>×</button></div>}
 <nav className="tabs" aria-label="Secciones">{tabs.map(x=><button key={x.id} className={'tab '+(tab===x.id?'active':'')} onClick={()=>setTab(x.id)}><span className="row" style={{gap:6}}>{x.icon}{x.label}</span></button>)}</nav>
 {loading&&<p className="muted">Actualizando datos...</p>}
 {tab==='overview'&&<><div className="grid"><div className="card"><div className="muted">Clientes</div><div className="stat">{customers.length}</div></div><div className="card"><div className="muted">Citas pendientes</div><div className="stat">{stats.upcoming}</div></div><div className="card"><div className="muted">Ingresos registrados</div><div className="stat">{money(stats.income)}</div></div><div className="card"><div className="muted">Productos en mínimo</div><div className="stat">{stats.low}</div></div></div><div className="card" style={{marginTop:16}}><h3>Para comenzar</h3><p>1. Crea servicios → 2. Registra clientes → 3. Agrega reservas → 4. Comparte el enlace público.</p><p className="muted small">Un mes de prueba gratis. Luego S/ 50 al mes durante los dos primeros meses pagados y S/ 80 al mes desde el tercero.</p><Link href="/pagos">Renovar suscripción</Link></div></>}
 {tab==='customers'&&<div className="card"><h3>Clientes y fidelidad</h3><Form submit="Agregar cliente" onSubmit={d=>act(()=>insert('customers',{name:f(d,'name'),phone:f(d,'phone'),email:f(d,'email')||null}))}><Field name="name" label="Nombre"/><Field name="phone" label="Teléfono"/><Field name="email" label="Correo (opcional)" type="email" required={false}/></Form><Table heads={['Cliente','Teléfono','Visitas','Puntos']} rows={customers.map(x=>[x.name,x.phone,x.visits,x.points])}/></div>}
 {tab==='appointments'&&<div className="grid"><div className="card"><h3>Servicios</h3><Form submit="Crear servicio" onSubmit={d=>act(()=>insert('services',{name:f(d,'name'),price:Number(f(d,'price')),duration_minutes:Number(f(d,'duration'))}))}><Field name="name" label="Servicio" placeholder="Corte clásico"/><Field name="price" label="Precio (S/)" type="number" min="0" step="0.01"/><Field name="duration" label="Duración (min)" type="number" min="10" defaultValue={30}/></Form><Table heads={['Servicio','Precio','Duración']} rows={services.map(x=>[x.name,money(x.price),`${x.duration_minutes} min`])}/></div><div className="card"><h3>Nueva reserva interna</h3><p className="muted small">Usa la página pública para comprobar horarios disponibles; las reservas internas requieren seleccionar un cliente y servicio.</p><Form submit="Crear reserva" onSubmit={d=>act(async()=>{
 const service=services.find(x=>x.id===f(d,'service'));if(!service)throw new Error('Crea un servicio primero');
 const start=new Date(f(d,'starts'));if(isNaN(start.getTime()))throw new Error('Fecha inválida');
 const {error}=await db().from('appointments').insert({business_id:businessId,customer_id:f(d,'customer'),service_id:service.id,starts_at:start.toISOString(),ends_at:new Date(start.getTime()+service.duration_minutes*60000).toISOString(),price_snapshot:service.price});fail(error)
 })}><Field name="customer" label="Cliente"><select name="customer" id="customer" required><option value="">Seleccionar</option>{customers.map(x=><option value={x.id} key={x.id}>{x.name}</option>)}</select></Field><Field name="service" label="Servicio"><select name="service" id="service" required><option value="">Seleccionar</option>{services.filter(x=>x.active).map(x=><option value={x.id} key={x.id}>{x.name}</option>)}</select></Field><Field name="starts" label="Fecha y hora" type="datetime-local"/></Form></div></div>}
 {tab==='appointments'&&<div className="card" style={{marginTop:16}}><h3>Agenda</h3><Table heads={['Fecha','Cliente','Servicio','Estado','Acciones']} rows={[...appts].sort((a,b)=>b.starts_at.localeCompare(a.starts_at)).map(x=>[when(x.starts_at),customerName(x.customer_id),serviceName(x.service_id),<span className="pill" key="s">{x.status}</span>,<div className="actions" key="a">{['pending','confirmed'].includes(x.status)&&<><button className="btn" onClick={()=>act(async()=>{const {error}=await db().rpc('complete_appointment',{p_business:businessId,p_appointment:x.id});fail(error)},'Cita completada, punto de fidelidad e ingreso registrados')}>Completar</button><button className="btn alt" onClick={()=>act(()=>update('appointments',x.id,{status:'cancelled'}))}>Cancelar</button></>}</div>])}/></div>}
 {tab==='cash'&&<div className="card"><h3>Caja</h3><div className="grid"><div><p className="muted">Ingresos</p><h2>{money(stats.income)}</h2></div><div><p className="muted">Gastos</p><h2>{money(stats.expenses)}</h2></div><div><p className="muted">Saldo</p><h2>{money(stats.income-stats.expenses)}</h2></div></div><Form submit="Registrar movimiento" onSubmit={d=>act(()=>insert('cash_entries',{kind:f(d,'kind'),amount:Number(f(d,'amount')),description:f(d,'description'),created_by:user.id}))}><Field name="kind" label="Tipo"><select name="kind" id="kind"><option value="income">Ingreso</option><option value="expense">Gasto</option></select></Field><Field name="amount" label="Monto S/" type="number" min="0.01" step="0.01"/><Field name="description" label="Descripción"/></Form><Table heads={['Fecha','Tipo','Monto','Detalle']} rows={[...cash].sort((a,b)=>b.created_at.localeCompare(a.created_at)).map(x=>[when(x.created_at),x.kind==='income'?'Ingreso':'Gasto',money(x.amount),x.description])}/></div>}
 {tab==='inventory'&&<div className="card"><h3>Inventario</h3><Form submit="Agregar producto" onSubmit={d=>act(()=>insert('products',{name:f(d,'name'),sku:f(d,'sku')||null,min_stock:Number(f(d,'minimum')),cost:Number(f(d,'cost')),stock:0}))}><Field name="name" label="Producto"/><Field name="sku" label="Código (opcional)" required={false}/><Field name="minimum" label="Stock mínimo" type="number" min="0" defaultValue={3}/><Field name="cost" label="Costo S/" type="number" min="0" step="0.01" defaultValue={0}/></Form><Table heads={['Producto','Stock','Mínimo','Costo','Movimiento']} rows={products.map(x=>[x.name,<span key="stock" className={x.stock<=x.min_stock?'tag':''}>{x.stock} {x.unit}</span>,x.min_stock,money(x.cost),<div key="move" className="actions"><button className="btn alt" onClick={async()=>{const raw=prompt('Cantidad que INGRESA al stock:','1');if(!raw)return;const n=Number(raw);if(!Number.isInteger(n)||n<=0)return alert('Ingresa un entero positivo');try{await act(async()=>{const {error}=await db().rpc('move_stock',{p_business:businessId,p_product:x.id,p_delta:n,p_reason:'Entrada manual'});fail(error)})}catch{}}}>+ Entrada</button><button className="btn ghost" onClick={async()=>{const raw=prompt('Cantidad que SALE del stock:','1');if(!raw)return;const n=Number(raw);if(!Number.isInteger(n)||n<=0)return alert('Ingresa un entero positivo');try{await act(async()=>{const {error}=await db().rpc('move_stock',{p_business:businessId,p_product:x.id,p_delta:-n,p_reason:'Salida manual'});fail(error)})}catch{}}}>− Salida</button></div>])}/></div>}
 {tab==='suppliers'&&<div className="grid"><div className="card"><h3>Proveedores</h3><Form submit="Agregar proveedor" onSubmit={d=>act(()=>insert('suppliers',{name:f(d,'name'),phone:f(d,'phone')||null,email:f(d,'email')||null}))}><Field name="name" label="Proveedor"/><Field name="phone" label="WhatsApp (ej. 51999999999)" required={false}/><Field name="email" label="Correo" type="email" required={false}/></Form><Table heads={['Proveedor','WhatsApp']} rows={suppliers.map(x=>[x.name,x.phone||'—'])}/></div><div className="card"><h3>Historial de precios</h3><Form submit="Guardar precio" onSubmit={d=>act(()=>insert('supplier_prices',{supplier_id:f(d,'supplier'),product_id:f(d,'product'),price:Number(f(d,'price'))}))}><Field name="supplier" label="Proveedor"><select id="supplier" name="supplier" required><option value="">Selecciona</option>{suppliers.map(x=><option value={x.id} key={x.id}>{x.name}</option>)}</select></Field><Field name="product" label="Producto"><select id="product" name="product" required><option value="">Selecciona</option>{products.map(x=><option value={x.id} key={x.id}>{x.name}</option>)}</select></Field><Field name="price" label="Precio S/" type="number" min="0" step="0.01"/></Form><Table heads={['Fecha','Proveedor','Producto','Precio']} rows={[...prices].sort((a,b)=>b.recorded_at.localeCompare(a.recorded_at)).map(x=>[when(x.recorded_at),supplierName(x.supplier_id),productName(x.product_id),money(x.price)])}/></div></div>}
 {tab==='suppliers'&&<div className="card" style={{marginTop:16}}><h3>Órdenes de compra</h3><p className="muted small">Se crea un borrador con un producto y cantidad. El envío por WhatsApp abre un mensaje para revisión; no se envía automáticamente.</p><Form submit="Crear orden" onSubmit={d=>act(async()=>{
 const supplier=f(d,'supplier2'),product=f(d,'product2'),qty=Number(f(d,'qty'));
 const latest=prices.filter(x=>x.supplier_id===supplier&&x.product_id===product).sort((a,b)=>b.recorded_at.localeCompare(a.recorded_at))[0];
 const {data,error}=await db().from('purchase_orders').insert({business_id:businessId,supplier_id:supplier,status:'draft'}).select('id').single();fail(error);
 const {error:itemError}=await db().from('purchase_order_items').insert({business_id:businessId,order_id:data!.id,product_id:product,qty,unit_price:latest?.price||0});fail(itemError);
 })}><Field name="supplier2" label="Proveedor"><select id="supplier2" name="supplier2" required><option value="">Selecciona</option>{suppliers.map(x=><option value={x.id} key={x.id}>{x.name}</option>)}</select></Field><Field name="product2" label="Producto"><select id="product2" name="product2" required><option value="">Selecciona</option>{products.map(x=><option value={x.id} key={x.id}>{x.name}</option>)}</select></Field><Field name="qty" label="Cantidad" type="number" min="1" defaultValue={1}/></Form><Table heads={['Fecha','Proveedor','Pedido','Estado','Enviar']} rows={[...orders].sort((a,b)=>b.created_at.localeCompare(a.created_at)).map(o=>{
 const its=orderItems.filter(i=>i.order_id===o.id);const desc=its.map(i=>`${i.qty} x ${productName(i.product_id)} (${money(i.unit_price)}/und)`).join(', ');
 const phone=suppliers.find(s=>s.id===o.supplier_id)?.phone?.replace(/\D/g,'')||'';
 const text=`Hola, quisiera cotizar/confirmar el pedido para ${b.name}: ${desc}. Gracias.`;
 return [when(o.created_at),supplierName(o.supplier_id),desc,o.status,<div className="actions" key={o.id}><button className="btn alt" disabled={!phone} onClick={()=>window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`,'_blank','noopener,noreferrer')}>WhatsApp</button>{o.status==='draft'&&<button className="btn ghost" onClick={()=>act(()=>update('purchase_orders',o.id,{status:'sent'}))}>Marcar enviado</button>}</div>]
 })}/></div>}
 {tab==='public'&&<div className="card"><h3>Tu página de reservas</h3><p>Comparte este enlace por WhatsApp o imprime el QR para que tus clientes reserven sin registrarse.</p><div className="row"><div className="qr"><QRCodeSVG value={publicUrl} size={190} /></div><div><p style={{overflowWrap:'anywhere'}}>{publicUrl}</p><button className="btn" onClick={()=>navigator.clipboard.writeText(publicUrl).then(()=>setNotice('Enlace copiado'))}>Copiar enlace</button> <a className="btn alt" href={publicUrl} target="_blank" rel="noreferrer" style={{display:'inline-block',textDecoration:'none'}}>Abrir página</a></div></div><p className="muted small">Horario piloto fijo: lunes a sábado de 9:00 a 20:00 (Perú). No hay pagos en línea ni mensajes automáticos.</p></div>}
 {tab==='team'&&<div className="card"><h3>Equipo</h3><p>Miembros actuales: {members.length}</p><Table heads={['Usuario ID','Rol']} rows={members.map(x=>[x.user_id,x.role])}/>{user.id===b.owner_id?<><div className="divider"/><p>Genera un enlace de invitación. La persona debe registrarse o iniciar sesión antes de aceptarlo.</p><button className="btn" onClick={async()=>{const {data,error}=await db().rpc('create_staff_invite',{p_business:businessId});if(error)setNotice(error.message);else setInvite(String(data))}}>Crear invitación (7 días)</button>{invite&&<div className="notice" style={{overflowWrap:'anywhere'}}>{joinUrl}<div><button className="btn alt" onClick={()=>navigator.clipboard.writeText(joinUrl).then(()=>setNotice('Invitación copiada'))}>Copiar invitación</button></div></div>}</>:<p className="muted">Solo el dueño puede invitar empleados.</p>}</div>}
 <footer className="footer">MACAPP SaaS · prototipo educativo · Los datos reales requieren políticas de privacidad, backups y pruebas antes de operar comercialmente.</footer></div>
}
function Auth({notice}:{notice:string}){
 const [mode,setMode]=useState<'login'|'signup'>('login'),[message,setMessage]=useState(notice),[busy,setBusy]=useState(false);
 const [pendingEmail,setPendingEmail]=useState('');
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setPendingEmail('');const d=new FormData(e.currentTarget);const email=f(d,'email'),password=f(d,'password');
  try{const r=mode==='login'?await db().auth.signInWithPassword({email,password}):await db().auth.signUp({email,password,options:{emailRedirectTo:window.location.origin+'/auth/callback'+window.location.search}});if(r.error?.code==='email_not_confirmed'){setPendingEmail(email);setMessage('Tu correo está pendiente de confirmación. Abre el mensaje de MACAPP o solicita otro enlace.');return}if(r.error)throw r.error;if(mode==='signup')setMessage('Registro realizado. Si Supabase exige confirmación, revisa tu correo.');}
  catch(e){setMessage(err(e))}finally{setBusy(false)}
 }
 async function resend(){setBusy(true);try{const {error}=await db().auth.resend({type:'signup',email:pendingEmail,options:{emailRedirectTo:window.location.origin+'/auth/callback'+window.location.search}});if(error)throw error;setMessage('Revisa tu bandeja de entrada y spam. Abre el correo de confirmación más reciente.');setPendingEmail('')}catch(e){setMessage(err(e))}finally{setBusy(false)}}
 return <div className="shell"><div className="auth"><div className="card"><div className="logo">✂ MAC<span>APP</span></div><h1>{mode==='login'?'Bienvenido':'Crear cuenta'}</h1><p className="muted">Gestiona tu barbería desde cualquier dispositivo.</p>{message&&<p className="notice" role="status">{message}</p>}{new URLSearchParams(typeof window==='undefined'?'':window.location.search).has('auth_error')&&<p className="notice error">No se pudo completar la confirmación. Revisa la configuración de Auth URL en Supabase.</p>}
 <form onSubmit={submit}><div className="field" style={{marginBottom:12}}><label>Correo</label><input name="email" type="email" required/></div><div className="field" style={{marginBottom:12}}><label>Contraseña (mínimo 6 caracteres)</label><input name="password" type="password" minLength={6} required/></div><button className="btn" style={{width:'100%'}} disabled={busy}>{busy?'Procesando...':mode==='login'?'Iniciar sesión':'Registrarme'}</button></form>
 {pendingEmail&&<button className="btn alt" disabled={busy} onClick={resend}>Reenviar correo de confirmación</button>}<p className="center"><button className="btn ghost" onClick={()=>{setMode(mode==='login'?'signup':'login');setMessage('')}}>{mode==='login'?'Crear una cuenta':'Ya tengo cuenta'}</button></p></div></div></div>
}
