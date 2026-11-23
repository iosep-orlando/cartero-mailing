// Datos de ejemplo: una organización con clientes, dos plantillas y una
// campaña en borrador, para probar sin cargar nada a mano.
//
//   npm run seed
//
// Lee .env.local. El dueño es SEED_OWNER_EMAIL: entrás con ese email (el
// enlace llega a MailHog). Se puede correr de nuevo: no duplica nada.
import { closeDb, collections, EMPTY_COUNTS } from "../lib/db";
import { importClients } from "../lib/import";
import { STARTER_TEMPLATE } from "../lib/starter";
import { validateEmail } from "../lib/validation";

const ORG = "Librería Rayuela";

const CLIENTS = [
  { email: "ana.perez@ejemplo.com", name: "Ana Pérez", tags: ["vip", "novela"] },
  { email: "bruno.diaz@ejemplo.com", name: "Bruno Díaz", tags: ["infantil"] },
  { email: "carla.gomez@ejemplo.com", name: "Carla Gómez", tags: ["vip", "poesia"] },
  { email: "diego.ruiz@ejemplo.com", name: "Diego Ruiz", tags: ["novela"] },
  { email: "eva.sosa@ejemplo.com", name: "Eva Sosa", tags: ["mayorista"] },
  { email: "facundo.luna@ejemplo.com", name: "Facundo Luna", tags: ["infantil", "novela"] },
  { email: "gabriela.rey@ejemplo.com", name: "Gabriela Rey", tags: [] },
  { email: "hernan.vidal@ejemplo.com", name: "Hernán Vidal", tags: ["mayorista", "vip"] },
];

async function main() {
  const owner = validateEmail(process.env.SEED_OWNER_EMAIL);
  if (!owner.ok) {
    console.error("Poné SEED_OWNER_EMAIL en .env.local: es el email con el que vas a entrar.");
    process.exitCode = 1;
    return;
  }
  const { users, tenants, memberships, templates, campaigns } = await collections();
  const now = new Date();

  const user = await users.findOneAndUpdate(
    { email: owner.value },
    { $setOnInsert: { email: owner.value, name: owner.value.split("@")[0], createdAt: now } },
    { upsert: true, returnDocument: "after" },
  );
  // La organización de ejemplo de este dueño (por nombre), o una nueva.
  const mine = await memberships.find({ userId: user!._id, role: "owner" }).toArray();
  let tenant = await tenants.findOne({ _id: { $in: mine.map((m) => m.tenantId) }, name: ORG });
  if (!tenant) {
    const { insertedId } = await tenants.insertOne({ name: ORG, createdAt: now });
    await memberships.insertOne({ tenantId: insertedId, userId: user!._id, role: "owner", createdAt: now });
    tenant = { _id: insertedId, name: ORG, createdAt: now };
  }
  const tenantId = tenant._id;

  const imported = await importClients(tenantId, CLIENTS);
  console.log(`Clientes: ${imported.created} nuevos, ${imported.updated} ya estaban.`);

  const seeds = [
    STARTER_TEMPLATE,
    {
      name: "Llegó tu pedido especial",
      subject: "{{firstName}}, ya podés pasar a buscarlo",
      html: `<p>Hola, {{default firstName "lector"}}:</p>\n<p>El libro que encargaste ya está en {{organization}}. Te lo guardamos una semana.</p>\n<p><a href="https://ejemplo.com/horarios">Ver horarios</a></p>`,
    },
  ];
  let templateId = null;
  for (const t of seeds) {
    const doc = await templates.findOneAndUpdate(
      { tenantId, name: t.name },
      { $setOnInsert: { tenantId, ...t, createdAt: now, updatedAt: now } },
      { upsert: true, returnDocument: "after" },
    );
    templateId ??= doc!._id;
  }

  const existing = await campaigns.findOne({ tenantId, name: "Novedades de diciembre" });
  if (!existing) {
    await campaigns.insertOne({
      tenantId,
      name: "Novedades de diciembre",
      templateId: templateId!,
      tags: ["vip"],
      attachmentIds: [],
      status: "draft",
      snapshot: null,
      scheduledAt: null,
      startedAt: null,
      finishedAt: null,
      counts: EMPTY_COUNTS,
      createdBy: user!._id,
      createdAt: now,
      updatedAt: now,
    });
  }
  console.log(`Listo: «${ORG}», dueño ${owner.value}. Entrá en http://localhost:3000 con ese email.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(closeDb);
