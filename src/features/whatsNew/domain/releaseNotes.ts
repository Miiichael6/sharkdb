// "Novedades": what each version brings, newest first. Add the entry of a version before releasing it;
// the window appears on its own the first time the app starts in that version (whatsNewWindow.ts).

export type ChangeKind = "nuevo" | "mejora" | "arreglo";

export interface ReleaseNote {
  version: string;
  /** YYYY-MM-DD. */
  date: string;
  changes: { kind: ChangeKind; text: string }[];
}

export const RELEASE_NOTES: ReleaseNote[] = [
  {
    version: "0.1.8",
    date: "2026-11-10",
    changes: [
      { kind: "nuevo", text: "Ventana de Novedades: aparece al estrenar cada versión y desde el menú de ajustes." },
      { kind: "mejora", text: "Nueva conexión abre directamente el formulario de MongoDB, sin el selector de motores." },
      { kind: "mejora", text: "La ventana principal aparece ya pintada, sin parpadeo en blanco al arrancar." },
      { kind: "arreglo", text: "Tab en el editor de código sangra la línea en vez de sacar el foco del editor." },
    ],
  },
  {
    version: "0.1.7",
    date: "2026-11-09",
    changes: [{ kind: "mejora", text: "Panel de detalle con títulos de sección y métricas más claras." }],
  },
  {
    version: "0.1.6",
    date: "2026-11-07",
    changes: [{ kind: "mejora", text: "Botones del mismo tamaño y alineados en el pie de todos los diálogos." }],
  },
  {
    version: "0.1.5",
    date: "2026-11-07",
    changes: [
      { kind: "nuevo", text: "Restaurar sobre una conexión de producción pide confirmación explícita." },
      { kind: "nuevo", text: "Detalle de cada operación con el avance por base de datos y colección." },
      { kind: "nuevo", text: "Renombrar colecciones desde su propia ventana." },
      { kind: "mejora", text: "Las pestañas del shell llevan el color de su conexión." },
      { kind: "arreglo", text: "Los Int32 se leen como número, igual que en mongosh." },
    ],
  },
  {
    version: "0.1.4",
    date: "2026-11-04",
    changes: [
      { kind: "nuevo", text: "Editar en línea valores simples desde la vista árbol." },
      { kind: "nuevo", text: "Ver la definición de una vista en modo lectura." },
      { kind: "mejora", text: "Backups programados de BD completa con retención de los buenos." },
      { kind: "arreglo", text: "Backups de colecciones que solo difieren en mayúsculas." },
    ],
  },
  {
    version: "0.1.3",
    date: "2026-11-02",
    changes: [{ kind: "mejora", text: "Avance global en backups y sincronizaciones." }],
  },
  {
    version: "0.1.2",
    date: "2026-11-02",
    changes: [
      { kind: "nuevo", text: "Actualizador integrado: avisa y se instala la nueva versión." },
      { kind: "mejora", text: "Consola con corchetes coloreados y salida más clara." },
      { kind: "arreglo", text: "Los enteros se guardan como NumberInt al editar documentos." },
    ],
  },
];

/** Splits "1.2.3" into numbers; missing parts count as 0. */
const parts = (version: string) => version.split(".").map((p) => Number.parseInt(p, 10) || 0);

/** Negative when `a` is older than `b`, positive when newer, 0 when equal. */
export function compareVersions(a: string, b: string): number {
  const [x, y] = [parts(a), parts(b)];
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const diff = (x[i] ?? 0) - (y[i] ?? 0);
    if (diff) return diff;
  }
  return 0;
}

/**
 * The notes to show when the app starts in `current` after `lastSeen`: the versions after `lastSeen`
 * up to `current`. Without `lastSeen` (first start, or a version from before this window), only
 * `current`'s. Empty when there's nothing new, or `current` has no notes.
 */
export function unseenNotes(current: string, lastSeen: string | null, notes = RELEASE_NOTES): ReleaseNote[] {
  if (lastSeen !== null && compareVersions(current, lastSeen) <= 0) return [];
  if (!notes.some((n) => n.version === current)) return [];
  return notes.filter((n) =>
    lastSeen === null
      ? n.version === current
      : compareVersions(n.version, lastSeen) > 0 && compareVersions(n.version, current) <= 0,
  );
}
