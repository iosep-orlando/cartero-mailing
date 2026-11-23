import { requireTenant } from "@/lib/auth";
import { ApiError, handle } from "@/lib/api";
import { getCampaign } from "@/lib/store/campaigns";
import { startCampaign } from "@/lib/worker";

/**
 * Enviar ahora. Devuelve enseguida: los mails salen en segundo plano y la
 * pantalla de la campaña muestra el progreso.
 */
export const POST = handle(async (_request: Request, ctx: RouteContext<"/api/campaigns/[id]/send">) => {
  const caller = await requireTenant();
  const doc = await getCampaign(caller.tenantId, (await ctx.params).id);
  const result = await startCampaign(doc._id, caller.tenantId);
  if (!result.ok) throw new ApiError(409, result.error);
  return Response.json({ total: result.total }, { status: 202 });
});
