import { describe, expect, it } from "vitest";
import { SAMPLE_VARS, checkTemplate, compile, render, varsFor } from "@/lib/handlebars";
import { buildPreview } from "@/lib/preview";

describe("plantillas Handlebars", () => {
  it("personaliza por destinatario y escapa el HTML de los datos", () => {
    const compiled = compile("Hola {{firstName}}", "<p>{{name}} — {{organization}}</p>");
    const vars = varsFor({ name: "  <b>Ana</b> Pérez ", email: "a@b.com" }, "Rayuela", "https://x/baja");
    expect(vars.firstName).toBe("<b>Ana</b>");
    expect(render(compiled, vars)).toEqual({
      subject: "Hola <b>Ana</b>", // el asunto es texto, no HTML
      html: "<p>&lt;b&gt;Ana&lt;/b&gt; Pérez — Rayuela</p>",
    });
  });

  it("el asunto no puede tener saltos de línea", () => {
    expect(render(compile("Hola\n{{firstName}}\r\n!", ""), SAMPLE_VARS).subject).toBe("Hola Ana !");
  });

  it("default para datos vacíos", () => {
    const compiled = compile("", '{{default firstName "lector"}}');
    expect(render(compiled, varsFor({ name: "", email: "a@b.com" }, "", "")).html).toBe("lector");
    expect(render(compiled, SAMPLE_VARS).html).toBe("Ana");
  });

  it("errores de sintaxis en castellano, sin acceso al prototipo", () => {
    expect(checkTemplate("ok", "<p>{{#if name}}sin cerrar</p>")).toMatch(/^Error en el contenido/);
    expect(checkTemplate("{{", "ok")).toMatch(/^Error en el asunto/);
    expect(checkTemplate("ok", "<p>{{name}}</p>")).toBeNull();
    // La vía de ataque conocida de Handlebars queda bloqueada (4.6+).
    const evil = render(compile("", "{{constructor.constructor}}"), SAMPLE_VARS);
    expect(evil.html).toBe("");
  });

  it("vista previa con un cliente real o con los datos de ejemplo", () => {
    expect(buildPreview("Hola {{firstName}}", "{{organization}}", "Rayuela", null)).toEqual({
      ok: true,
      value: { subject: "Hola Ana", html: "Rayuela" },
    });
    expect(buildPreview("Hola {{firstName}}", "x", "R", { name: "Beto Díaz", email: "b@c.com" })).toEqual({
      ok: true,
      value: { subject: "Hola Beto", html: "x" },
    });
    expect(buildPreview("{{#if}}", "x", "R", null).ok).toBe(false);
  });
});

describe("asunto", () => {
  it("es texto: un & llega como &", () => {
    expect(render(compile("Novedades de {{organization}}", ""), { ...SAMPLE_VARS, organization: "Rayuela & Cía" }).subject).toBe(
      "Novedades de Rayuela & Cía",
    );
  });
});
