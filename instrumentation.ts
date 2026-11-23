// Next.js llama a register() una vez, al arrancar el servidor. Acá se pone
// en marcha el worker que manda las campañas (lib/worker.ts), solo en el
// runtime de Node (el de Edge no tiene SMTP ni sockets).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.DISABLE_WORKER !== "1") {
    const { startWorker } = await import("./lib/worker");
    startWorker();
  }
}
