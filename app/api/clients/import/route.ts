import { requireTenant } from "@/lib/auth";
import { ApiError, handle, readJson } from "@/lib/api";
import { parseCsv, rowsToClients } from "@/lib/csv";
import { importClients } from "@/lib/import";

/** Importar clientes desde un CSV (el texto del archivo, en { csv }). */
export const POST = handle(async (request: Request) => {
  const caller = await requireTenant();
  const body = await readJson(request);
  if (typeof body.csv !== "string" || !body.csv.trim()) throw new ApiError(400, "El archivo está vacío.");
  if (body.csv.length > 2_000_000) throw new ApiError(413, "El archivo es demasiado grande (hasta 2 MB).");
  const { clients, errors } = rowsToClients(parseCsv(body.csv));
  const counts = await importClients(caller.tenantId, clients);
  return Response.json({ ...counts, errors: errors.slice(0, 50), errorCount: errors.length });
});
