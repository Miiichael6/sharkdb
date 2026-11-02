// MongoDB's own databases and collections: they can be deleted like any other, but the server depends on them.

export const SYSTEM_DATABASES = ["admin", "config", "local"];

/** MongoDB's own databases (admin, config, local). */
export const isSystemDatabase = (name: string) => SYSTEM_DATABASES.includes(name);

/** MongoDB's internal collections (`system.users`, `system.js`, `system.views`…). */
export const isSystemCollection = (name: string) => name.startsWith("system.");

const DATABASE_PURPOSE: Record<string, string> = {
  admin: "guarda los usuarios, los roles y la configuración del servidor",
  config: "guarda los metadatos del sharding y de las sesiones",
  local: "guarda el oplog y la configuración de réplica de este nodo",
};

/** Why touching `db` (and `coll` inside it) is risky, or undefined when both are the user's own. */
export function systemNamespaceWarning(db?: string, coll?: string): string | undefined {
  if (coll && isSystemCollection(coll)) {
    return `“${coll}” es una colección interna de MongoDB: el servidor depende de ella.`;
  }
  if (db && isSystemDatabase(db)) {
    return `“${db}” es una base de datos del sistema: ${DATABASE_PURPOSE[db]}.`;
  }
  return undefined;
}
