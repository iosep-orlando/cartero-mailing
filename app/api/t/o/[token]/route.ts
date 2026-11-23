import { recordEvent } from "@/lib/store/tracking";
import { verifyToken } from "@/lib/tracking";

// GIF transparente de 1×1.
const PIXEL = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

/** El píxel de apertura. Responde la imagen siempre: un error no se ve en el mail. */
export async function GET(_request: Request, ctx: RouteContext<"/api/t/o/[token]">) {
  const deliveryId = verifyToken("open", (await ctx.params).token);
  if (deliveryId) await recordEvent(deliveryId, "open").catch((error) => console.error(error));
  return new Response(PIXEL, {
    headers: { "content-type": "image/gif", "cache-control": "no-store, max-age=0" },
  });
}
