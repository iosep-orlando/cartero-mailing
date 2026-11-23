import type { Filter } from "mongodb";
import { requireTenant } from "@/lib/auth";
import { ApiError, handle, readJson } from "@/lib/api";
import { clientToDTO, collections, isDuplicateKey, type ClientDoc } from "@/lib/db";
import { escapeRegex } from "@/lib/search";
import { validateClient } from "@/lib/validation";

/** Clientes de la organización, con búsqueda (?q=) y filtro por etiqueta (?tag=). */
export const GET = handle(async (request: Request) => {
  const caller = await requireTenant();
  const params = new URL(request.url).searchParams;
  const q = (params.get("q") ?? "").trim().slice(0, 100);
  const tag = (params.get("tag") ?? "").trim().toLowerCase();
  // El filtro SIEMPRE empieza por el tenant de la sesión.
  const filter: Filter<ClientDoc> = { tenantId: caller.tenantId };
  if (tag) filter.tags = tag;
  if (q) {
    const pattern = escapeRegex(q);
    filter.$or = [{ email: { $regex: pattern, $options: "i" } }, { name: { $regex: pattern, $options: "i" } }];
  }
  const { clients } = await collections();
  const [list, total, tags] = await Promise.all([
    clients.find(filter).sort({ createdAt: -1 }).limit(500).toArray(),
    clients.countDocuments(filter),
    clients.distinct("tags", { tenantId: caller.tenantId }),
  ]);
  return Response.json({ clients: list.map(clientToDTO), total, tags: tags.sort() });
});

export const POST = handle(async (request: Request) => {
  const caller = await requireTenant();
  const input = validateClient(await readJson(request));
  if (!input.ok) throw new ApiError(400, input.error);
  const { clients } = await collections();
  const now = new Date();
  const doc: ClientDoc = {
    tenantId: caller.tenantId,
    ...input.value,
    unsubscribed: false,
    unsubscribedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  try {
    const { insertedId } = await clients.insertOne(doc);
    return Response.json({ client: clientToDTO({ ...doc, _id: insertedId }) }, { status: 201 });
  } catch (error) {
    if (isDuplicateKey(error)) throw new ApiError(409, "Ya tenés un cliente con ese email.");
    throw error;
  }
});
