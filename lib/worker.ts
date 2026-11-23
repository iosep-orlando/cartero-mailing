import type { ObjectId, WithId } from "mongodb";
import { publicUrl } from "./api";
import {
  MAX_ATTEMPTS,
  buildMessage,
  classifySendError,
  compileSnapshot,
  isRecipientAllowed,
  parseAllowlist,
} from "./campaign";
import { audienceFilter } from "./store/campaigns";
import { collections, type CampaignDoc, type DeliveryDoc } from "./db";
import type { Compiled } from "./handlebars";
import { sendMail } from "./mail";

// ---------------------------------------------------------------------------
// El envío en segundo plano.
//
// Pulsar "Enviar" no manda nada: crea un "envío" (delivery) pendiente por
// destinatario y devuelve al momento. Este worker, que corre dentro del
// mismo servidor (lo arranca instrumentation.ts), toma los pendientes de a
// poco y los manda. La cola vive en MongoDB, así que:
//   - si el servidor se reinicia a mitad de una campaña, sigue donde quedó;
//   - cada mail se "reclama" con una actualización atómica, así que dos
//     procesos nunca mandan el mismo mail;
//   - un fallo pasajero del SMTP se reintenta (hasta MAX_ATTEMPTS).
// ---------------------------------------------------------------------------

const TICK_MS = 2000;
/** Un mail reclamado que no se terminó en este tiempo vuelve a la cola. */
const LOCK_MS = 2 * 60 * 1000;
/** Espera antes de reintentar un mail que falló. */
const RETRY_DELAY_MS = 30 * 1000;

/** Mails por minuto (MAIL_RATE_PER_MINUTE, 120 si no se fija): no saturar el SMTP. */
export function perTick(env: Record<string, string | undefined> = process.env): number {
  const perMinute = Number(env.MAIL_RATE_PER_MINUTE) || 120;
  return Math.max(1, Math.round((perMinute * TICK_MS) / 60_000));
}

export type StartResult = { ok: true; total: number } | { ok: false; error: string };

/**
 * Pasa una campaña a "Enviando": copia la plantilla, elige los destinatarios
 * y crea un envío pendiente por cada uno. Solo la primera llamada lo hace:
 * el cambio de estado es condicional, así que "Enviar ahora" pulsado dos
 * veces, o justo cuando llega la hora programada, no duplica nada.
 */
export async function startCampaign(campaignId: ObjectId, tenantId: ObjectId): Promise<StartResult> {
  const { campaigns, templates, tenants, clients, deliveries } = await collections();
  const now = new Date();
  const campaign = await campaigns.findOneAndUpdate(
    { _id: campaignId, tenantId, status: { $in: ["draft", "scheduled"] } },
    { $set: { status: "sending", startedAt: now, updatedAt: now } },
    { returnDocument: "after" },
  );
  if (!campaign) return { ok: false, error: "La campaña ya se envió o se está enviando." };

  const [template, tenant] = await Promise.all([
    templates.findOne({ _id: campaign.templateId, tenantId }),
    tenants.findOne({ _id: tenantId }),
  ]);
  if (!template) {
    await campaigns.updateOne(
      { _id: campaignId },
      { $set: { status: "draft", startedAt: null, scheduledAt: null, updatedAt: new Date() } },
    );
    return { ok: false, error: "La plantilla de la campaña ya no existe. Elegí otra." };
  }

  // Destinatarios: los suscritos, y si la campaña tiene etiquetas, los que
  // tengan al menos una de ellas.
  const audience = await clients
    .find(audienceFilter(tenantId, campaign.tags))
    .project<{ _id: ObjectId; email: string; name: string }>({ email: 1, name: 1 })
    .toArray();

  const allowlist = parseAllowlist(process.env.DEMO_ALLOWED_RECIPIENTS);
  const docs: DeliveryDoc[] = audience.map((client) => {
    const allowed = isRecipientAllowed(client.email, allowlist);
    return {
      tenantId,
      campaignId,
      clientId: client._id,
      email: client.email,
      name: client.name,
      status: allowed ? "pending" : "skipped",
      attempts: 0,
      lockedUntil: null,
      error: allowed ? null : "Omitido: en la demo solo se envía a direcciones de prueba.",
      sentAt: null,
      openedAt: null,
      clickedAt: null,
      opens: 0,
      clicks: 0,
      createdAt: now,
    };
  });
  if (docs.length > 0) {
    try {
      // ordered:false + índice único (campaña, cliente): si esto se corta y
      // se repite, los que ya estaban no se duplican.
      await deliveries.insertMany(docs, { ordered: false });
    } catch (error) {
      if (!(typeof error === "object" && error !== null && "code" in error && error.code === 11000)) throw error;
    }
  }
  const skipped = docs.filter((d) => d.status === "skipped").length;
  await campaigns.updateOne(
    { _id: campaignId },
    {
      $set: {
        snapshot: { subject: template.subject, html: template.html, tenantName: tenant?.name ?? "" },
        "counts.total": docs.length,
        "counts.skipped": skipped,
        updatedAt: new Date(),
      },
    },
  );
  await finishIfDone(campaignId);
  kick();
  return { ok: true, total: docs.length };
}

/** Si no queda nada por mandar, la campaña pasa a "Enviada". */
async function finishIfDone(campaignId: ObjectId): Promise<void> {
  const { campaigns, deliveries } = await collections();
  const left = await deliveries.countDocuments({ campaignId, status: { $in: ["pending", "sending"] } });
  if (left === 0) {
    const now = new Date();
    await campaigns.updateOne(
      { _id: campaignId, status: "sending", snapshot: { $ne: null } },
      { $set: { status: "sent", finishedAt: now, updatedAt: now } },
    );
  }
}

interface CampaignContext {
  campaign: WithId<CampaignDoc>;
  compiled: Compiled;
  attachments: { filename: string; content: Buffer; contentType: string }[];
}

/** Lo que se comparte entre los mails de una campaña: plantilla compilada y adjuntos. */
async function loadContext(campaignId: ObjectId): Promise<CampaignContext | null> {
  const { campaigns, attachments } = await collections();
  const campaign = await campaigns.findOne({ _id: campaignId });
  if (!campaign?.snapshot) return null;
  const files = await attachments.find({ _id: { $in: campaign.attachmentIds }, tenantId: campaign.tenantId }).toArray();
  return {
    campaign,
    compiled: compileSnapshot(campaign.snapshot),
    attachments: files.map((f) => ({
      filename: f.filename,
      content: Buffer.from(f.data.buffer).subarray(0, f.size),
      contentType: f.contentType,
    })),
  };
}

/** Una vuelta del worker: arranca las programadas que tocan y manda una tanda. */
export async function tick(now = new Date()): Promise<number> {
  const { campaigns, deliveries } = await collections();

  // 1. Campañas programadas cuya hora ya llegó.
  const due = await campaigns.find({ status: "scheduled", scheduledAt: { $lte: now } }).limit(5).toArray();
  for (const campaign of due) await startCampaign(campaign._id, campaign.tenantId);

  // 2. Una tanda de mails.
  const contexts = new Map<string, CampaignContext | null>();
  const touched = new Set<string>();
  let sent = 0;
  for (let i = 0; i < perTick(); i++) {
    const claimed = await deliveries.findOneAndUpdate(
      {
        status: { $in: ["pending", "sending"] },
        $or: [{ lockedUntil: null }, { lockedUntil: { $lt: new Date() } }],
      },
      { $set: { status: "sending", lockedUntil: new Date(Date.now() + LOCK_MS) }, $inc: { attempts: 1 } },
      { sort: { createdAt: 1 }, returnDocument: "after" },
    );
    if (!claimed) break;
    const key = claimed.campaignId.toString();
    touched.add(key);

    try {
      // Todo lo que puede fallar va dentro del try: si un adjunto o la
      // plantilla dan error, este mail se reintenta y termina como
      // "Falló" con el motivo, en vez de cortar la tanda entera.
      if (!contexts.has(key)) contexts.set(key, await loadContext(claimed.campaignId));
      const context = contexts.get(key);
      if (!context) {
        // La campaña todavía se está preparando: se devuelve a la cola.
        await deliveries.updateOne(
          { _id: claimed._id },
          { $set: { status: "pending", lockedUntil: null }, $inc: { attempts: -1 } },
        );
        continue;
      }
      const message = buildMessage(context.compiled, {
        base: publicUrl(),
        deliveryId: claimed._id.toString(),
        client: { name: claimed.name, email: claimed.email },
        organization: context.campaign.snapshot!.tenantName,
      });
      await sendMail({
        to: claimed.email,
        fromName: context.campaign.snapshot!.tenantName,
        ...message,
        attachments: context.attachments,
      });
      await deliveries.updateOne(
        { _id: claimed._id },
        { $set: { status: "sent", sentAt: new Date(), lockedUntil: null, error: null } },
      );
      await campaigns.updateOne({ _id: claimed.campaignId }, { $inc: { "counts.sent": 1 } });
      sent++;
    } catch (error) {
      const { permanent, bounce, reason } = classifySendError(error);
      if (permanent || claimed.attempts >= MAX_ATTEMPTS) {
        // Un rechazo permanente (5xx) no mejora reintentando: falla ya.
        await deliveries.updateOne(
          { _id: claimed._id },
          { $set: { status: "failed", lockedUntil: null, error: reason } },
        );
        await campaigns.updateOne({ _id: claimed.campaignId }, { $inc: { "counts.failed": 1 } });
        if (bounce) {
          // La dirección no existe: el cliente no recibe más campañas
          // hasta que alguien corrija el email.
          const { clients } = await collections();
          await clients.updateOne(
            { _id: claimed.clientId, tenantId: claimed.tenantId },
            { $set: { bounced: true, bounceReason: reason, updatedAt: new Date() } },
          );
        }
      } else {
        // Vuelve a la cola, pero no antes de RETRY_DELAY_MS.
        await deliveries.updateOne(
          { _id: claimed._id },
          { $set: { status: "pending", lockedUntil: new Date(Date.now() + RETRY_DELAY_MS), error: reason } },
        );
      }
    }
  }
  for (const key of touched) {
    const context = contexts.get(key);
    if (context) await finishIfDone(context.campaign._id);
  }
  return sent;
}

declare global {
  var _cartero_worker: { timer: NodeJS.Timeout; running: boolean; again: boolean } | undefined;
}

/** Arranca el worker una sola vez por proceso. */
export function startWorker(): void {
  if (global._cartero_worker) return;
  const state = { timer: setInterval(() => void run(), TICK_MS), running: false, again: false };
  state.timer.unref?.();
  global._cartero_worker = state;
  console.log("Worker de envíos en marcha");
}

/** Despierta al worker ya (después de "Enviar ahora"), sin esperar la próxima vuelta. */
export function kick(): void {
  if (global._cartero_worker) setTimeout(() => void run(), 0);
}

let lastError = "";

async function run(): Promise<void> {
  const state = global._cartero_worker;
  if (!state) return;
  if (state.running) {
    state.again = true;
    return;
  }
  state.running = true;
  try {
    do {
      state.again = false;
      await tick();
    } while (state.again);
    lastError = "";
  } catch (error) {
    // Sin base o sin SMTP, no se llena el log con el mismo error cada 2 s.
    const message = error instanceof Error ? error.message : String(error);
    if (message !== lastError) console.error("Worker de envíos:", message);
    lastError = message;
  } finally {
    state.running = false;
  }
}
