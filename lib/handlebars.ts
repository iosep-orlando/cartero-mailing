import Handlebars from "handlebars";

// ---------------------------------------------------------------------------
// Plantillas con Handlebars. Una instancia propia (no la global): los
// helpers que se registren acá no se mezclan con nada más.
//
// Handlebars escapa el HTML de las variables ({{name}}): si un cliente se
// llama "<script>", en el mail aparece el texto, no se ejecuta nada. Desde la
// versión 4.6 tampoco deja leer propiedades del prototipo
// ({{constructor.constructor}}), que era la vía de ataque conocida.
// ---------------------------------------------------------------------------

const hbs = Handlebars.create();

/** {{default name "cliente"}}: el valor, o el texto de reserva si está vacío. */
hbs.registerHelper("default", (value: unknown, fallback: unknown) =>
  value === undefined || value === null || value === "" ? fallback : value,
);

/** Las variables que puede usar una plantilla. */
export interface TemplateVars {
  name: string;
  firstName: string;
  email: string;
  organization: string;
  unsubscribeUrl: string;
}

export const VARIABLES: { key: keyof TemplateVars; description: string }[] = [
  { key: "name", description: "Nombre completo del cliente" },
  { key: "firstName", description: "Solo el primer nombre" },
  { key: "email", description: "Email del cliente" },
  { key: "organization", description: "Nombre de tu organización" },
  { key: "unsubscribeUrl", description: "Enlace para darse de baja (se agrega solo al pie si no lo usás)" },
];

export function varsFor(
  client: { name: string; email: string },
  organization: string,
  unsubscribeUrl: string,
): TemplateVars {
  const name = client.name.trim();
  return { name, firstName: name.split(/\s+/)[0] ?? "", email: client.email, organization, unsubscribeUrl };
}

export const SAMPLE_VARS: TemplateVars = {
  name: "Ana Pérez",
  firstName: "Ana",
  email: "ana@ejemplo.com",
  organization: "Tu organización",
  unsubscribeUrl: "#baja",
};

export interface Compiled {
  subject: Handlebars.TemplateDelegate<TemplateVars>;
  html: Handlebars.TemplateDelegate<TemplateVars>;
}

/** Compila una vez; después se ejecuta por cada destinatario. */
export function compile(subject: string, html: string): Compiled {
  return {
    // El asunto es texto, no HTML: sin escapar, o "Rayuela & Cía" llegaría
    // como "Rayuela &amp; Cía".
    subject: hbs.compile<TemplateVars>(subject, { strict: false, noEscape: true }),
    html: hbs.compile<TemplateVars>(html, { strict: false }),
  };
}

export function render(compiled: Compiled, vars: TemplateVars): { subject: string; html: string } {
  return {
    // El asunto no es HTML: se le sacan los saltos de línea (no puede tenerlos).
    subject: compiled.subject(vars).replace(/\s*[\r\n]+\s*/g, " ").trim(),
    html: compiled.html(vars),
  };
}

/**
 * Comprueba que la plantilla compile y se pueda ejecutar con datos de
 * ejemplo. Devuelve el error de Handlebars en español, o null si está bien.
 */
export function checkTemplate(subject: string, html: string): string | null {
  for (const [part, source] of [
    ["asunto", subject],
    ["contenido", html],
  ] as const) {
    try {
      hbs.compile(source)(SAMPLE_VARS);
    } catch (error) {
      const message = error instanceof Error ? error.message.split("\n")[0] : String(error);
      return `Error en el ${part} de la plantilla: ${message}`;
    }
  }
  return null;
}
