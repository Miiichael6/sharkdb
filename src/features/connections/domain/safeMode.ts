// Safe mode: read-only switch of a session. The backend is the one that blocks writes (it has
// its own copy of this policy); the UI uses this one to disable the actions that would write.

export const SAFE_MODE_ERROR = "Safe mode activo: solo lectura";

/** Server commands that change data, indexes, collections, databases or users (lower case). */
const WRITE_COMMANDS = [
  "insert",
  "update",
  "delete",
  "findandmodify",
  "bulkwrite",
  "applyops",
  "create",
  "drop",
  "dropdatabase",
  "renamecollection",
  "collmod",
  "converttocapped",
  "clonecollectionascapped",
  "compact",
  "reindex",
  "createindexes",
  "dropindexes",
  "createuser",
  "updateuser",
  "dropuser",
  "dropallusersfromdatabase",
  "grantrolestouser",
  "revokerolesfromuser",
  "createrole",
  "updaterole",
  "droprole",
  "dropallrolesfromdatabase",
  "grantprivilegestorole",
  "revokeprivilegesfromrole",
  "grantrolestorole",
  "revokerolesfromrole",
  "eval",
  "$eval",
];

/** Shell methods (`db.coll.x()`, `db.x()`) that write (lower case). */
const WRITE_METHODS = [
  "insertone",
  "insertmany",
  "save",
  "updateone",
  "updatemany",
  "replaceone",
  "deleteone",
  "deletemany",
  "remove",
  "findoneandupdate",
  "findoneandreplace",
  "findoneanddelete",
  "createindex",
  "dropindex",
  "createcollection",
  "renamecollection",
  "createuser",
  "updateuser",
  "dropuser",
];

const WRITE_OPERATIONS = new Set([...WRITE_COMMANDS, ...WRITE_METHODS]);

/** Aggregation stages that write their result into a collection. */
const WRITE_STAGES = ["$out", "$merge"];

type Command = Record<string, unknown>;

const isObject = (value: unknown): value is Command => typeof value === "object" && value !== null;

/** Whether an aggregation pipeline writes: some stage is `$out` or `$merge`. */
export function isWritePipeline(pipeline: unknown[]): boolean {
  return pipeline.some((stage) => isObject(stage) && Object.keys(stage).some((k) => WRITE_STAGES.includes(k)));
}

function isWriteCommand(command: Command): boolean {
  const [name] = Object.keys(command);
  if (!name) return false;
  switch (name.toLowerCase()) {
    case "aggregate":
      return Array.isArray(command.pipeline) && isWritePipeline(command.pipeline);
    case "mapreduce":
      // Only `out: { inline: 1 }` keeps the result out of the database.
      return !(isObject(command.out) && "inline" in command.out);
    default:
      return WRITE_OPERATIONS.has(name.toLowerCase());
  }
}

/**
 * Whether an operation writes: a command document as sent to the server (its first key is the
 * command name) or the name of a command or shell method (`insertOne`, `drop`, `dropIndex`...).
 */
export function isWriteOperation(operation: string | Command): boolean {
  return typeof operation === "string" ? WRITE_OPERATIONS.has(operation.toLowerCase()) : isWriteCommand(operation);
}
