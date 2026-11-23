import { requireTenant } from "@/lib/auth";
import { ApiError, handle, readJson } from "@/lib/api";
import { collections, templateToDTO, type TemplateDoc } from "@/lib/db";
import { checkTemplate } from "@/lib/handlebars";
import { validateTemplateFields } from "@/lib/validation";

export const GET = handle(async () => {
  const caller = await requireTenant();
  const { templates } = await collections();
  const list = await templates.find({ tenantId: caller.tenantId }).sort({ updatedAt: -1 }).toArray();
  return Response.json({ templates: list.map(templateToDTO) });
});

export const POST = handle(async (request: Request) => {
  const caller = await requireTenant();
  const input = validateTemplateFields(await readJson(request));
  if (!input.ok) throw new ApiError(400, input.error);
  const problem = checkTemplate(input.value.subject, input.value.html);
  if (problem) throw new ApiError(400, problem);
  const { templates } = await collections();
  const now = new Date();
  const doc: TemplateDoc = { tenantId: caller.tenantId, ...input.value, createdAt: now, updatedAt: now };
  const { insertedId } = await templates.insertOne(doc);
  return Response.json({ template: templateToDTO({ ...doc, _id: insertedId }) }, { status: 201 });
});
