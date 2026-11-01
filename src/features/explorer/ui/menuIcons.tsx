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
