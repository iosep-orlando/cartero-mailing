import { collections, toObjectId } from "../db";

/**
 * Cuenta una apertura o un clic. El total (opens/clicks) suma siempre; el
 * contador de la campaña cuenta personas: solo la primera vez de cada
 * envío (la actualización condicional openedAt: null lo asegura aunque
 * lleguen dos a la vez). Un clic implica que el mail se abrió, aunque el
 * programa de correo no haya cargado el píxel.
 */
export async function recordEvent(deliveryId: string, kind: "open" | "click"): Promise<void> {
  const _id = toObjectId(deliveryId);
  if (!_id) return;
  const { deliveries, campaigns } = await collections();
  const now = new Date();
  const delivery = await deliveries.findOneAndUpdate(
    { _id },
    { $inc: kind === "open" ? { opens: 1 } : { clicks: 1 } },
  );
  if (!delivery) return;
  const firstOpen = await deliveries.updateOne({ _id, openedAt: null }, { $set: { openedAt: now } });
  if (firstOpen.modifiedCount === 1) await campaigns.updateOne({ _id: delivery.campaignId }, { $inc: { "counts.opened": 1 } });
  if (kind === "click") {
    const firstClick = await deliveries.updateOne({ _id, clickedAt: null }, { $set: { clickedAt: now } });
    if (firstClick.modifiedCount === 1) {
      await campaigns.updateOne({ _id: delivery.campaignId }, { $inc: { "counts.clicked": 1 } });
    }
  }
}

/** Da de baja al cliente del envío. Devuelve su email y la organización, para la confirmación. */
export async function unsubscribe(deliveryId: string): Promise<{ email: string; organization: string } | null> {
  const _id = toObjectId(deliveryId);
  if (!_id) return null;
  const { deliveries, clients, tenants } = await collections();
  const delivery = await deliveries.findOne({ _id });
  if (!delivery) return null;
  await clients.updateOne(
    { _id: delivery.clientId, tenantId: delivery.tenantId, unsubscribed: false },
    { $set: { unsubscribed: true, unsubscribedAt: new Date(), updatedAt: new Date() } },
  );
  const tenant = await tenants.findOne({ _id: delivery.tenantId });
  return { email: delivery.email, organization: tenant?.name ?? "" };
}

/** Para la página de baja: a quién y de qué organización, sin cambiar nada. */
export async function describeDelivery(deliveryId: string) {
  const _id = toObjectId(deliveryId);
  if (!_id) return null;
  const { deliveries, clients, tenants } = await collections();
  const delivery = await deliveries.findOne({ _id });
  if (!delivery) return null;
  const [client, tenant] = await Promise.all([
    clients.findOne({ _id: delivery.clientId }),
    tenants.findOne({ _id: delivery.tenantId }),
  ]);
  return { email: delivery.email, organization: tenant?.name ?? "", unsubscribed: client?.unsubscribed ?? true };
}
