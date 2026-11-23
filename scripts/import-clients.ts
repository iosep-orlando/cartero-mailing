// Importación masiva de clientes desde un CSV, para listas grandes o
// automatizar. Misma lógica que el botón "Importar CSV" del panel.
//
//   npm run import-clients -- <email del dueño o id de la organización> clientes.csv
//
// Columnas: email (obligatoria), nombre/name, etiquetas/tags.
import { readFileSync } from "node:fs";
import { closeDb, collections, toObjectId } from "../lib/db";
import { parseCsv, rowsToClients } from "../lib/csv";
import { importClients } from "../lib/import";

async function main() {
  const [who, file] = process.argv.slice(2);
  if (!who || !file) {
    console.error("Uso: npm run import-clients -- <email del dueño o id de la organización> <archivo.csv>");
    process.exitCode = 1;
    return;
  }
  const { users, memberships, tenants } = await collections();
  let tenantId = toObjectId(who);
  if (!tenantId) {
    const user = await users.findOne({ email: who.toLowerCase() });
    const owned = user ? await memberships.find({ userId: user._id, role: "owner" }).toArray() : [];
    if (owned.length !== 1) {
      console.error(owned.length === 0 ? `${who} no es dueño de ninguna organización.` : `${who} tiene varias organizaciones: pasá el id.`);
      process.exitCode = 1;
      return;
    }
    tenantId = owned[0].tenantId;
  }
  const tenant = await tenants.findOne({ _id: tenantId });
  if (!tenant) {
    console.error("No existe esa organización.");
    process.exitCode = 1;
    return;
  }
  const { clients, errors } = rowsToClients(parseCsv(readFileSync(file, "utf8")));
  const result = await importClients(tenantId, clients);
  console.log(`${tenant.name}: ${result.created} nuevos, ${result.updated} actualizados, ${errors.length} filas con errores.`);
  for (const e of errors.slice(0, 20)) console.log(`  fila ${e.line}: ${e.error}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(closeDb);
