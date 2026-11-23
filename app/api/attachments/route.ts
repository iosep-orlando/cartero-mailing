import { Binary } from "mongodb";
import { requireTenant } from "@/lib/auth";
import { ApiError, handle } from "@/lib/api";
import { attachmentToDTO, collections, type AttachmentDoc } from "@/lib/db";
import { MAX_ATTACHMENT_BYTES, cleanFilename, guessContentType } from "@/lib/attachments";

export const GET = handle(async () => {
  const caller = await requireTenant();
  const { attachments } = await collections();
  const list = await attachments
    .find({ tenantId: caller.tenantId }, { projection: { data: 0 } })
    .sort({ createdAt: -1 })
    .toArray();
  return Response.json({ attachments: list.map(attachmentToDTO) });
});

/**
 * Subir un adjunto: el cuerpo es el archivo tal cual; el nombre va en la
 * cabecera X-Filename. Se guarda en MongoDB (el disco de Render gratis se
 * borra en cada despliegue).
 */
export const POST = handle(async (request: Request) => {
  const caller = await requireTenant();
  const filename = cleanFilename(decodeURIComponent(request.headers.get("x-filename") ?? ""));
  if (!filename) throw new ApiError(400, "Falta el nombre del archivo.");
  if (Number(request.headers.get("content-length") ?? 0) > MAX_ATTACHMENT_BYTES) {
    throw new ApiError(413, "El archivo pesa más de 5 MB.");
  }
  const bytes = Buffer.from(await request.arrayBuffer());
  if (bytes.length === 0) throw new ApiError(400, "El archivo está vacío.");
  if (bytes.length > MAX_ATTACHMENT_BYTES) throw new ApiError(413, "El archivo pesa más de 5 MB.");
  const { attachments } = await collections();
  const doc: AttachmentDoc = {
    tenantId: caller.tenantId,
    filename,
    contentType: guessContentType(filename),
    size: bytes.length,
    data: new Binary(bytes),
    createdAt: new Date(),
  };
  const { insertedId } = await attachments.insertOne(doc);
  return Response.json({ attachment: attachmentToDTO({ ...doc, _id: insertedId }) }, { status: 201 });
});
