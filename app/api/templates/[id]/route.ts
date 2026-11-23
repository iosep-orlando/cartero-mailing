import { requireTenant } from "@/lib/auth";
import { ApiError, handle, readJson } from "@/lib/api";
import { collections, templateToDTO, toObjectId } from "@/lib/db";
import { checkTemplate } from "@/lib/handlebars";
import { validateTemplateFields } from "@/lib/validation";

type Ctx = RouteContext<"/api/templates/[id]">;

export const GET = handle(async (_request: Request, ctx: Ctx) => {
  const caller = await requireTenant();
  const _id = toObjectId((await ctx.params).id);
  const { templates } = await collections();
  const doc = _id ? await templates.findOne({ _id, tenantId: caller.tenantId }) : null;
  if (!doc) throw new ApiError(404, "No existe esa plantilla.");
  return Response.json({ template: templateToDTO(doc) });
});

export const PATCH = handle(async (request: Request, ctx: Ctx) => {
  const caller = await requireTenant();
  const _id = toObjectId((await ctx.params).id);
  const input = validateTemplateFields(await readJson(request));
  if (!input.ok) throw new ApiError(400, input.error);
  const problem = checkTemplate(input.value.subject, input.value.html);
  if (problem) throw new ApiError(400, problem);
  const { templates } = await collections();
  const doc = _id
    ? await templates.findOneAndUpdate(
        { _id, tenantId: caller.tenantId },
        { $set: { ...input.value, updatedAt: new Date() } },
        { returnDocument: "after" },
      )
    : null;
  if (!doc) throw new ApiError(404, "No existe esa plantilla.");
  return Response.json({ template: templateToDTO(doc) });
});

/** Borrar, salvo que la use una campaña que todavía no salió. */
export const DELETE = handle(async (_request: Request, ctx: Ctx) => {
  const caller = await requireTenant();
  const _id = toObjectId((await ctx.params).id);
  if (!_id) throw new ApiError(404, "No existe esa plantilla.");
  const { templates, campaigns } = await collections();
  const inUse = await campaigns.countDocuments({
    tenantId: caller.tenantId,
    templateId: _id,
    status: { $in: ["draft", "scheduled"] },
  });
  if (inUse > 0) throw new ApiError(409, "La usa una campaña que todavía no se envió. Cambiale la plantilla primero.");
  const { deletedCount } = await templates.deleteOne({ _id, tenantId: caller.tenantId });
  if (deletedCount === 0) throw new ApiError(404, "No existe esa plantilla.");
  return new Response(null, { status: 204 });
});
