import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { cleanFilename, formatBytes, guessContentType } from "@/lib/attachments";
import { formatDateTime, fromLocalInput, toLocalInput } from "@/lib/format";
import { signSession, verifySession } from "@/lib/jwt";
import { fromAddress, smtpConfig } from "@/lib/mail";
import { escapeRegex } from "@/lib/search";
import { proxy } from "@/proxy";

describe("SMTP", () => {
  it("MailHog por defecto, SMTP real si se configura", () => {
    expect(smtpConfig({})).toEqual({ host: "localhost", port: 1025, secure: false, auth: undefined });
    expect(smtpConfig({ MAILHOG_HOST: "mailhog", MAILHOG_PORT: "2525" })).toMatchObject({ host: "mailhog", port: 2525 });
    expect(
      smtpConfig({ MAILHOG_HOST: "x", SMTP_HOST: "smtp.gmail.com", SMTP_PORT: "465", SMTP_USER: "u", SMTP_PASS: "p" }),
    ).toEqual({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user: "u", pass: "p" } });
  });

  it("remitente: el nombre de la organización, sin comillas que rompan la cabecera", () => {
    expect(fromAddress('Rayuela "Libros"\n', { MAIL_FROM: "yo@b.com" })).toBe('"Rayuela Libros" <yo@b.com>');
    expect(fromAddress(undefined, {})).toBe('"Cartero" <no-responder@cartero.local>');
  });
});

describe("adjuntos y formatos", () => {
  it("nombres de archivo seguros y tipos", () => {
    expect(cleanFilename("C:\\x\\..\\precios\u0000.pdf")).toBe("precios.pdf");
    expect(guessContentType("Lista.PDF")).toBe("application/pdf");
    expect(guessContentType("raro.xyz")).toBe("application/octet-stream");
    expect(formatBytes(500)).toBe("500 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(1.5 * 1024 * 1024)).toBe("1,5 MB");
  });

  it("fechas en hora argentina, ida y vuelta del campo datetime-local", () => {
    expect(formatDateTime("2026-11-23T02:30:00Z")).toBe("22 nov, 23:30");
    expect(formatDateTime(null)).toBe("—");
    expect(toLocalInput(new Date("2026-11-23T02:30:00Z"))).toBe("2026-11-22T23:30");
    expect(fromLocalInput("2026-11-22T23:30")).toBe("2026-11-23T02:30:00.000Z");
    expect(fromLocalInput("mal")).toBeNull();
  });

  it("escapeRegex", () => {
    expect(new RegExp(escapeRegex("a.b(")).test("a.b(")).toBe(true);
    expect(new RegExp(escapeRegex(".*")).test("abc")).toBe(false);
  });
});

describe("sesión y proxy", () => {
  it("JWT con la organización activa; alterado no vale", async () => {
    const jwt = await signSession({ sub: "u1", email: "a@b.com", tid: "t1" });
    expect(await verifySession(jwt)).toEqual({ sub: "u1", email: "a@b.com", tid: "t1" });
    expect(await verifySession(jwt.slice(0, -3) + "abc")).toBeNull();
    expect(await verifySession("basura")).toBeNull();
  });

  async function visit(path: string, session?: { tid: string | null } | "basura") {
    const request = new NextRequest(new URL(path, "http://localhost:3000"));
    if (session === "basura") request.cookies.set("session", "basura");
    else if (session) request.cookies.set("session", await signSession({ sub: "u1", email: "a@b.com", tid: session.tid }));
    const response = await proxy(request);
    const location = response.headers.get("location");
    return location ? new URL(location).pathname + new URL(location).search : null;
  }

  it("sin sesión al login; sin organización a crearla; con todo, adentro", async () => {
    expect(await visit("/")).toBe("/login");
    expect(await visit("/dashboard/clients")).toBe("/login?next=%2Fdashboard%2Fclients");
    expect(await visit("/dashboard", { tid: null })).toBe("/onboarding");
    expect(await visit("/dashboard", { tid: "t1" })).toBeNull();
    expect(await visit("/", { tid: "t1" })).toBe("/dashboard");
    expect(await visit("/login", { tid: "t1" })).toBe("/dashboard");
    expect(await visit("/login", { tid: null })).toBe("/onboarding");
    expect(await visit("/onboarding", { tid: null })).toBeNull();
  });

  it("una cookie inválida se borra", async () => {
    const request = new NextRequest(new URL("/dashboard", "http://localhost:3000"));
    request.cookies.set("session", "basura");
    expect((await proxy(request)).headers.get("set-cookie")).toMatch(/session=;/);
  });
});

describe("bandeja de demo", () => {
  it("solo con MAIL_TRANSPORT=outbox", async () => {
    const { isOutbox } = await import("@/lib/mail");
    expect(isOutbox({ MAIL_TRANSPORT: "outbox" })).toBe(true);
    expect(isOutbox({})).toBe(false);
    expect(isOutbox({ MAIL_TRANSPORT: "smtp" })).toBe(false);
  });
});
