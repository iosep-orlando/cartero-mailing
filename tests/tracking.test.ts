import { afterEach, describe, expect, it, vi } from "vitest";
import { addPixel, clickUrl, signToken, trackLinks, unsubscribeUrl, verifyToken } from "@/lib/tracking";

const ID = "6740f1a2b3c4d5e6f7a8b9c0";

describe("enlaces firmados", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("ida y vuelta, y cada tipo con su propia firma", () => {
    expect(verifyToken("open", signToken("open", ID))).toBe(ID);
    // Una firma de apertura no sirve para dar de baja.
    expect(verifyToken("unsubscribe", signToken("open", ID))).toBeNull();
  });

  it("otro id, firma alterada, basura u otro secreto: nada", () => {
    const token = signToken("unsubscribe", ID);
    const otherId = "6740f1a2b3c4d5e6f7a8b9c1";
    expect(verifyToken("unsubscribe", token.replace(ID, otherId))).toBeNull();
    expect(verifyToken("unsubscribe", token.slice(0, -2) + "xx")).toBeNull();
    expect(verifyToken("unsubscribe", "nada")).toBeNull();
    expect(verifyToken("unsubscribe", "zz.zz")).toBeNull();
    vi.stubEnv("JWT_SECRET", "otro");
    expect(verifyToken("unsubscribe", token)).toBeNull();
  });

  it("la firma del clic cubre el destino: no sirve para redirigir a otro sitio", () => {
    const url = clickUrl("https://app", ID, "https://ejemplo.com/a?b=1");
    const token = url.split("/api/t/c/")[1].split("?")[0];
    expect(verifyToken("click", token, "https://ejemplo.com/a?b=1")).toBe(ID);
    expect(verifyToken("click", token, "https://malo.com")).toBeNull();
  });

  it("sin JWT_SECRET falla con un mensaje claro", () => {
    vi.stubEnv("JWT_SECRET", "");
    expect(() => signToken("open", ID)).toThrow("JWT_SECRET");
  });
});

describe("trackLinks y addPixel", () => {
  it("envuelve los http(s) y deja mailto, anclas y el enlace de baja", () => {
    const baja = unsubscribeUrl("https://app", ID);
    const html = `<a href="https://ej.com/?a=1&amp;b=2">x</a> <a class="b" href='http://ej.com'>y</a> <a href="mailto:a@b.com">m</a> <a href="#top">t</a> <a href="${baja}">baja</a>`;
    const out = trackLinks(html, (t) => `https://app/c?u=${encodeURIComponent(t)}`, (t) => t === baja);
    expect(out).toContain(`href="https://app/c?u=${encodeURIComponent("https://ej.com/?a=1&b=2")}"`);
    expect(out).toContain(`href='https://app/c?u=${encodeURIComponent("http://ej.com")}'`);
    expect(out).toContain('href="mailto:a@b.com"');
    expect(out).toContain('href="#top"');
    expect(out).toContain(`href="${baja}"`);
  });

  it("el píxel va antes de </body>, o al final", () => {
    expect(addPixel("<body><p>x</p></body>", "P")).toMatch(/<img src="P"[^>]*><\/body>$/);
    expect(addPixel("<p>x</p>", "P")).toMatch(/^<p>x<\/p><img src="P"/);
  });
});
