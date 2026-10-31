// Icons that tell apart two database entries that are easy to confuse: one hides it, the other deletes it.

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
