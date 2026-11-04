// Context menu of each kind of tree node.
import type { ReactNode } from "react";
import type { MenuScriptKind } from "../../shell/domain/menuScripts";
import { isSystemDatabase } from "../domain/mongo";
import { isMissingDatabase, type TreeNode } from "../domain/tree";
import {
  ADD_USER_ICON,
  BACKUP_ICON,
  CLEAR_ICON,
  COPY_TO_ICON,
  CREATE_ICON,
  DISCONNECT_ICON,
  DISTRIBUTION_ICON,
  DOCUMENTS_ICON,
  DROP_ICON,
  DUPLICATE_ICON,
  EDIT_ICON,
  EXTERNAL_ICON,
  HOST_ICON,
  INDEX_ICON,
  INFO_ICON,
  INSERT_ICON,
  LOG_ICON,
  REBUILD_ICON,
  REFRESH_ICON,
  REMOVE_DOCS_ICON,
  REMOVE_FROM_LIST_ICON,
  RENAME_ICON,
  RESTORE_ICON,
  SHARD_ICON,
  SHELL_ICON,
  STATS_ICON,
  STATUS_ICON,
  SYNC_ICON,
  VALIDATION_ICON,
  VIEW_ICON,
} from "./menuIcons";

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
        { label: "Abrir shell", action: "openShell", icon: SHELL_ICON },
        { label: "Abrir en mongosh", action: "openMongosh", icon: EXTERNAL_ICON },
        { label: "Refrescar", action: "refresh", icon: REFRESH_ICON },
        { label: "Crear base de datos…", action: "createDatabase", icon: CREATE_ICON },
        "sep",
        { label: "Estado del servidor", action: "serverStatus", icon: STATUS_ICON },
        { label: "Info del host", action: "hostInfo", icon: HOST_ICON },
        { label: "Versión de MongoDB", action: "buildInfo", icon: INFO_ICON },
        "sep",
        { label: "Ver log", action: "showLog", icon: LOG_ICON },
        { label: "Desconectar", action: "disconnect", danger: true, icon: DISCONNECT_ICON },
      ];
    case "systemDbs":
      return [];
    case "database":
      // A missing favorite has nothing inside: it can only leave the list.
      if (isMissingDatabase(n)) return [REMOVE_FROM_LIST];
      // Leaving the list and deleting go in groups of their own, each with its icon, so they can't be mixed up.
      return [
        { label: "Abrir shell", action: "openShell", icon: SHELL_ICON },
        { label: "Abrir en mongosh", action: "openMongosh", icon: EXTERNAL_ICON },
        { label: "Refrescar", action: "refresh", icon: REFRESH_ICON },
        { label: "Estadísticas", action: "dbStats", icon: STATS_ICON },
        "sep",
        { label: "Crear colección…", action: "createCollection", icon: CREATE_ICON },
        "sep",
        { label: "Backup…", action: "backupDatabase", icon: BACKUP_ICON },
        { label: "Restaurar…", action: "restoreDatabase", icon: RESTORE_ICON },
        { label: "Sincronizar con otro entorno…", action: "syncDatabase", icon: SYNC_ICON },
        "sep",
        // A system database is always shown: it can't leave the list.
        ...(isSystemDatabase(n.db!) ? [] : [REMOVE_FROM_LIST, "sep" as const]),
        { label: "Eliminar base de datos…", action: "dropDatabase", danger: true, icon: DROP_ICON },
      ];
    case "collections":
      return [
        { label: "Crear colección…", action: "createCollection", icon: CREATE_ICON },
        { label: "Refrescar", action: "refresh", icon: REFRESH_ICON },
      ];
    case "collection": {
      if (n.data?.type === "view") {
        return [
          { label: "Abrir shell", action: "openShell", icon: SHELL_ICON },
          { label: "Ver definición", action: "view", icon: VIEW_ICON },
          { label: "Eliminar vista…", action: "dropCollection", danger: true, icon: DROP_ICON },
        ];
      }
      // The server can't rename a timeseries collection or set a validator on it.
      const timeseries = n.data?.type === "timeseries";
      return [
        { label: "Ver documentos", action: "viewDocuments", icon: DOCUMENTS_ICON },
        "sep",
        { label: "Insertar documento…", action: "insertDocument", icon: INSERT_ICON },
        { label: "Actualizar documentos…", action: "updateDocuments", icon: EDIT_ICON },
        { label: "Eliminar documentos…", action: "removeDocuments", icon: REMOVE_DOCS_ICON },
        { label: "Eliminar todos los documentos…", action: "removeAllDocuments", danger: true, icon: CLEAR_ICON },
        "sep",
        ...(timeseries ? [] : [{ label: "Renombrar colección…", action: "renameCollection", icon: RENAME_ICON } as const]),
        { label: "Duplicar colección…", action: "duplicateCollection", icon: DUPLICATE_ICON },
        { label: "Copiar colección a base de datos…", action: "copyCollection", icon: COPY_TO_ICON },
        { label: "Eliminar colección…", action: "dropCollection", danger: true, icon: DROP_ICON },
        "sep",
        { label: "Backup…", action: "backupDatabase", icon: BACKUP_ICON },
        { label: "Restaurar…", action: "restoreDatabase", icon: RESTORE_ICON },
        { label: "Sincronizar con otro entorno…", action: "syncDatabase", icon: SYNC_ICON },
        "sep",
        { label: "Estadísticas", action: "collStats", icon: STATS_ICON },
        { label: "Añadir índice…", action: "addIndex", icon: INDEX_ICON },
        ...(timeseries ? [] : [{ label: "Validación…", action: "editValidation", icon: VALIDATION_ICON } as const]),
        "sep",
        { label: "Versión de shard", action: "shardVersion", icon: SHARD_ICON },
        { label: "Distribución de shards", action: "shardDistribution", icon: DISTRIBUTION_ICON },
      ];
    }
    case "indexes":
      return [
        { label: "Ver índices", action: "viewIndexes", icon: INDEX_ICON },
        { label: "Añadir índice…", action: "addIndex", icon: INDEX_ICON },
        { label: "Reconstruir índices…", action: "rebuildIndexes", icon: REBUILD_ICON },
        "sep",
        { label: "Refrescar", action: "refresh", icon: REFRESH_ICON },
      ];
    case "index": {
      const isId = n.label === "_id_";
      return [
        { label: "Editar índice…", action: "editIndex", disabled: isId, icon: EDIT_ICON },
        { label: "Eliminar índice…", action: "dropIndex", danger: true, disabled: isId, icon: DROP_ICON },
      ];
    }
    case "users":
      return [
        { label: "Añadir usuario…", action: "addUser", icon: ADD_USER_ICON },
        { label: "Refrescar", action: "refresh", icon: REFRESH_ICON },
      ];
    case "functions":
    case "systemCollections":
      return [{ label: "Refrescar", action: "refresh", icon: REFRESH_ICON }];
    case "user":
      return [
        { label: "Ver usuario", action: "view", icon: VIEW_ICON },
        { label: "Editar usuario…", action: "editUser", icon: EDIT_ICON },
        { label: "Eliminar usuario…", action: "dropUser", danger: true, icon: DROP_ICON },
      ];
    case "function":
      return [
        { label: "Ver función", action: "view", icon: VIEW_ICON },
        { label: "Eliminar función…", action: "removeFunction", danger: true, icon: DROP_ICON },
      ];
  }
}
