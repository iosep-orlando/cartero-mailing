import { requireTenant } from "@/lib/auth";
import { ApiError, handle, readJson } from "@/lib/api";
import { buildPreview } from "@/lib/preview";
import { collections, toObjectId } from "@/lib/db";

/**
 * Cómo queda la plantilla con datos reales: los de un cliente (clientId) o,
 * si no se elige, los de ejemplo. No se guarda nada.
 */
export const POST = handle(async (request: Request) => {
  const caller = await requireTenant();
  const body = await readJson(request);
  const subject = typeof body.subject === "string" ? body.subject : "";
  const html = typeof body.html === "string" ? body.html : "";
  const { tenants, clients } = await collections();
  const clientId = toObjectId(body.clientId);
  const [tenant, client] = await Promise.all([
    tenants.findOne({ _id: caller.tenantId }),
    clientId ? clients.findOne({ _id: clientId, tenantId: caller.tenantId }) : null,
  ]);
  const result = buildPreview(subject, html, tenant?.name ?? "", client);
  if (!result.ok) throw new ApiError(400, result.error);
  return Response.json(result.value);
});
