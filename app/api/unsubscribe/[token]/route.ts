import { unsubscribe } from "@/lib/store/tracking";
import { verifyToken } from "@/lib/tracking";

/**
 * Darse de baja. La usan el botón de /baja/[token] y el botón "Anular
 * suscripción" de Gmail (List-Unsubscribe-Post: un POST directo, sin página).
 */
export async function POST(_request: Request, ctx: RouteContext<"/api/unsubscribe/[token]">) {
  const deliveryId = verifyToken("unsubscribe", (await ctx.params).token);
  const result = deliveryId ? await unsubscribe(deliveryId) : null;
  if (!result) return Response.json({ error: "Enlace inválido." }, { status: 400 });
  return Response.json(result);
}
