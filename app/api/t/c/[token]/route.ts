import { recordEvent } from "@/lib/store/tracking";
import { verifyToken } from "@/lib/tracking";

/**
 * El clic: cuenta y redirige al destino. La firma cubre el destino: sin ella,
 * esta URL serviría para redirigir a cualquier sitio en nombre de la tienda.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/t/c/[token]">) {
  const target = new URL(request.url).searchParams.get("u") ?? "";
  const deliveryId = verifyToken("click", (await ctx.params).token, target);
  if (!deliveryId || !/^https?:\/\//i.test(target)) {
    return new Response("Enlace inválido.", { status: 400, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
  await recordEvent(deliveryId, "click").catch((error) => console.error(error));
  return Response.redirect(target, 302);
}
