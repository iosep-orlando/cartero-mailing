/** Hasta 5 MB por adjunto: los servidores de correo suelen rechazar mails de más de 10-25 MB. */
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

/** Sin rutas, sin caracteres de control y con largo razonable. */
export function cleanFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  return base.replace(/[\u0000-\u001f\u007f"]/g, "").trim().slice(0, 120);
}

const TYPES: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  txt: "text/plain",
  csv: "text/csv",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  zip: "application/zip",
};

/** El tipo por la extensión; lo desconocido va como binario genérico. */
export function guessContentType(filename: string): string {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  return TYPES[ext] ?? "application/octet-stream";
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}
