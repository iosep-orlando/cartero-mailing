import { describe, expect, it } from "vitest";
import { MAX_IMPORT_ROWS, detectDelimiter, parseCsv, rowsToClients } from "@/lib/csv";

describe("parseCsv", () => {
  it("comillas, comillas escapadas, CRLF, BOM y filas vacías", () => {
    const csv = '\uFEFFemail,nombre\r\n"ana@b.com","Pérez, Ana ""la de siempre"""\r\n\r\nbeto@b.com,Beto\n';
    expect(parseCsv(csv)).toEqual([
      ["email", "nombre"],
      ["ana@b.com", 'Pérez, Ana "la de siempre"'],
      ["beto@b.com", "Beto"],
    ]);
  });

  it("detecta el punto y coma de Excel en español", () => {
    expect(detectDelimiter("email;nombre;etiquetas\na;b;c")).toBe(";");
    expect(detectDelimiter("email,nombre")).toBe(",");
    expect(parseCsv("email;nombre\na@b.com;Ana")).toEqual([["email", "nombre"], ["a@b.com", "Ana"]]);
  });
});

describe("rowsToClients", () => {
  it("cabeceras en castellano o inglés, errores por línea y emails repetidos", () => {
    const rows = parseCsv(
      'Correo;Nombre;Etiquetas\nana@b.com;Ana;"vip, norte"\nmal-email;X;\nANA@b.com;Ana Pérez;vip\nbeto@b.com;;',
    );
    const result = rowsToClients(rows);
    expect(result.clients).toEqual([
      { email: "ana@b.com", name: "Ana Pérez", tags: ["vip"] },
      { email: "beto@b.com", name: "", tags: [] },
    ]);
    expect(result.errors).toEqual([{ line: 3, error: "Ese email no parece válido." }]);
  });

  it("sin columna email, vacío o demasiado grande", () => {
    expect(rowsToClients([["nombre"], ["Ana"]]).errors[0].error).toContain("email");
    expect(rowsToClients([]).errors[0].error).toContain("vacío");
    const big = [["email"], ...Array.from({ length: MAX_IMPORT_ROWS + 1 }, (_, i) => [`u${i}@b.com`])];
    expect(rowsToClients(big).errors[0].error).toContain(String(MAX_IMPORT_ROWS));
  });
});
