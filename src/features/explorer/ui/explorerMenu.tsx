// Context menu of each kind of tree node.
import type { ReactNode } from "react";
import type { MenuScriptKind } from "../../shell/domain/menuScripts";
import { isSystemDatabase } from "../domain/mongo";
import { isMissingDatabase, type TreeNode } from "../domain/tree";
import { DROP_ICON, REMOVE_FROM_LIST_ICON } from "./menuIcons";

export type Action =
  | "openShell"
  | "openMongosh"
  | "refresh"
  | "createDatabase"
  | "serverStatus"
  | "hostInfo"
  | "buildInfo"
  | "disconnect"
  | "dbStats"
  | "createCollection"
  | "dropDatabase"
  | "removeFromList"
  | "collStats"
  | "addIndex"
  | "editValidation"
  | "insertDocument"
  | "removeAllDocuments"
  | "renameCollection"
  | "dropCollection"
  | "editIndex"
  | "dropIndex"
  | "rebuildIndexes"
  | "view"
  | "addUser"
  | "editUser"
  | "dropUser"
  | "copyCollection"
  | "duplicateCollection"
  | "removeFunction"
  | "backupDatabase"
  | "restoreDatabase"
  | "syncDatabase"
  | MenuScriptKind;

export type MenuItem = { label: string; action: Action; danger?: boolean; disabled?: boolean; icon?: ReactNode } | "sep";

/** Hides a database from the explorer without touching the server. */
const REMOVE_FROM_LIST: MenuItem = { label: "Quitar de la lista", action: "removeFromList", icon: REMOVE_FROM_LIST_ICON };

// Same order as Robo 3T's context menus, minus the actions that aren't built yet.
export function menuFor(n: TreeNode): MenuItem[] {
  switch (n.kind) {
    case "server":
      return [
        { label: "Abrir shell", action: "openShell" },
        { label: "Abrir en mongosh", action: "openMongosh" },
        { label: "Refrescar", action: "refresh" },
        { label: "Crear base de datos…", action: "createDatabase" },
        "sep",
        { label: "Estado del servidor", action: "serverStatus" },
        { label: "Info del host", action: "hostInfo" },
        { label: "Versión de MongoDB", action: "buildInfo" },
        "sep",
        { label: "Ver log", action: "showLog" },
        { label: "Desconectar", action: "disconnect" },
      ];
    case "systemDbs":
      return [];
    case "database":
      // A missing favorite has nothing inside: it can only leave the list.
      if (isMissingDatabase(n)) return [REMOVE_FROM_LIST];
      // Leaving the list and deleting go in groups of their own, each with its icon, so they can't be mixed up.
      return [
        { label: "Abrir shell", action: "openShell" },
        { label: "Abrir en mongosh", action: "openMongosh" },
        { label: "Refrescar", action: "refresh" },
        { label: "Estadísticas", action: "dbStats" },
        "sep",
        { label: "Crear colección…", action: "createCollection" },
        "sep",
        { label: "Backup…", action: "backupDatabase" },
        { label: "Restaurar…", action: "restoreDatabase" },
        { label: "Sincronizar con otro entorno…", action: "syncDatabase" },
        "sep",
        // A system database is always shown: it can't leave the list.
        ...(isSystemDatabase(n.db!) ? [] : [REMOVE_FROM_LIST, "sep" as const]),
        { label: "Eliminar base de datos…", action: "dropDatabase", danger: true, icon: DROP_ICON },
      ];
    case "collections":
      return [
        { label: "Crear colección…", action: "createCollection" },
        { label: "Refrescar", action: "refresh" },
      ];
    case "collection":
      if (n.data?.type === "view") {
        return [
          { label: "Abrir shell", action: "openShell" },
          { label: "Ver definición", action: "view" },
          { label: "Eliminar vista…", action: "dropCollection", danger: true },
        ];
      }
      return [
        { label: "Ver documentos", action: "viewDocuments" },
        "sep",
        { label: "Insertar documento…", action: "insertDocument" },
        { label: "Actualizar documentos…", action: "updateDocuments" },
        { label: "Eliminar documentos…", action: "removeDocuments" },
        { label: "Eliminar todos los documentos…", action: "removeAllDocuments", danger: true },
        "sep",
        { label: "Renombrar colección…", action: "renameCollection" },
        { label: "Duplicar colección…", action: "duplicateCollection" },
        { label: "Copiar colección a base de datos…", action: "copyCollection" },
        { label: "Eliminar colección…", action: "dropCollection", danger: true },
        "sep",
        { label: "Backup…", action: "backupDatabase" },
        { label: "Restaurar…", action: "restoreDatabase" },
        { label: "Sincronizar con otro entorno…", action: "syncDatabase" },
        "sep",
        { label: "Estadísticas", action: "collStats" },
        { label: "Añadir índice…", action: "addIndex" },
        { label: "Validación…", action: "editValidation" },
        "sep",
        { label: "Versión de shard", action: "shardVersion" },
        { label: "Distribución de shards", action: "shardDistribution" },
      ];
    case "indexes":
      return [
        { label: "Ver índices", action: "viewIndexes" },
        { label: "Añadir índice…", action: "addIndex" },
        { label: "Reconstruir índices…", action: "rebuildIndexes" },
        "sep",
        { label: "Refrescar", action: "refresh" },
      ];
    case "index": {
      const isId = n.label === "_id_";
      return [
        { label: "Editar índice…", action: "editIndex", disabled: isId },
        { label: "Eliminar índice…", action: "dropIndex", danger: true, disabled: isId },
      ];
    }
    case "users":
      return [
        { label: "Añadir usuario…", action: "addUser" },
        { label: "Refrescar", action: "refresh" },
      ];
    case "functions":
    case "systemCollections":
      return [{ label: "Refrescar", action: "refresh" }];
    case "user":
      return [
        { label: "Ver usuario", action: "view" },
        { label: "Editar usuario…", action: "editUser" },
        { label: "Eliminar usuario…", action: "dropUser", danger: true },
      ];
    case "function":
      return [
        { label: "Ver función", action: "view" },
        { label: "Eliminar función…", action: "removeFunction", danger: true },
      ];
  }
}
