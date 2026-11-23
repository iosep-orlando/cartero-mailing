import { MongoClient, ObjectId, type Binary, type Db, type WithId } from "mongodb";
import type {
  AttachmentDTO,
  CampaignCounts,
  CampaignDTO,
  CampaignStatus,
  ClientDTO,
  DeliveryDTO,
  DeliveryStatus,
  Role,
  TemplateDTO,
} from "./types";

// ---------------------------------------------------------------------------
// MongoDB: un cliente por proceso, las colecciones y sus índices.
//
// MULTITENANCY: todo lo que pertenece a una organización (clientes,
// plantillas, campañas, envíos, adjuntos) lleva `tenantId`, y toda consulta
// lo filtra con el tenant de la sesión (lib/auth.ts). Los índices únicos
// empiezan por tenantId: el mismo email puede ser cliente de dos
// organizaciones sin que se pisen.
// ---------------------------------------------------------------------------

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

function getClient(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('Falta la variable de entorno "MONGODB_URI"');
  // En desarrollo, en globalThis: la recarga en caliente reejecuta módulos.
  global._mongoClientPromise ??= new MongoClient(uri).connect();
  return global._mongoClientPromise;
}

/** MONGODB_DB, si no el nombre de la URI, si no "mailing". */
export function databaseName(uri: string | undefined, explicit: string | undefined): string {
  if (explicit) return explicit;
  const match = uri?.match(/^mongodb(?:\+srv)?:\/\/[^/]+\/([^?]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : "mailing";
}

export async function getDb(): Promise<Db> {
  return (await getClient()).db(databaseName(process.env.MONGODB_URI, process.env.MONGODB_DB));
}

/** Para los scripts: cierra la conexión y deja terminar el proceso. */
export async function closeDb(): Promise<void> {
  const client = await global._mongoClientPromise;
  await client?.close();
  global._mongoClientPromise = undefined;
}

// --- Documentos --------------------------------------------------------------

export interface UserDoc {
  email: string;
  name: string;
  createdAt: Date;
}

export interface TenantDoc {
  name: string;
  createdAt: Date;
}

export interface MembershipDoc {
  tenantId: ObjectId;
  userId: ObjectId;
  role: Role;
  createdAt: Date;
}

export interface InvitationDoc {
  tenantId: ObjectId;
  email: string;
  invitedBy: ObjectId;
  createdAt: Date;
}

export interface LoginTokenDoc {
  /** Solo el hash: si alguien lee la base, no puede entrar con los enlaces. */
  tokenHash: string;
  email: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

export interface ClientDoc {
  tenantId: ObjectId;
  email: string;
  name: string;
  tags: string[];
  unsubscribed: boolean;
  unsubscribedAt: Date | null;
  /**
   * El servidor de correo rechazó la dirección de forma permanente (no
   * existe). No recibe más campañas hasta que se corrija el email. Opcional:
   * los clientes anteriores a este campo cuentan como no rebotados.
   */
  bounced?: boolean;
  bounceReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TemplateDoc {
  tenantId: ObjectId;
  name: string;
  subject: string;
  html: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AttachmentDoc {
  tenantId: ObjectId;
  filename: string;
  contentType: string;
  size: number;
  data: Binary;
  createdAt: Date;
}

export interface CampaignDoc {
  tenantId: ObjectId;
  name: string;
  templateId: ObjectId;
  tags: string[];
  attachmentIds: ObjectId[];
  status: CampaignStatus;
  /**
   * Copia de la plantilla al empezar el envío: si alguien la edita a mitad
   * de camino, la campaña sigue mandando lo mismo a todos.
   */
  snapshot: { subject: string; html: string; tenantName: string } | null;
  scheduledAt: Date | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  counts: CampaignCounts;
  createdBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

/** Un mail de una campaña a un destinatario: la cola del envío. */
export interface DeliveryDoc {
  tenantId: ObjectId;
  campaignId: ObjectId;
  clientId: ObjectId;
  email: string;
  name: string;
  status: DeliveryStatus;
  attempts: number;
  /** Mientras se envía: hasta cuándo es de este proceso (si se cae, otro lo retoma). */
  lockedUntil: Date | null;
  error: string | null;
  sentAt: Date | null;
  openedAt: Date | null;
  clickedAt: Date | null;
  opens: number;
  clicks: number;
  createdAt: Date;
}

/** Un mail guardado en la bandeja de demo (MAIL_TRANSPORT=outbox) en vez de enviarse. */
export interface OutboxDoc {
  to: string;
  from: string;
  subject: string;
  html: string;
  text: string;
  attachments: { filename: string; size: number; contentType: string }[];
  createdAt: Date;
}

let indexes: Promise<unknown> | undefined;

export async function collections() {
  const db = await getDb();
  const c = {
    users: db.collection<UserDoc>("users"),
    tenants: db.collection<TenantDoc>("tenants"),
    memberships: db.collection<MembershipDoc>("memberships"),
    invitations: db.collection<InvitationDoc>("invitations"),
    loginTokens: db.collection<LoginTokenDoc>("loginTokens"),
    clients: db.collection<ClientDoc>("clients"),
    templates: db.collection<TemplateDoc>("templates"),
    attachments: db.collection<AttachmentDoc>("attachments"),
    campaigns: db.collection<CampaignDoc>("campaigns"),
    deliveries: db.collection<DeliveryDoc>("deliveries"),
    outbox: db.collection<OutboxDoc>("outbox"),
  };
  indexes ??= Promise.all([
    c.users.createIndex({ email: 1 }, { unique: true }),
    c.memberships.createIndex({ tenantId: 1, userId: 1 }, { unique: true }),
    c.memberships.createIndex({ userId: 1 }),
    c.invitations.createIndex({ tenantId: 1, email: 1 }, { unique: true }),
    c.invitations.createIndex({ email: 1 }),
    c.loginTokens.createIndex({ tokenHash: 1 }, { unique: true }),
    c.loginTokens.createIndex({ email: 1, createdAt: -1 }),
    // MongoDB borra solo los enlaces vencidos (índice TTL).
    c.loginTokens.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    c.clients.createIndex({ tenantId: 1, email: 1 }, { unique: true }),
    c.clients.createIndex({ tenantId: 1, tags: 1 }),
    c.templates.createIndex({ tenantId: 1, updatedAt: -1 }),
    c.attachments.createIndex({ tenantId: 1, createdAt: -1 }),
    c.campaigns.createIndex({ tenantId: 1, createdAt: -1 }),
    // El worker busca las programadas que ya tocan.
    c.campaigns.createIndex({ status: 1, scheduledAt: 1 }),
    // Un destinatario por campaña, aunque el envío se arranque dos veces.
    c.deliveries.createIndex({ campaignId: 1, clientId: 1 }, { unique: true }),
    // La cola: pendientes, o en envío con el turno vencido.
    c.deliveries.createIndex({ status: 1, lockedUntil: 1 }),
    c.deliveries.createIndex({ tenantId: 1, campaignId: 1, status: 1 }),
    // La bandeja de demo se vacía sola: cada mail dura 3 días.
    c.outbox.createIndex({ createdAt: 1 }, { expireAfterSeconds: 3 * 24 * 60 * 60 }),
    c.outbox.createIndex({ to: 1, createdAt: -1 }),
  ]);
  await indexes;
  return c;
}

export type Collections = Awaited<ReturnType<typeof collections>>;

/** ObjectId de un texto, o null si no es un id válido (evita un 500 con ids basura). */
export function toObjectId(id: unknown): ObjectId | null {
  return typeof id === "string" && ObjectId.isValid(id) && String(new ObjectId(id)) === id ? new ObjectId(id) : null;
}

/** Error de índice único (código 11000): un email repetido, por ejemplo. */
export function isDuplicateKey(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}

export const EMPTY_COUNTS: CampaignCounts = { total: 0, sent: 0, failed: 0, skipped: 0, opened: 0, clicked: 0 };

// --- Documento → DTO -------------------------------------------------------------

const iso = (date: Date | null) => date?.toISOString() ?? null;

export function clientToDTO(doc: WithId<ClientDoc>): ClientDTO {
  return {
    id: doc._id.toString(),
    email: doc.email,
    name: doc.name,
    tags: doc.tags,
    unsubscribed: doc.unsubscribed,
    bounced: doc.bounced === true,
    bounceReason: doc.bounceReason ?? null,
    createdAt: doc.createdAt.toISOString(),
  };
}

export function templateToDTO(doc: WithId<TemplateDoc>): TemplateDTO {
  return {
    id: doc._id.toString(),
    name: doc.name,
    subject: doc.subject,
    html: doc.html,
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export function attachmentToDTO(doc: WithId<Omit<AttachmentDoc, "data">>): AttachmentDTO {
  return {
    id: doc._id.toString(),
    filename: doc.filename,
    contentType: doc.contentType,
    size: doc.size,
    createdAt: doc.createdAt.toISOString(),
  };
}

export function campaignToDTO(doc: WithId<CampaignDoc>, templateName: string): CampaignDTO {
  return {
    id: doc._id.toString(),
    name: doc.name,
    templateId: doc.templateId.toString(),
    templateName,
    tags: doc.tags,
    attachmentIds: doc.attachmentIds.map(String),
    status: doc.status,
    scheduledAt: iso(doc.scheduledAt),
    startedAt: iso(doc.startedAt),
    finishedAt: iso(doc.finishedAt),
    counts: doc.counts,
    createdAt: doc.createdAt.toISOString(),
  };
}

export function deliveryToDTO(doc: WithId<DeliveryDoc>): DeliveryDTO {
  return {
    id: doc._id.toString(),
    email: doc.email,
    name: doc.name,
    status: doc.status,
    error: doc.error,
    sentAt: iso(doc.sentAt),
    openedAt: iso(doc.openedAt),
    clickedAt: iso(doc.clickedAt),
  };
}
