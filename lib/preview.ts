import { SAMPLE_VARS, checkTemplate, compile, render, varsFor } from "./handlebars";
import type { Result } from "./validation";

/** La vista previa: la plantilla con un cliente real o con los datos de ejemplo. */
export function buildPreview(
  subject: string,
  html: string,
  organization: string,
  client: { name: string; email: string } | null,
): Result<{ subject: string; html: string }> {
  const problem = checkTemplate(subject, html);
  if (problem) return { ok: false, error: problem };
  const vars = client
    ? varsFor(client, organization, "#baja")
    : { ...SAMPLE_VARS, organization: organization || SAMPLE_VARS.organization };
  return { ok: true, value: render(compile(subject, html), vars) };
}
