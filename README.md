# MicroApps SaaS — Barberías (etapas 1 a 5, versión piloto)

Proyecto **Next.js + Supabase**, preparado para abrir en Visual Studio Code en Windows. Incluye autenticación, multiempresa con RLS, equipo por invitación, clientes, servicios, agenda, caja, puntos de fidelidad, inventario, proveedores, precios históricos, órdenes de compra, página pública de reservas y QR.

> **Estado:** prototipo funcional para pruebas, NO un SaaS listo para vender sin ajustes. Faltan, entre otros: recordatorios automáticos, reportes avanzados, control de comisiones, cierre diario formal, límites y facturación de planes, pasarela, anti-bots/CAPTCHA, copias de seguridad, pruebas automatizadas y protección adicional de permisos/columnas. El QR se visualiza en el panel y se puede imprimir desde el navegador. Las PWA en producción requieren HTTPS e iconos adicionales según dispositivo; el manifiesto ya está incluido.

## 0. Qué necesitas
- Windows 10/11, VS Code, Node.js LTS (preferible versión 24 LTS; Node 26 puede funcionar pero no es LTS), cuenta gratis de Supabase.
- No necesitas contratar hosting ni comprar dominio para probar en tu computadora.

## 1. Descomprimir y abrir el proyecto
1. Descarga el ZIP y usa **Extraer todo**. No trabajes dentro del ZIP.
2. Abre **Visual Studio Code** → **Archivo** → **Abrir carpeta** → selecciona `microapps-saas-etapa5`.
3. Si VS Code pregunta si confías en la carpeta, elige confiar **solo si reconoces el origen del archivo**.
4. Abre **Terminal → New Terminal**. Comprueba `node -v` y `npm.cmd -v`.

## 2. Instalar dependencias
En la terminal, estando dentro de la carpeta que contiene `package.json`, ejecuta:

```powershell
npm.cmd install
```

**Por qué:** descarga Next.js, React y Supabase. **Cómo comprobarlo:** aparece la carpeta `node_modules` y no termina con `npm ERR!`.

Si ves `ENOENT package.json`, abre la carpeta correcta. En PowerShell usa `dir package.json` para comprobar.

## 3. Crear Supabase y las tablas
1. Abre https://supabase.com/dashboard y crea un proyecto (elige una contraseña fuerte y guárdala en lugar seguro).
2. Abre **SQL Editor** → **New query**.
3. Abre el archivo `supabase/01_schema.sql` en VS Code, copia **todo** y pégalo en SQL Editor.
4. Pulsa **Run** una sola vez. Si no hay errores, ve a **Table Editor** y confirma que existen `businesses`, `customers`, `appointments`, `products` y demás tablas.

**Atención:** este SQL está pensado para un proyecto NUEVO de prueba. No lo ejecutes en una base de datos con tablas preexistentes. La SQL contiene funciones SECURITY DEFINER revisadas para este prototipo, pero requiere auditoría de seguridad antes de recibir clientes reales.

## 4. Configurar variables de entorno
1. En la carpeta raíz duplica `.env.example` y nómbralo `.env.local`.
2. En Supabase, ve a **Project Settings → API** o **Connect** (la ubicación cambia según la versión).
3. Copia **Project URL** y la clave **anon/public** (o publishable key compatible) en las dos variables:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-clave-publica
```

**Nunca** pegues `service_role`, `secret key` ni la contraseña de base de datos en estas variables. `.env.local` está excluido de Git mediante `.gitignore`.

## 5. Configurar Auth
1. Supabase → **Authentication → URL Configuration**: `Site URL` = `http://localhost:3000`.
2. Añade `http://localhost:3000/auth/callback` en **Redirect URLs**.
3. Para probar registro por correo: deja **Confirm email** activado (recibirás correo de confirmación), o desactívalo **solo temporalmente en un proyecto de prueba**.
4. Inicio con Google es opcional: primero debes activar Google en **Authentication → Providers** y seguir la configuración de OAuth de Supabase. Si no lo activas, usa correo/contraseña.

## 6. Ejecutar en VS Code
En la terminal:

```powershell
npm.cmd run dev
```

Espera a ver `Ready` y una dirección `http://localhost:3000`. Abre **esa dirección** en el navegador. **No cierres la terminal** mientras usas la web.

Si Next.js muestra `localhost:3001` porque el puerto 3000 está ocupado, abre `http://localhost:3001` y actualiza también las URLs de Supabase.

## 7. Pruebas de cada etapa
**Etapa 1 — Multiempresa:** regístrate, crea `Barbería Prueba` con slug `barberia-prueba`, cierra e inicia sesión. Debe seguir apareciendo. Crea otra cuenta y otro negocio: no debe ver los datos del primero.

**Etapa 2 — Reservas:** abre **Reservas**, crea servicio `Corte` a S/ 20 por 30 minutos; abre **Clientes**, agrega un cliente; vuelve a **Reservas**, crea una cita y pulsa **Completar**. Debe sumar una visita y un punto, además de un ingreso en caja.

**Etapa 3 — Caja:** registra un gasto S/ 5. El saldo debe ser ingresos menos gastos.

**Etapa 4 — Inventario/proveedores:** agrega `Cera`, mínimo 3; pulsa `+ Entrada` e ingresa 2; debe aparecer como stock bajo. Crea un proveedor con WhatsApp en formato `51` + 9 dígitos, registra un precio y crea una orden. El botón WhatsApp abre un mensaje prellenado **sin enviarlo automáticamente**.

**Etapa 5 — Página pública:** abre **Enlace y QR** y entra al enlace `/reservar/barberia-prueba` en una ventana privada. Selecciona servicio, fecha y teléfono. Verifica que la cita aparezca en el panel. Prueba reservar la misma hora de nuevo: debería rechazar el conflicto.

**Equipo:** el dueño genera invitación, comparte enlace y otra persona inicia sesión para aceptarla. El empleado verá el negocio.

## 8. Publicar en GitHub y Vercel (después de probar localmente)
1. Crea un repositorio **privado** en GitHub; usa VS Code Source Control o GitHub Desktop para subir el proyecto. Confirma que `.env.local` **NO** se sube.
2. En https://vercel.com → **Add New Project**, importa el repositorio. **Nota importante:** un negocio comercial puede necesitar un plan Vercel de pago; verifica términos y límites antes de usar el plan Hobby para fines comerciales.
3. En **Environment Variables** de Vercel agrega las mismas dos variables públicas de Supabase; no subas secretos al cliente.
4. Pulsa **Deploy**. Copia la URL `https://tu-proyecto.vercel.app`.
5. En Supabase → **Authentication → URL Configuration**, agrega `https://tu-proyecto.vercel.app/auth/callback` como Redirect URL y ajusta el Site URL según el dominio que uses.
6. Prueba el registro, los datos separados y la reserva pública desde otro dispositivo.
7. Cada nuevo commit en la rama conectada puede activar un despliegue automático.

## 9. Errores comunes
- **`npm no se reconoce`**: instala Node.js LTS, cierra y vuelve a abrir VS Code.
- **`npm.ps1 ejecución deshabilitada`**: usa `npm.cmd` en PowerShell. No hace falta cambiar la política de seguridad.
- **`ENOENT package.json`**: estás en la carpeta incorrecta; ejecuta `dir package.json`.
- **`ERR_CONNECTION_REFUSED`**: ejecuta `npm.cmd run dev` y deja la terminal abierta.
- **`Missing Supabase environment variables`**: revisa `.env.local` y reinicia `npm.cmd run dev`.
- **`relation does not exist` / `Could not find table`**: faltó ejecutar `01_schema.sql` o conectaste a otro proyecto.
- **`row-level security policy`**: comprueba que estás autenticado y eres miembro del negocio.
- **No llega correo de confirmación**: revisa spam y las limitaciones del correo gratuito de Supabase.
- **Google no funciona**: aún no está configurado el proveedor OAuth.
- **`Port 3000 is in use`**: abre la URL que muestra Next.js o detén el proceso anterior con Ctrl+C.

## 10. Advertencias antes de vender
- Añadir rate limiting/CAPTCHA para la RPC pública de reservas y monitorización de abuso. El límite simple por teléfono no impide bots.
- Reforzar permisos de edición: un miembro autenticado del negocio puede editar algunos campos internos mediante API aunque el panel no muestre esa opción. Separar claramente permisos de dueño y empleado, proteger puntos/stock/estados con RPC y permisos por columna.
- Evitar doble reserva también en el panel interno (hoy la protección de solapamientos es exclusiva de la reserva pública).
- Los ingresos se registran al completar una cita; eso **no verifica que el pago realmente se haya cobrado**.
- Ajustar horarios, feriados, barberos, disponibilidad y huso horario por negocio.
- Configurar backups, políticas de privacidad y consentimiento para datos personales, especialmente teléfonos.
- Implementar límites de planes en **backend**, nunca solo ocultando botones.
- Revisar precios, condiciones de Supabase/Vercel y obligaciones tributarias peruanas antes de cobrar.

## Estructura
- `src/app/page.tsx`: panel y autenticación.
- `src/app/reservar/[slug]/page.tsx`: reserva pública.
- `src/app/auth/callback/route.ts`: callback de correo/Google.
- `src/lib/supabase.ts`: cliente Supabase con clave pública.
- `supabase/01_schema.sql`: tablas, RLS y funciones seguras para el prototipo.
- `.env.example`: plantilla de configuración.
