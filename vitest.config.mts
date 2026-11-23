import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    env: {
      JWT_SECRET: "secreto-solo-para-tests",
    },
    coverage: {
      provider: "v8",
      // La lógica que se prueba sin MongoDB ni SMTP en marcha. Las rutas,
      // lib/store/ y el worker son consultas a MongoDB y envíos: se probaron
      // de punta a punta en el navegador (ver README).
      include: [
        "lib/validation.ts",
        "lib/csv.ts",
        "lib/handlebars.ts",
        "lib/tracking.ts",
        "lib/campaign.ts",
        "lib/mail.ts",
        "lib/jwt.ts",
        "lib/format.ts",
        "lib/preview.ts",
        "lib/attachments.ts",
        "lib/search.ts",
        "proxy.ts",
      ],
      reporter: ["text", "text-summary", "cobertura", "html"],
    },
  },
});
