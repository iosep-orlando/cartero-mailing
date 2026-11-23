# Cartero · SaaS de email marketing multitenant

Cartero es un servicio de campañas de email para varias organizaciones a la
vez. Cada organización tiene sus propios clientes, plantillas y campañas, y
no ve las de las demás. Se entra sin contraseña, con un enlace que llega por
mail. Las plantillas usan variables de Handlebars (`{{firstName}}`), y cada
campaña manda un mail personalizado por destinatario, en segundo plano, con
enlace de baja y seguimiento de aperturas y clics.

El enunciado original está en [README-enunciado.md](README-enunciado.md).

## Demo

**https://cartero-mailing.onrender.com** *(se completa al publicar; ver «Despliegue»)*

La versión publicada **no manda mails de verdad**: los guarda y los muestra
en la [bandeja de demo](https://cartero-mailing.onrender.com/bandeja), que
cumple el papel de MailHog. Para probarla:

1. Entrá con un email inventado, por ejemplo `tu-nombre@demo.test`.
2. Abrí la bandeja de demo y usá el enlace del mail.
3. Creá tu organización, cargá clientes, armá una plantilla y mandá una
   campaña.
4. Los mails de la campaña también aparecen en la bandeja, buscando por el
   email de cada cliente.

El plan gratuito de Render se duerme sin visitas: la primera carga puede
tardar un minuto.

## Stack

| Capa | Tecnología |
|------|------------|
| Frontend | Next.js 16.4 (App Router, Cache Components), React 19, Tailwind CSS 4 |
| Base de datos | MongoDB (driver nativo, un cliente por proceso en `lib/db.ts`) |
| Autenticación | Magic link por email + JWT (`jose`) en cookie `httpOnly` |
| Plantillas | Handlebars |
| Email | Nodemailer → MailHog en desarrollo; bandeja en la base en la demo |
| Tests | Vitest con cobertura v8 |
| CI | GitLab CI: lint, tipos y tests con cobertura |

## Cómo funciona

```
 Navegador                         Next.js (servidor)                          Servicios
┌──────────────────┐   cookie   ┌────────────────────────────────────┐
│ /login           │   con JWT  │ proxy.ts: ¿sesión? ¿organización?   │
│ /auth/verify     │ ─────────► ├────────────────────────────────────┤     ┌──────────┐
│ /dashboard/…     │            │ API: /api/clients, /templates,      │ ──► │ MongoDB  │
│  (GlobalContext: │            │ /campaigns, /attachments, /tenant   │     │ todo con │
│   usuario + org) │            │ ↳ requireTenant(): el tenantId sale │     │ tenantId │
└──────────────────┘            │   del JWT y se confirma en la base  │     └────▲─────┘
                                ├────────────────────────────────────┤          │ cola de
 Destinatario                   │ worker (instrumentation.ts)         │ ─────────┘ envíos
┌──────────────────┐            │ cada 2 s: programadas que tocan +   │     ┌──────────┐
│ abre el mail ────┼── píxel ──►│ una tanda de mails pendientes       │ ──► │ MailHog  │
│ hace clic ───────┼── /api/t/c►│ (Nodemailer, SMTP)                  │     │ :1025    │
│ se da de baja ───┼── /baja ──►│                                     │     │ UI :8025 │
└──────────────────┘            └────────────────────────────────────┘     └──────────┘
```

### Multitenancy: la regla de oro

Todo lo que pertenece a una organización (clientes, plantillas, campañas,
envíos, adjuntos) lleva `tenantId`, y toda consulta lo filtra:

- **El tenant sale del JWT, nunca de la petición.** Un id de organización en
  la URL o en el cuerpo se ignora.
- **Cada llamada a la API confirma en la base que el usuario sigue siendo
  miembro** (`requireTenant()` en `lib/auth.ts`). Si el dueño lo quita, deja
  de ver los datos en el momento, sin esperar a que caduque la sesión.
- **Un recurso de otra organización da 404, no 403**, así no se revela ni
  que existe: `{ _id, tenantId }` simplemente no encuentra nada.
- **Los índices únicos empiezan por `tenantId`.** El mismo email puede ser
  cliente de dos organizaciones sin que se pisen.

### Entrar con un enlace

1. **El usuario escribe su email** y `POST /api/auth/magic-link` genera un
   token de 32 bytes al azar. En la base se guarda solo su hash SHA-256, con
   vencimiento a los 15 minutos.
2. **El mail lleva `/auth/verify?token=…`.** Esa página muestra un botón
   **«Entrar a Cartero»**, y es el botón el que canjea el token
   (`POST /api/auth/verify`). Abrir el enlace no alcanza, porque los
   antivirus de correo abren los enlaces para revisarlos y gastarían el
   token antes que la persona.
3. **El canje es atómico y de un solo uso.** Crea la cuenta si es la
   primera vez, convierte las invitaciones pendientes en membresías y abre
   la sesión.
4. **Sin organización, pasa a `/onboarding`** para crear una; con
   organización, entra al panel.

### Enviar una campaña

```
draft ──(enviar ahora)───────────────► sending ──► sent
  │  ▲                                    ▲
  │  └──(cancelar programación)──┐        │
  └──(programar)──────────► scheduled ────┘ (llega la hora)
```

1. **«Enviar ahora» no manda nada todavía.** Pasa la campaña a `sending` con
   una actualización condicional (dos clics no duplican), guarda una **copia
   de la plantilla** y crea un **envío pendiente por destinatario**: los
   clientes suscritos que tengan alguna de las etiquetas elegidas. Responde
   enseguida (202).
2. **El worker, que corre dentro del mismo servidor, va cada 2 segundos a la
   cola.** «Reclama» cada mail con una actualización atómica, lo arma (con
   la plantilla, el enlace de baja, el seguimiento y los adjuntos) y lo
   manda.
3. **Si el servidor de correo no acepta el mail, depende del motivo**
   (decisión 5):
   - pasajero (buzón lleno, servidor caído): vuelve a la cola y se reintenta
     a los 30 segundos, hasta 3 veces;
   - definitivo (la dirección no existe): queda **Falló** enseguida, con el
     motivo a la vista, y el cliente queda como **Rebotó**.
4. **La pantalla de la campaña muestra el progreso** consultando cada
   2 segundos. Cuando no queda nada pendiente, la campaña pasa a
   **Enviada**.

**Ver cómo llega.** Antes o después del envío, la campaña muestra el mail
armado para cualquiera de sus destinatarios: remitente, asunto, adjuntos y
contenido con el pie de baja, igual que lo arma el worker. Antes del envío
usa la plantilla actual; después, la copia que se envió. Los enlaces de esa
vista no cuentan clics ni dan de baja a nadie.

### Colecciones

| Colección | Campos clave | Índices |
|-----------|--------------|---------|
| `users` | `email`, `name` | `email` único |
| `tenants` | `name` | — |
| `memberships` | `tenantId`, `userId`, `role` (`owner`\|`member`) | `tenantId`+`userId` único |
| `invitations` | `tenantId`, `email` | `tenantId`+`email` único |
| `loginTokens` | `tokenHash`, `email`, `expiresAt`, `usedAt` | `tokenHash` único, TTL en `expiresAt` |
| `clients` | `tenantId`, `email`, `name`, `tags[]`, `unsubscribed`, `bounced`, `bounceReason` | `tenantId`+`email` único, `tenantId`+`tags` |
| `templates` | `tenantId`, `name`, `subject`, `html` | `tenantId`+`updatedAt` |
| `campaigns` | `tenantId`, `templateId`, `tags[]`, `attachmentIds[]`, `status`, `snapshot`, `scheduledAt`, `counts` | `tenantId`+`createdAt`, `status`+`scheduledAt` |
| `deliveries` | `campaignId`, `clientId`, `email`, `status`, `attempts`, `lockedUntil`, `openedAt`, `clickedAt` | `campaignId`+`clientId` único, `status`+`lockedUntil` |
| `attachments` | `tenantId`, `filename`, `contentType`, `size`, `data` (binario) | `tenantId`+`createdAt` |
| `outbox` | `to`, `subject`, `html` (solo la demo) | TTL de 3 días |

## Cómo ejecutar

Necesitás Node.js 22 y Docker.

```bash
cp .env.example .env.local          # completá JWT_SECRET y SEED_OWNER_EMAIL
npm install
docker compose up -d mailhog        # y "mongo" si no tenés ya un MongoDB en el 27017
npm run seed                        # una organización de ejemplo con 8 clientes
npm run dev                         # http://localhost:3000
```

- `JWT_SECRET`: un texto largo al azar, por ejemplo la salida de
  `openssl rand -base64 32`.
- `MONGODB_URI`: si ya tenés un MongoDB (de otro proyecto), poné su cadena:
  Cartero usa su propia base, `mailing`.

Para probarlo:

1. Entrá con el email de `SEED_OWNER_EMAIL`.
2. El enlace aparece en MailHog, en **http://localhost:8025**: abrilo y
   pulsá **Entrar a Cartero**.
3. En **Campañas** está el borrador «Novedades de diciembre», para clientes
   con la etiqueta `vip`. Pulsá **Enviar ahora** y mirá llegar los mails a
   MailHog, uno por cliente y con su nombre.
4. Abrí uno y hacé clic en el botón: la campaña suma la apertura y el clic.
   El enlace del pie da de baja a ese cliente.

### Importar clientes

Desde el panel: **Clientes → Importar CSV**. Por línea de comandos, para
listas grandes:

```bash
npm run import-clients -- duenio@ejemplo.com clientes.csv
```

- La primera fila lleva los títulos `email`, `nombre` y `etiquetas`
  (también en inglés).
- Sirve el CSV que guarda Excel en español, con punto y coma.
- Si un email ya existe, se actualiza. Si ese cliente se había dado de baja,
  **sigue de baja**.

## Despliegue

La demo corre en **Render** (plan gratuito), con la base en **MongoDB
Atlas** (clúster gratuito). La configuración está en
[`render.yaml`](render.yaml).

| Pieza | Servicio | Plan |
|-------|----------|------|
| App Next.js + worker | Render, servicio web (Virginia) | Free |
| Base de datos | MongoDB Atlas, AWS N. Virginia (`us-east-1`) | Free (M0) |
| Correo | Bandeja de demo en la propia base (`MAIL_TRANSPORT=outbox`) | Sin costo |

1. **Base.** Sirve el mismo clúster de Atlas de otros proyectos: Cartero usa
   la base `mailing`. Hace falta la cadena `mongodb+srv://…`, y en *Network
   Access* tiene que estar `0.0.0.0/0` (Render gratis no tiene IP fija).
2. **Código en GitHub**, porque Render no se conecta al GitLab de la
   academia: `gh repo create cartero-mailing --public --source=. --remote=github --push`.
3. **Servicio.** En Render, *New → Blueprint* con ese repositorio. Render
   lee `render.yaml`, inventa `JWT_SECRET` solo y pide `MONGODB_URI`.
4. **Datos de ejemplo** (opcional), desde tu máquina:
   `MONGODB_URI='mongodb+srv://…' SEED_OWNER_EMAIL=dueno@demo.test npm run seed`.
5. **Comprobar.** Entrá con un email `@demo.test`, sacá el enlace de
   `/bandeja` y mandá una campaña: sus mails aparecen en la bandeja.

Lo que implica el plan gratuito:

- **El worker vive dentro del servicio.** Mientras Render duerme (a los
  15 minutos sin visitas), una campaña programada no sale: sale apenas
  alguien entra y el servicio despierta. En un servidor que no duerme, sale
  a su hora (con 2 segundos de margen).
- **Atlas pausa el clúster tras 30 días sin conexiones.** Se reactiva desde
  su panel.

## Tests y cobertura

```bash
npm test                # 46 tests
npm run test:coverage   # con informe (coverage/index.html)
npm run lint
npm run typecheck
```

| Métrica | Cobertura |
|---------|-----------|
| Líneas | 100 % |
| Ramas | 90,8 % |
| Funciones | 100 % |

La cobertura se mide sobre la lógica que se prueba sin servicios en marcha:
validación, CSV, plantillas, enlaces firmados, armado de cada mail,
transportes de correo, sesión y `proxy.ts`.

Las rutas, las consultas y el worker se probaron de punta a punta en el
navegador, con un SMTP de prueba que guardaba cada mail:

- Ingreso con enlace; enlace reusado (rechazado); límite de 3 enlaces.
- Clientes a mano y por CSV (con una fila inválida); plantilla con vista
  previa.
- Campaña segmentada por etiqueta, con adjunto. Llegaron 5 mails
  personalizados, con `List-Unsubscribe`.
- Apertura y clic: contados una vez por persona. Un destino de clic
  cambiado da 400.
- Baja desde la página y en un clic (como Gmail). Una firma falsa da 400.
- Una segunda organización recibe **404** en los 6 intentos de leer,
  editar, borrar o enviar datos ajenos. Crear una campaña con una plantilla
  ajena da 400, y cambiarse a esa organización, 403.
- El invitado entra directo como miembro. Un miembro no puede invitar.
  Quitado, deja de ver al momento.
- Campaña programada a +65 s: salió 1 segundo después de la hora pedida.
- **SMTP caído durante un envío:** los mails quedaron en cola con el motivo
  y salieron todos al volver el servidor.
- Rebotes, con un SMTP de prueba que contesta como uno real:
  - `noexiste@` (550): **Falló** en el primer intento, y el cliente quedó
    **Rebotó** y fuera de la audiencia;
  - `lleno@` (452): quedó en cola para reintentar;
  - al corregir el email, el cliente volvió a la audiencia.
- «Ver cómo llega»: el mail armado para cada destinatario, con el pie de
  baja.
- Bandeja de demo: se entra con el enlace de la bandeja y llega la campaña
  con su adjunto.

## Decisiones de diseño

Cada una con su contexto, lo que se eligió y lo que trae.

### 1. Aislamiento por tenant con doble comprobación

- **Contexto.** Varias organizaciones comparten la base. Un error en un solo
  filtro expone los clientes de otra.
- **Decisión.**
  - Todas las rutas usan `requireTenant()`, que toma el tenant del JWT y
    comprueba la membresía en la base.
  - Todas las consultas filtran por `{ _id, tenantId }`. Lo ajeno da 404.
  - Al crear o editar una campaña se valida que la plantilla y los adjuntos
    sean de la misma organización.
- **Consecuencias.** Una consulta más por petición (la membresía), a cambio
  de que quitar a alguien corte su acceso al instante. Probado en el
  navegador con dos organizaciones.

### 2. Magic link de un solo uso, con botón

- **Contexto.**
  - Un enlace para entrar es una contraseña de un rato.
  - Los antivirus de correo abren los enlaces para revisarlos.
- **Decisión.**
  - Token de 32 bytes al azar; en la base solo su hash SHA-256.
  - Vence a los 15 minutos (índice TTL que lo borra solo) y se canjea con
    una actualización atómica (`usedAt: null`).
  - Máximo 3 enlaces cada 10 minutos por email.
  - Se canjea con un botón, no al abrir la página.
- **Consecuencias.**
  - Quien lea la base no puede entrar.
  - El formulario no sirve para llenarle el buzón a otro.
  - El escaneo del antivirus no gasta el enlace.
  - El costo es un clic más.

### 3. Organizaciones: dueño e invitados

- **Contexto.** El enunciado pide multitenancy, pero no cómo se entra a una
  organización.
- **Decisión.**
  - El primer ingreso crea la organización y su creador es el dueño.
  - El dueño invita por email:
    - si esa persona ya tiene cuenta, entra al momento;
    - si no, la invitación espera a su primer ingreso.
  - Una persona puede pertenecer a varias organizaciones y cambiar de una a
    otra desde la cabecera. La organización activa viaja en el JWT.
- **Consecuencias.** Hay roles (dueño y miembro). Invitar, quitar miembros y
  cambiar el nombre son solo del dueño.

### 4. Envío en segundo plano con la cola en MongoDB

- **Contexto.** Mandar cientos de mails dentro de la petición del botón
  supera cualquier tiempo de espera. Además, si se corta a la mitad, no se
  sabe quién recibió y quién no.
- **Decisión.**
  - Un worker dentro del mismo proceso, arrancado desde
    `instrumentation.ts`.
  - La cola son los propios documentos `deliveries`.
  - Cada mail se reclama con `findOneAndUpdate` y un turno de 2 minutos
    (`lockedUntil`).
  - Hasta 3 intentos, con 30 segundos entre uno y otro.
  - Ritmo configurable (`MAIL_RATE_PER_MINUTE`, por defecto 120).
- **Consecuencias.**
  - Sin Redis ni otro servicio.
  - Si el servidor se reinicia, sigue donde quedó.
  - Con varias instancias, ninguna manda el mismo mail dos veces.
  - Probado cortando el SMTP en medio de un envío: los mails esperaron en la
    cola y salieron todos al volver.

### 5. Rechazos y rebotes: reintentar solo lo que puede mejorar

- **Contexto.** Una dirección bien escrita puede no existir, y el servidor
  de correo puede estar caído o lleno. Hay que distinguirlos: reintentar una
  dirección que no existe no sirve, y seguir mandándole daña la reputación
  del remitente ante Gmail y los demás.
- **Decisión.** El worker lee el código de respuesta del servidor SMTP
  (`classifySendError` en `lib/campaign.ts`):
  - **4xx** (buzón lleno, «probá más tarde») y errores de conexión: se
    reintenta, hasta 3 veces;
  - **550, 551 y 553** (la dirección no existe o no es válida): falla en
    el primer intento, y el cliente queda como **Rebotó**. No recibe más
    campañas hasta que se corrija su email; al corregirlo, vuelve;
  - **otros 5xx** (por ejemplo, rechazado como spam): falla sin reintentar,
    pero el cliente no queda marcado, porque no es culpa de la dirección;
  - **usuario o clave del SMTP mal**: falla con un mensaje que apunta a la
    configuración.
- **Consecuencias.**
  - «Enviado» significa «aceptado por nuestro servidor de correo», no
    «llegó a la bandeja».
  - Si el servidor del destinatario rechaza el mail más tarde, avisa con
    un mail de rebote al remitente, o con un webhook si se usa un proveedor
    como Brevo o SendGrid. Procesar esos avisos y marcar al cliente sería
    el paso siguiente; con MailHog o la bandeja de demo, que aceptan todo,
    no hay rebotes que recibir.
  - Las direcciones mal escritas (`ana@gmail`, `ana gmail.com`) no llegan a
    este punto: se rechazan al cargarlas o al importar el CSV.

### 6. La campaña copia la plantilla al empezar

- **Contexto.** Si alguien edita la plantilla mientras la campaña se envía,
  la mitad de los destinatarios recibiría otro texto.
- **Decisión.** Al pasar a `sending`, la campaña guarda una copia
  (`snapshot`) del asunto, el HTML y el nombre de la organización. El worker
  usa esa copia.
- **Consecuencias.** Todos reciben exactamente lo mismo. Una plantilla que
  usa una campaña sin enviar no se puede borrar (409).

### 7. Handlebars con escape, salvo en el asunto

- **Contexto.** Los datos de los clientes vienen de CSV que cualquiera
  arma: un nombre puede traer HTML.
- **Decisión.**
  - Una instancia propia de Handlebars, que escapa el HTML de las variables.
  - Desde la versión 4.6 bloquea el acceso al prototipo; hay un test que lo
    intenta.
  - **El asunto se compila sin escape**, porque es texto: «Rayuela & Cía»
    llegaba como «Rayuela &amp;amp; Cía» (lo encontró un test). Se le quitan
    los saltos de línea.
  - La vista previa se muestra en un `iframe` con `sandbox` vacío: el HTML
    de la plantilla no puede ejecutar nada en el panel.
- **Consecuencias.** Seguro por defecto. Quien quiera HTML crudo en una
  variable no puede; no hace falta.

### 8. Baja obligatoria y de un clic

- **Contexto.**
  - Mandar mails comerciales sin forma de darse de baja está mal y, en
    muchos países, es ilegal.
  - Desde 2024 Gmail y Yahoo exigen la baja en un clic a quien manda mails
    masivos.
- **Decisión.**
  - Cada mail lleva el enlace de baja. Si la plantilla no usa
    `{{unsubscribeUrl}}`, se agrega solo al pie.
  - Además van las cabeceras `List-Unsubscribe` y `List-Unsubscribe-Post`,
    para el botón de Gmail.
  - Importar un CSV nunca vuelve a suscribir a quien se dio de baja.
- **Consecuencias.** Las bajas se respetan siempre: ni el admin puede
  volver a suscribir a alguien (no hay botón para eso).

### 9. Enlaces firmados para el seguimiento y la baja

- **Contexto.** `/api/t/c?u=<destino>` sin protección sería una redirección
  abierta, muy usada en phishing. Y `/baja/<id>` permitiría dar de baja a
  otros cambiando un número.
- **Decisión.**
  - Cada enlace lleva el id del envío y una firma HMAC-SHA256 de 128 bits,
    con una clave derivada de `JWT_SECRET` para otro propósito.
  - La firma del clic cubre también el destino.
  - La comparación es en tiempo constante.
- **Consecuencias.**
  - Cambiar el destino o el id da 400 (probado).
  - Las aperturas se cuentan con un píxel, así que son una estimación:
    - los programas que bloquean imágenes no las registran;
    - Gmail y Apple Mail las cargan solos.

    Los clics son exactos. Un clic también cuenta como apertura. Por
    campaña se cuentan **personas**, no aperturas repetidas.

### 10. Correo en la demo: una bandeja en la base

- **Contexto.**
  - Desde el **26 de septiembre de 2025**, los servicios gratuitos de Render
    **bloquean los puertos SMTP 25, 465 y 587**
    ([anuncio](https://render.com/changelog/free-web-services-will-no-longer-allow-outbound-traffic-to-smtp-ports)).
  - La alternativa era Brevo por HTTPS (300 mails por día gratis). Pero sin
    dominio propio el remitente sería una cuenta de Gmail, y esos mails a
    otras cuentas de Gmail se pierden o van a spam
    ([caso documentado](https://dev.to/tigawanna/brevo-smtp-emails-to-other-gmail-accounts-silently-failing-verified-domain-to-the-rescue-1d78)).
  - Y sin mails, en la demo nadie podría ni entrar.
- **Decisión.** `MAIL_TRANSPORT=outbox`: la versión publicada guarda cada
  mail en la colección `outbox` (se borra sola a los 3 días) y lo muestra en
  `/bandeja`, que actúa como MailHog. En local, como pide el enunciado,
  Nodemailer manda a MailHog. Con un SMTP de verdad
  (`SMTP_HOST`, `SMTP_USER`…) el código no cambia.
- **Consecuencias.**
  - La demo funciona completa y no puede mandar spam.
  - La bandeja es pública: es una demo, con datos inventados, y lo dice en
    pantalla.
  - `DEMO_ALLOWED_RECIPIENTS` permite, con un SMTP real, limitar las
    campañas a direcciones de prueba.

### 11. Adjuntos en MongoDB

- **Contexto.** El disco de Render gratis se borra en cada despliegue.
- **Decisión.** Los adjuntos se guardan como binario en MongoDB, hasta 5 MB
  cada uno y 5 por campaña: los servidores de correo suelen rechazar mails
  de más de 10 a 25 MB. Se descargan como `attachment` con `nosniff`, así
  un HTML subido nunca se abre como página.
- **Consecuencias.** No hace falta ningún servicio extra. Con mucho volumen
  convendría un almacenamiento de archivos (S3).

### 12. Fechas en hora argentina

- **Contexto.** El servidor corre en UTC.
- **Decisión.** Las fechas se muestran y se programan en
  `America/Argentina/Buenos_Aires`. El campo de programar convierte la hora
  local a UTC con el desfase fijo de −03:00, porque Argentina no cambia de
  hora.
- **Consecuencias.** «Programar a las 9:00» significa las 9:00 de acá,
  aunque el servidor esté en otro lado.

## Uso de IA

El proyecto se desarrolló con Claude como asistente de programación. Antes de
escribir código decidí cuatro cosas:
- cómo nace una organización: un dueño que invita;
- cómo se envía: en segundo plano;
- los extras: baja, etiquetas y segmentos, aperturas y clics, y envío
  programado;
- y publicar la demo.

Lo que se revisó y cambió sobre lo generado:

- **Antes de publicar se verificó en la documentación de Render que el plan
  gratuito bloquea el SMTP.** Con eso, la idea inicial de usar un SMTP real
  gratuito no servía. Se comparó con Brevo por HTTPS, que sin dominio propio
  no entrega bien a Gmail, y elegí la bandeja de demo (decisión 10).
- **Un test encontró que el asunto se escapaba como HTML**, de modo que
  «Rayuela & Cía» llegaba roto. Se corrigió compilando el asunto como texto.
- **La compilación encontró que los GET de la API se prerenderizaban**, y el
  manejador de errores guardaba como respuesta fija el error de «no hay
  cookies». Se corrigió marcando toda la API como dinámica.
- **La prueba en el navegador encontró que un adjunto con error cortaba la
  tanda entera del worker** y dejaba los mails trabados. Ahora cada mail
  tiene su propio manejo de errores: se reintenta y termina como «Falló»
  con el motivo.
- **Al probarlo me pregunté qué pasa si la dirección no existe o el
  servidor no responde.** Antes, todo error se reintentaba 3 veces. Ahora se separan los
  rechazos definitivos de los pasajeros, y los clientes que rebotan dejan de
  recibir campañas (decisión 5). Se agregó también «Ver cómo llega».
- **Next.js 16 esconde las páginas en vez de cerrarlas** (como en Reparto,
  VideoVault y la tienda). Los formularios de ingreso y de campaña vuelven a
  cero al esconderse, y las listas se recargan al mostrarse.
- **Se probó el aislamiento entre organizaciones a propósito**, con una
  segunda cuenta intentando leer, editar, borrar y enviar datos ajenos.
