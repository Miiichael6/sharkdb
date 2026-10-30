// Explorer actions that write, so safe mode can disable them before the backend rejects them.
import { isWriteOperation } from "../../connections/domain/safeMode";

/** Server command each writing explorer action ends up sending. */
export const ACTION_COMMANDS: Record<string, string> = {
  createDatabase: "create",
  createCollection: "create",
  dropDatabase: "dropDatabase",
  addIndex: "createIndexes",
  editIndex: "createIndexes",
  dropIndex: "dropIndexes",
  rebuildIndexes: "reIndex",
  insertDocument: "insert",
  updateDocuments: "update",
  removeDocuments: "delete",
  removeAllDocuments: "delete",
  renameCollection: "renameCollection",
  // Copies run `$out`, which creates (or replaces) the target collection.
  duplicateCollection: "create",
  copyCollection: "create",
  dropCollection: "drop",
  addUser: "createUser",
  editUser: "updateUser",
  dropUser: "dropUser",
  removeFunction: "delete",
};

/** Actions that hand the session to a tool safe mode can't restrict (an external mongosh). */
const UNRESTRICTED_ACTIONS = ["openMongosh"];

/** Whether an explorer action (by name) writes to the server. */
export function isWriteAction(action: string): boolean {
  const command = ACTION_COMMANDS[action];
  return command !== undefined && isWriteOperation(command);
}

/** Whether safe mode must block an explorer action: it writes or could write unchecked. */
export const blockedInSafeMode = (action: string) => isWriteAction(action) || UNRESTRICTED_ACTIONS.includes(action);
