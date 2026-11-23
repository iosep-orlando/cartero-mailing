import { validateClient, type ClientInput } from "./validation";

// ---------------------------------------------------------------------------
// Importar clientes desde CSV: lo usan la pantalla de clientes y el script
// scripts/import-clients.ts. Columnas: email (obligatoria), name o nombre,
// tags o etiquetas. Separador coma o punto y coma (Excel en español guarda
// con punto y coma).
// ---------------------------------------------------------------------------

/** CSV → filas de celdas. Respeta comillas ("Pérez, Ana") y comillas dobles escapadas. */
export function parseCsv(input: string, delimiter = detectDelimiter(input)): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const text = input.replace(/^﻿/, ""); // el BOM que agrega Excel
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"' && cell === "") quoted = true;
    else if (char === delimiter) {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/** El separador de la primera línea: el que aparece más, entre coma y punto y coma. */
export function detectDelimiter(text: string): "," | ";" {
  const first = text.split(/\r?\n/, 1)[0] ?? "";
  return (first.match(/;/g)?.length ?? 0) > (first.match(/,/g)?.length ?? 0) ? ";" : ",";
}

export interface ImportResult {
  clients: ClientInput[];
  errors: { line: number; error: string }[];
}

export const MAX_IMPORT_ROWS = 5000;

const HEADER: Record<string, keyof ClientInput> = {
  email: "email",
  correo: "email",
  mail: "email",
  "e-mail": "email",
  name: "name",
  nombre: "name",
  tags: "tags",
  etiquetas: "tags",
};

/**
 * Filas → clientes válidos + errores por línea (la 1 es la cabecera).
 * Un email repetido en el mismo archivo cuenta una vez (gana la última fila).
 */
export function rowsToClients(rows: string[][]): ImportResult {
  const [header, ...data] = rows;
  if (!header) return { clients: [], errors: [{ line: 1, error: "El archivo está vacío." }] };
  const columns = header.map((h) => HEADER[h.trim().toLowerCase()]);
  if (!columns.includes("email")) {
    return { clients: [], errors: [{ line: 1, error: "Falta la columna «email» en la primera fila." }] };
  }
  if (data.length > MAX_IMPORT_ROWS) {
    return { clients: [], errors: [{ line: 1, error: `Hasta ${MAX_IMPORT_ROWS} clientes por archivo.` }] };
  }
  const byEmail = new Map<string, ClientInput>();
  const errors: ImportResult["errors"] = [];
  data.forEach((cells, i) => {
    const record: Record<string, string> = {};
    columns.forEach((column, j) => {
      if (column) record[column] = cells[j] ?? "";
    });
    const result = validateClient(record);
    if (result.ok) byEmail.set(result.value.email, result.value);
    else errors.push({ line: i + 2, error: result.error });
  });
  return { clients: [...byEmail.values()], errors };
}
