import { requireTenant } from "@/lib/auth";
import { ApiError, handle } from "@/lib/api";
import { audienceSize } from "@/lib/store/campaigns";
import { parseTags } from "@/lib/validation";

/** ¿A cuántos les llegaría? ?tags=vip,norte (vacío = todos los suscritos). */
export const GET = handle(async (request: Request) => {
  const caller = await requireTenant();
  const tags = parseTags(new URL(request.url).searchParams.get("tags") ?? "");
  if (!tags.ok) throw new ApiError(400, tags.error);
  return Response.json({ count: await audienceSize(caller.tenantId, tags.value) });
});
