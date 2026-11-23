import type { AnyBulkWriteOperation, ObjectId } from "mongodb";
import { collections, type ClientDoc } from "./db";
import type { ClientInput } from "./validation";

/**
 * Crea o actualiza clientes por email dentro de la organización. Un cliente
 * que ya existe conserva su baja: importar un archivo viejo no puede volver
 * a suscribir a quien pidió no recibir más mails.
 */
export async function importClients(
  tenantId: ObjectId,
  list: ClientInput[],
): Promise<{ created: number; updated: number }> {
  if (list.length === 0) return { created: 0, updated: 0 };
  const { clients } = await collections();
  const now = new Date();
  const ops: AnyBulkWriteOperation<ClientDoc>[] = list.map((client) => ({
    updateOne: {
      filter: { tenantId, email: client.email },
      update: {
        $set: { name: client.name, tags: client.tags, updatedAt: now },
        $setOnInsert: { tenantId, email: client.email, unsubscribed: false, unsubscribedAt: null, createdAt: now },
      },
      upsert: true,
    },
  }));
  const result = await clients.bulkWrite(ops, { ordered: false });
  return { created: result.upsertedCount, updated: result.matchedCount };
}
