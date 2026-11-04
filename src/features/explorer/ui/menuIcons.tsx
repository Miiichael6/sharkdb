// Icons of the context menus: they tell apart entries easy to confuse (hiding a database or deleting
// it) and let the connection's entries be found at a glance.

const line = { fill: "none", stroke: "currentColor", strokeWidth: 1.1, strokeLinecap: "round", strokeLinejoin: "round" } as const;

const icon = (d: string) => (
  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
    <path d={d} {...line} />
  </svg>
);

/** "Abrir shell": a prompt. */
export const SHELL_ICON = icon("M1 1.5h10v9H1zM3 4.5l2 1.5-2 1.5M6 8h3");
/** "Abrir en mongosh": a window with an arrow leaving it. */
export const EXTERNAL_ICON = icon("M6.5 1.5h4v4M10.5 1.5 5.5 6.5M9 7.5v3H1.5V3h3");
/** "Refrescar": a circular arrow. */
export const REFRESH_ICON = icon("M10 6a4 4 0 1 1-1.2-2.85M10 1.5v2.2H7.8");
/** "Crear base de datos": a plus. */
export const CREATE_ICON = icon("M6 1.5v9M1.5 6h9");
/** "Estado del servidor": a pulse line. */
export const STATUS_ICON = icon("M1 6h2.2l1.3-3.5 2 7 1.3-3.5H11");
/** "Info del host": a monitor. */
export const HOST_ICON = icon("M1.2 1.8h9.6v6.4H1.2zM6 8.2v2M3.8 10.4h4.4");
/** "Versión de MongoDB": an "i" in a circle. */
export const INFO_ICON = icon("M6 1.2a4.8 4.8 0 1 1 0 9.6 4.8 4.8 0 0 1 0-9.6M6 5.4v3M6 3.6v.1");
/** "Ver log": lines of a page. */
export const LOG_ICON = icon("M2 1.5h8v9H2zM4 4h4M4 6h4M4 8h2.5");
/** "Duplicar": two sheets, one over the other. */
export const DUPLICATE_ICON = icon("M4 4h6.5v6.5H4zM8 4V1.5H1.5V8H4");
/** "Estadísticas": a bar chart. */
export const STATS_ICON = icon("M1.5 10.5h9M3 10.5V6M6 10.5V2.5M9 10.5V4.5");
/** "Backup": an arrow down into a tray. */
export const BACKUP_ICON = icon("M6 1.5v6M3.5 5 6 7.5 8.5 5M1.5 8.5v2h9v-2");
/** "Restaurar": an arrow up out of a tray. */
export const RESTORE_ICON = icon("M6 7.5v-6M3.5 4 6 1.5 8.5 4M1.5 8.5v2h9v-2");
/** "Sincronizar con otro entorno": two opposite arrows. */
export const SYNC_ICON = icon("M1.5 4h8.5L8 2M10.5 8H2l2 2");
/** "Ver documentos": a pair of braces. */
export const DOCUMENTS_ICON = icon(
  "M4 1.5c-1.1 0-1.5.5-1.5 1.5v1.6c0 .7-.4 1.4-1 1.4.6 0 1 .7 1 1.4V9c0 1 .4 1.5 1.5 1.5M8 1.5c1.1 0 1.5.5 1.5 1.5v1.6c0 .7.4 1.4 1 1.4-.6 0-1 .7-1 1.4V9c0 1-.4 1.5-1.5 1.5",
);
/** "Insertar documento": a sheet with a plus. */
export const INSERT_ICON = icon("M7 1.5H2.5v9h7V4zM7 1.5V4h2.5M6 5.5v3.5M4.25 7.25h3.5");
/** "Actualizar documentos", "Editar …": a pencil. */
export const EDIT_ICON = icon("M8 1.8 10.2 4l-6 6H2V7.8zM6.8 3 9 5.2");
/** "Eliminar documentos": a sheet with a minus. */
export const REMOVE_DOCS_ICON = icon("M7 1.5H2.5v9h7V4zM7 1.5V4h2.5M4.25 7.25h3.5");
/** "Eliminar todos los documentos": a sheet crossed out. */
export const CLEAR_ICON = icon("M7 1.5H2.5v9h7V4zM7 1.5V4h2.5M4.5 5.75l3 3M7.5 5.75l-3 3");
/** "Renombrar": text with a cursor. */
export const RENAME_ICON = icon("M1 4.5h5.5M1 7.5h5.5M9.5 2v8M8.3 2h2.4M8.3 10h2.4");
/** "Copiar colección a base de datos": an arrow into a bar. */
export const COPY_TO_ICON = icon("M1.5 6h6.5M6 4l2 2-2 2M10.5 1.5v9");
/** "Añadir índice", "Ver índices": sorted lines. */
export const INDEX_ICON = icon("M1.5 3h5M1.5 6h3.5M1.5 9h2M9 2v8M7.5 8.5 9 10l1.5-1.5");
/** "Reconstruir índices": a hammer. */
export const REBUILD_ICON = icon("M2 10.2 6.3 5.9M5.2 2.6l4.2 4.2M6.2 1.6l4.2 4.2-1.4 1.4-4.2-4.2z");
/** "Validación": a shield with a check. */
export const VALIDATION_ICON = icon("M6 1.2 10 2.7v3c0 2.4-1.7 4.3-4 5.1-2.3-.8-4-2.7-4-5.1v-3zM4.2 6l1.3 1.3 2.4-2.6");
/** "Versión de shard": pieces of a split block. */
export const SHARD_ICON = icon("M1.5 1.5h4v4h-4zM6.5 6.5h4v4h-4zM6.5 1.5h4v4M1.5 6.5v4h4");
/** "Distribución de shards": a pie. */
export const DISTRIBUTION_ICON = icon("M6 1.2a4.8 4.8 0 1 1 0 9.6 4.8 4.8 0 0 1 0-9.6M6 1.2V6l3.4 3.4");
/** "Ver definición", "Ver usuario", "Ver función": an eye. */
export const VIEW_ICON = icon("M1 6s1.8-3.5 5-3.5S11 6 11 6s-1.8 3.5-5 3.5S1 6 1 6zM6 4.6a1.4 1.4 0 1 1 0 2.8 1.4 1.4 0 0 1 0-2.8");
/** "Añadir usuario": a person with a plus. */
export const ADD_USER_ICON = icon("M4.5 5.5a2 2 0 1 1 0-4 2 2 0 0 1 0 4M1 10.5c0-2 1.6-3.5 3.5-3.5S8 8.5 8 10.5M9.5 3v3M8 4.5h3");

/** "Desconectar": a plug pulled apart. */
export const DISCONNECT_ICON = icon("M1.5 10.5 3.5 8.5M3 6l3 3M2.8 6.2l1.3-1.3a1.8 1.8 0 0 1 2.6 0l.4.4M10.5 1.5 8.5 3.5M9.2 5.8 7.9 7.1a1.8 1.8 0 0 1-2.6 0l-.4-.4M6 3l3 3");

/** "Quitar de la lista": a list with a minus, nothing is deleted. */
export const REMOVE_FROM_LIST_ICON = (
  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
    <path d="M1 2.5h7M1 5.5h7M1 8.5h4M7.5 9h4" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
  </svg>
);

/** "Eliminar base de datos": a trash can. */
export const DROP_ICON = (
  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
    <path
      d="M1.5 3h9M4.5 3V1.5h3V3M2.5 3l.6 7.5h5.8L9.5 3M5 5v3.5M7 5v3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.1"
      strokeLinejoin="round"
    />
  </svg>
);
