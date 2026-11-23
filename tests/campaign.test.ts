import { describe, expect, it } from "vitest";
import {
  buildMessage,
  canEdit,
  canSchedule,
  canSend,
  canUnschedule,
  compileSnapshot,
  htmlToText,
  isRecipientAllowed,
  parseAllowlist,
  rate,
} from "@/lib/campaign";
import { verifyToken } from "@/lib/tracking";

const ID = "6740f1a2b3c4d5e6f7a8b9c0";

describe("estados", () => {
  it("qué se puede hacer en cada uno", () => {
    expect(canEdit("draft")).toBe(true);
    expect(canEdit("scheduled")).toBe(false);
    expect(canSend("scheduled")).toBe(true);
    expect(canSend("sent")).toBe(false);
    expect(canSend("sending")).toBe(false);
    expect(canSchedule("draft")).toBe(true);
    expect(canSchedule("sent")).toBe(false);
    expect(canUnschedule("scheduled")).toBe(true);
    expect(canUnschedule("draft")).toBe(false);
  });
});

describe("modo demo", () => {
  it("lista de emails y dominios", () => {
    const list = parseAllowlist(" yo@gmail.com, @Ejemplo.com ,");
    expect(list).toEqual(["yo@gmail.com", "@ejemplo.com"]);
    expect(isRecipientAllowed("YO@gmail.com", list)).toBe(true);
    expect(isRecipientAllowed("ana@ejemplo.com", list)).toBe(true);
    expect(isRecipientAllowed("ana@otro.com", list)).toBe(false);
    expect(isRecipientAllowed("ana@ejemplo.com.ar", list)).toBe(false);
    expect(parseAllowlist("")).toBeNull();
    expect(isRecipientAllowed("cualquiera@x.com", null)).toBe(true);
  });
});

describe("buildMessage", () => {
  const compiled = compileSnapshot({
    subject: "Hola {{firstName}}",
    html: '<body><p>{{organization}}</p><a href="https://ej.com/oferta">Ver</a></body>',
  });
  const message = buildMessage(compiled, {
    base: "https://app.test",
    deliveryId: ID,
    client: { name: "Ana Pérez", email: "ana@b.com" },
    organization: "Rayuela & Cía",
  });

  it("personaliza, agrega la baja al pie y el píxel, y cuenta clics", () => {
    expect(message.subject).toBe("Hola Ana");
    expect(message.html).toContain("Rayuela &amp; Cía"); // escapado
    expect(message.html).toMatch(/Darte de baja<\/a>/);
    expect(message.html).toContain("https://app.test/api/t/o/");
    expect(message.html).toContain("https://app.test/api/t/c/");
    expect(message.html).not.toContain('href="https://ej.com/oferta"');
  });

  it("cabeceras List-Unsubscribe con un enlace de baja válido", () => {
    const url = message.headers["List-Unsubscribe"].slice(1, -1);
    expect(message.headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    expect(verifyToken("unsubscribe", url.split("/baja/")[1])).toBe(ID);
    // La baja no se envuelve con seguimiento de clics.
    expect(message.html).toContain(`href="${url}"`);
  });

  it("si la plantilla ya usa {{unsubscribeUrl}}, no se repite al pie", () => {
    const own = buildMessage(compileSnapshot({ subject: "s", html: '<a href="{{unsubscribeUrl}}">salir</a>' }), {
      base: "https://app.test",
      deliveryId: ID,
      client: { name: "Ana", email: "a@b.com" },
      organization: "R",
    });
    expect(own.html).not.toContain("Darte de baja");
    expect(own.html).toContain(">salir</a>");
  });

  it("versión en texto plano", () => {
    expect(message.text).toContain("Ver (https://ej.com/oferta)");
    expect(message.text).toContain("Darte de baja: https://app.test/baja/");
    expect(htmlToText("<style>x{}</style><p>a&nbsp;&amp; b</p><br>c")).toBe("a & b\n\nc");
  });
});

describe("rate", () => {
  it("porcentaje entero", () => {
    expect(rate(1, 3)).toBe(33);
    expect(rate(0, 0)).toBe(0);
  });
});

describe("classifySendError", () => {
  const smtp = (responseCode: number, response: string, code = "EENVELOPE") =>
    Object.assign(new Error(response), { responseCode, response, code });

  it("550/551/553: la dirección no existe → falla ya y rebota", async () => {
    const { classifySendError } = await import("@/lib/campaign");
    for (const code of [550, 551, 553]) {
      const r = classifySendError(smtp(code, `${code} 5.1.1 User unknown`));
      expect(r).toMatchObject({ permanent: true, bounce: true });
      expect(r.reason).toContain("no existe");
      expect(r.reason).toContain(`${code} 5.1.1`);
    }
  });

  it("otros 5xx: definitivo, pero no es culpa de la dirección", async () => {
    const { classifySendError } = await import("@/lib/campaign");
    expect(classifySendError(smtp(554, "554 Message rejected as spam"))).toMatchObject({ permanent: true, bounce: false });
  });

  it("4xx y conexión caída: pasajero, se reintenta", async () => {
    const { classifySendError } = await import("@/lib/campaign");
    expect(classifySendError(smtp(452, "452 Mailbox full"))).toMatchObject({ permanent: false, bounce: false });
    const down = Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:1025"), { code: "ESOCKET" });
    expect(classifySendError(down)).toEqual({ permanent: false, bounce: false, reason: "connect ECONNREFUSED 127.0.0.1:1025" });
    expect(classifySendError("raro").permanent).toBe(false);
  });

  it("usuario o clave del SMTP mal: definitivo, sin rebote", async () => {
    const { classifySendError } = await import("@/lib/campaign");
    const auth = Object.assign(new Error("Invalid login: 535 bad credentials"), { code: "EAUTH" });
    expect(classifySendError(auth)).toMatchObject({ permanent: true, bounce: false });
    expect(classifySendError(auth).reason).toContain("usuario o la clave");
  });
});
