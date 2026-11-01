import { useEffect, useState } from "react";
import { APP_THEME_CHOICES, CODE_THEMES, type ThemeSelection } from "../../../shared/domain/themes";
import { ThemeList } from "./ThemeList";
import { ThemePreview } from "./ThemePreview";

interface Props {
  /** The themes in use when the window opened. */
  data: ThemeSelection;
  /** The chosen themes on Aplicar, null on Cancelar. */
  onDone: (result: ThemeSelection | null) => void;
}

/**
 * "Tema", the content of its own window: the app theme and the code theme, each in its list, and a
 * preview that follows what is picked. Nothing changes until Aplicar; Cancelar or Escape leave it as it was.
 */
export function ThemeDialog({ data, onDone }: Props) {
  const [themes, setThemes] = useState(data);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => e.key === "Escape" && onDone(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDone]);

  return (
    <div className="theme-dialog">
      <div className="theme-dialog-body">
        <div className="theme-dialog-lists">
          <ThemeList label="Aplicación" options={APP_THEME_CHOICES} value={themes.app} onChange={(app) => setThemes((t) => ({ ...t, app }))} autoFocus />
          <ThemeList label="Código" options={CODE_THEMES} value={themes.code} onChange={(code) => setThemes((t) => ({ ...t, code }))} />
        </div>
        <ThemePreview themes={themes} />
      </div>
      <div className="modal-footer">
        <span className="spacer" />
        <button onClick={() => onDone(null)}>Cancelar</button>
        <button className="primary" onClick={() => onDone(themes)}>
          Aplicar
        </button>
      </div>
    </div>
  );
}
