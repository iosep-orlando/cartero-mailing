import { describe, expect, it } from "vitest";
import {
  parseTags,
  validateCampaign,
  validateClient,
  validateEmail,
  validateOrgName,
  validateSchedule,
  validateTemplateFields,
} from "@/lib/validation";

describe("emails y etiquetas", () => {
  it("normaliza el email y rechaza lo que no es", () => {
    expect(validateEmail(" Ana@Mail.COM ")).toEqual({ ok: true, value: "ana@mail.com" });
    for (const bad of ["", "ana", "ana@", "a b@c.com", "<a@b.com>", 3]) expect(validateEmail(bad).ok).toBe(false);
  });

  it("etiquetas con coma o punto y coma, en minúsculas y sin repetir", () => {
    expect(parseTags("VIP, norte; vip ,  zona sur")).toEqual({ ok: true, value: ["vip", "norte", "zona-sur"] });
    expect(parseTags(["a", "B", 3])).toEqual({ ok: true, value: ["a", "b"] });
    expect(parseTags("")).toEqual({ ok: true, value: [] });
    expect(parseTags("x".repeat(31)).ok).toBe(false);
    expect(parseTags(Array.from({ length: 21 }, (_, i) => `t${i}`)).ok).toBe(false);
  });

  it("cliente", () => {
    expect(validateClient({ email: "a@b.com", name: " Ana ", tags: "vip" })).toEqual({
      ok: true,
      value: { email: "a@b.com", name: "Ana", tags: ["vip"] },
    });
    expect(validateClient({ email: "a@b.com", name: "x".repeat(121) }).ok).toBe(false);
  });
});

describe("plantillas, campañas y organización", () => {
  it("plantilla: nombre, asunto y contenido obligatorios", () => {
    expect(validateTemplateFields({ name: "N", subject: "S", html: "<p>h</p>" }).ok).toBe(true);
    expect(validateTemplateFields({ name: "", subject: "S", html: "h" }).ok).toBe(false);
    expect(validateTemplateFields({ name: "N", subject: "", html: "h" }).ok).toBe(false);
    expect(validateTemplateFields({ name: "N", subject: "S", html: "  " }).ok).toBe(false);
    expect(validateTemplateFields({ name: "N", subject: "S", html: "x".repeat(200_001) }).ok).toBe(false);
  });

  it("campaña: plantilla con id válido, adjuntos sin repetir y hasta 5", () => {
    const id = "6740f1a2b3c4d5e6f7a8b9c0";
    expect(validateCampaign({ name: "C", templateId: id, tags: "vip", attachmentIds: [id, id] })).toEqual({
      ok: true,
      value: { name: "C", templateId: id, tags: ["vip"], attachmentIds: [id] },
    });
    expect(validateCampaign({ name: "C", templateId: "x" }).ok).toBe(false);
    expect(validateCampaign({ name: "", templateId: id }).ok).toBe(false);
    expect(validateCampaign({ name: "C", templateId: id, attachmentIds: ["nope"] }).ok).toBe(false);
    const six = Array.from({ length: 6 }, (_, i) => id.slice(0, 23) + i);
    expect(validateCampaign({ name: "C", templateId: id, attachmentIds: six }).ok).toBe(false);
  });

  it("programar: futuro (más de un minuto) y hasta un año", () => {
    const now = new Date("2026-11-23T12:00:00Z");
    expect(validateSchedule("2026-11-23T12:30:00Z", now)).toEqual({ ok: true, value: new Date("2026-11-23T12:30:00Z") });
    expect(validateSchedule("2026-11-23T12:00:30Z", now).ok).toBe(false);
    expect(validateSchedule("2028-01-01T00:00:00Z", now).ok).toBe(false);
    expect(validateSchedule("mañana", now).ok).toBe(false);
  });

  it("nombre de la organización", () => {
    expect(validateOrgName(" Rayuela ")).toEqual({ ok: true, value: "Rayuela" });
    expect(validateOrgName("").ok).toBe(false);
    expect(validateOrgName("x".repeat(81)).ok).toBe(false);
  });
});
