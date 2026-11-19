# MACAPP

Aplicación SaaS para barberías: agenda, clientes, servicios, caja, inventario, proveedores, reservas públicas y acceso por suscripción. Está construida con Next.js y Supabase.

## Producción

- Aplicación: <https://macapp-barberias.vercel.app>
- Administración de MACAPP: <https://macapp-barberias.vercel.app/admin> (solo la cuenta autorizada como administradora de plataforma)
- Renovación: <https://macapp-barberias.vercel.app/pagos>
- Las variables privadas se guardan en Vercel y no en GitHub. `.env.local` está excluido del repositorio.

## Modelo de acceso

- Cada barbería recibe un mes de prueba desde el primer registro de su dueño.
- Los primeros dos meses pagados cuestan S/ 50 cada uno; luego, S/ 80 por mes.
- La renovación es mensual y la inicia el cliente. No se realiza un cargo automático recurrente.
- La aplicación bloquea el acceso de la barbería vencida hasta que una renovación quede confirmada.
- Mercado Pago puede procesar tarjeta/otros medios disponibles en Checkout y Yape directo. La activación de una renovación depende de una notificación de pago aprobada y validada.

## Ejecutar localmente

1. Instala Node.js LTS y ejecuta `npm install`.
2. Copia `.env.example` a `.env.local` y completa solo los valores necesarios. No publiques `.env.local` ni compartas claves privadas.
3. Ejecuta `npm run dev` y abre <http://localhost:3000>.

## Base de datos

Las migraciones están en `supabase/01_schema.sql` a `supabase/08_checkout.sql`. La primera crea el esquema inicial y solo debe usarse para instalar una base nueva. Las siguientes añaden permisos, rol de administración de plataforma, prueba/acceso, bloqueo por vencimiento, precios y renovaciones.

La instancia de producción ya está configurada. No vuelvas a ejecutar migraciones sobre esa base sin comprobar su estado y respaldos. Para otra instalación, aplica los archivos en orden y revisa primero sus efectos.

## Variables de Vercel

Públicas (pueden exponerse al navegador):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_MP_PUBLIC_KEY`

Privadas (solo servidor):

- `MP_ACCESS_TOKEN`
- `MP_WEBHOOK_SECRET`
- `MP_COLLECTOR_ID`
- `SUPABASE_SERVICE_ROLE_KEY`

Para probar pagos sin cobrar dinero, usa credenciales de prueba de Mercado Pago, su clave pública de prueba y el `MP_COLLECTOR_ID` de prueba en el entorno Preview de Vercel, junto con `MP_TEST_MODE=true`. El modo de prueba responde si el pago simulado fue aprobado, pero nunca registra la renovación ni otorga acceso. Mantén las credenciales de producción separadas en Production.

## Integración de pagos

- La URL de webhook se configura como `https://macapp-barberias.vercel.app/api/pagos/notificacion`.
- El webhook valida la firma, consulta el pago directamente a Mercado Pago, comprueba moneda, cuenta receptora, importe y referencia firmada antes de renovar.
- Yape usa MercadoPago.js para tokenizar celular y OTP; el código OTP no se guarda en MACAPP.
- El flujo de prueba debe verificarse en Preview con los datos de prueba publicados por Mercado Pago. No ingreses un OTP real en un entorno de prueba ni datos de prueba en producción.

## Repositorio y despliegue

La rama principal es `main`. Al estar conectado a Vercel, los commits nuevos en `main` despliegan a Production y las demás ramas generan Preview. Verifica el resultado del despliegue en Vercel antes de compartir una actualización.

## Alcance

El bloqueo y la verificación de renovaciones están implementados en Supabase y en las rutas de pago. Antes de anunciar pagos como completamente verificados, realiza una aprobación con credenciales de prueba y comprueba la respuesta del pago y del webhook. WhatsApp con IA todavía requiere credenciales y una integración de WhatsApp Business; no está activo en producción.
