import { afterEach, describe, expect, it, vi } from "vitest";

// El envío sin servidor de correo ni base: Nodemailer y la colección
// outbox se sustituyen por espías.
const sendMailSpy = vi.fn(async () => ({}));
const createTransport = vi.fn(() => ({ sendMail: sendMailSpy }));
vi.mock("nodemailer", () => ({ default: { createTransport } }));
const insertOne = vi.fn(async () => ({}));
vi.mock("@/lib/db", () => ({ collections: async () => ({ outbox: { insertOne } }) }));

const { sendMail } = await import("@/lib/mail");
const { plural } = await import("@/lib/format");

const mail = {
  to: "ana@b.com",
  subject: "Hola",
  html: "<p>Hola</p>",
  text: "Hola",
  fromName: "Rayuela",
  headers: { "List-Unsubscribe": "<https://x/baja/1>" },
  attachments: [{ filename: "a.pdf", content: Buffer.from("1234"), contentType: "application/pdf" }],
};

describe("sendMail", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("por SMTP (MailHog en local): una sola conexión reutilizada", async () => {
    await sendMail(mail);
    await sendMail(mail);
    expect(createTransport).toHaveBeenCalledTimes(1);
    expect(createTransport).toHaveBeenCalledWith(expect.objectContaining({ host: "localhost", port: 1025, pool: true }));
    expect(sendMailSpy).toHaveBeenCalledWith(
      expect.objectContaining({ to: "ana@b.com", from: '"Rayuela" <no-responder@cartero.local>', headers: mail.headers }),
    );
    expect(insertOne).not.toHaveBeenCalled();
  });

  it("en la demo (outbox): se guarda en la bandeja y no sale nada", async () => {
    vi.stubEnv("MAIL_TRANSPORT", "outbox");
    await sendMail(mail);
    expect(sendMailSpy).not.toHaveBeenCalled();
    expect(insertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "ana@b.com",
        subject: "Hola",
        attachments: [{ filename: "a.pdf", size: 4, contentType: "application/pdf" }],
      }),
    );
  });
});

describe("plural", () => {
  it("singular con 1", () => {
    expect(plural(1, "persona", "personas")).toBe("1 persona");
    expect(plural(1200, "persona", "personas")).toBe("1.200 personas");
  });
});
