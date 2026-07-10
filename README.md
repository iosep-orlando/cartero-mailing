# 📧 Mailing SaaS — Envío masivo de emails multitenant

## 🎯 Objetivo del proyecto

Construir un **SaaS multitenant** de email marketing: cada organización (tenant) gestiona sus propios clientes, plantillas y campañas de envío de forma aislada.

Con este proyecto el alumno aprende:

- Qué significa **multitenancy**: varios clientes conviven en la misma base de datos sin verse entre sí.
- **Autenticación passwordless** con magic link + JWT.
- **Plantillas de email** con Handlebars (variables como `{{nombre}}` personalizadas por destinatario).
- Envío SMTP con **Nodemailer** contra **MailHog**, el servidor de correo falso para desarrollo.

## 🏗️ Arquitectura

```
┌────────────┐   JWT    ┌───────────────────┐          ┌──────────┐
│ Dashboard  │ ───────► │  API Routes       │ ───────► │ MongoDB  │
│ (Next.js)  │          │  /api/clients     │          │ (1 tenant│
└────────────┘          │  /api/templates   │          │  por org)│
                        │  /api/campaigns   │          └──────────┘
                        │       │ Nodemailer (SMTP)
                        │       ▼
                        │  ┌─────────────┐  UI web :8025
                        └─►│   MailHog   │ ◄────────────  inspección
                           │   :1025     │                de correos
                           └─────────────┘
```

| Capa | Tecnología |
|------|------------|
| Frontend | Next.js 16 + TypeScript + Tailwind CSS 4 |
| Base de datos | MongoDB (driver nativo, singleton `lib/db.ts`) |
| Plantillas | Handlebars |
| Email | Nodemailer → MailHog (SMTP localhost:1025) |
| Auth | Magic link por email + JWT |

### Estructura de carpetas

```
app/
  login/  auth/verify/        # Flujo de magic link
  dashboard/                  # Layout privado del tenant
    clients/  templates/  campaigns/  attachments/  settings/
  api/
    auth/magic-link, verify, me
    clients/  templates/  campaigns/  attachments/  tenant/
lib/
  db.ts  auth.ts  mail.ts  handlebars.ts  campaign.ts  types.ts
  context/GlobalContext.tsx   # Estado global (usuario, tenant)
scripts/
  seed.ts  import-clients.ts
```

## ⚙️ Funcionalidades

- **Login con magic link**: introduces tu email, recibes un enlace (visible en MailHog) y entras sin contraseña.
- **CRUD de clientes** del tenant, con importación masiva (`scripts/import-clients.ts`).
- **CRUD de plantillas** Handlebars con **preview** renderizado (`/api/templates/preview`).
- **Campañas**: seleccionas plantilla + lista de clientes, y el envío genera un email personalizado por destinatario (`/api/campaigns/[id]/send`).
- **Adjuntos** para las campañas.
- **Dashboard** con métricas del tenant.

## 💡 Solución

1. **Aislamiento por tenant**: cada documento (cliente, plantilla, campaña) lleva su `tenantId`. Toda consulta filtra por el tenant extraído del JWT — un tenant jamás puede leer datos de otro. Esta es la regla de oro del multitenancy.
2. **Magic link**: `POST /api/auth/magic-link` genera un token de un solo uso con caducidad y lo envía por email; `/auth/verify` lo valida y emite el JWT de sesión.
3. **Personalización con Handlebars**: la plantilla se compila una vez y se ejecuta con los datos de cada cliente (`{{name}}`, `{{email}}`...), generando un HTML distinto por destinatario.
4. **MailHog como SMTP de mentira**: acepta cualquier envío y lo muestra en su interfaz web (`localhost:8025`) en vez de entregarlo — imprescindible para desarrollar sin enviar spam real.

## 🚀 Cómo ejecutar

1. Arranca MongoDB local y MailHog en Docker:

```bash
docker run -d -p 1025:1025 -p 8025:8025 mailhog/mailhog
```

2. Crea `.env.local` con `MONGODB_URI`, `JWT_SECRET`, `MAILHOG_HOST=localhost`, `MAILHOG_PORT=1025`.
3. Instala, siembra y arranca:

```bash
npm install
npx tsx scripts/seed.ts
npm run dev
```

4. Abre [http://localhost:3000](http://localhost:3000), pide el magic link y recógelo en [http://localhost:8025](http://localhost:8025).
