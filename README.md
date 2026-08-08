# ConexiónCRM · Integración Kommo

CRM inmobiliario multi-asesor sincronizado con Kommo (OAuth, migración, webhooks, chat por canales).

## Stack

- Next.js 16 + TypeScript + Tailwind
- Prisma + SQLite (local) / **Postgres en Vercel (Neon)**
- Hasta ~10 asesores con login; cada uno ve sus leads y chats

## Arranque local

```bash
cp .env.example .env
# Completa KOMMO_* y AUTH_SECRET
# AUTH_SETUP_OPEN=true para la instalación inicial

npm install
npx prisma migrate dev
npm run dev
```

1. Autoriza Kommo en `/configuracion`
2. Ejecuta **Migración completa**
3. En **Equipo**, asigna email + contraseña y rol `admin` a un asesor
4. Pon `AUTH_SETUP_OPEN=false` y reinicia
5. Entra por `/login`

## Chat (canales Kommo)

Usa la API de conversaciones (`/api/v4/talks`). En la integración privada de Kommo habilita scopes:

- External chat history (leer mensajes)
- Sending to external chats (enviar)

Los mensajes salen por el canal ya conectado en Kommo (WhatsApp, Instagram, etc.). Límites mensuales según plan Kommo.

## Deploy en Vercel

1. Crea DB gratis en [Neon](https://neon.tech) y copia `DATABASE_URL`
2. En `prisma/schema.prisma` cambia:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
3. Sube el repo a GitHub y importa en [Vercel](https://vercel.com)
4. Variables de entorno en Vercel:
   - `DATABASE_URL` (Neon)
   - `NEXT_PUBLIC_APP_URL=https://tu-app.vercel.app`
   - `KOMMO_CLIENT_ID`, `KOMMO_CLIENT_SECRET`, `KOMMO_SUBDOMAIN`
   - `KOMMO_REDIRECT_URI=https://tu-app.vercel.app/api/kommo/oauth/callback`
   - `AUTH_SECRET`, `AUTH_SETUP_OPEN=true` (luego `false`)
5. Build command: `prisma generate && prisma migrate deploy && next build`
6. En Kommo, actualiza el Redirect URI al de Vercel
7. Autoriza OAuth, migra, crea admins, registra webhooks con la URL de Vercel

Hostinger compartido (PHP) no sirve para esta app; el dominio de Hostinger sí puede apuntar a Vercel.

## Flujo diario

- **No** hace falta migrar cada lead nuevo
- Webhooks mantienen sync en tiempo real
- Asesores chatean desde `/chat` con sus leads asignados

## Limitaciones

- Historial/chat depende de scopes y plan Kommo
- Archivos multimedia y Salesbot no se migran igual que leads
- Migración completa larga puede timeout en serverless; en cuentas grandes migrar por etapas
