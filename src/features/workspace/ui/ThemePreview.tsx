import type { ThemeSelection } from "../../../shared/domain/themes";
import { CodeEditor } from "../../../shared/ui/CodeEditor";
import { appThemeId } from "../../../shared/ui/theme";
import { NodeIcon } from "../../explorer/ui/NodeIcon";
import { PREVIEW_ROWS, PREVIEW_SCRIPT, PREVIEW_SELECTED_ROW } from "../domain/themePreview";

interface Props {
  themes: ThemeSelection;
}

/**
 * The chosen themes before applying them: a piece of the interface in the app theme and a script
 * in the code theme. The palettes are scoped to this box (`data-theme`, `data-code-theme`), so the
 * rest of the window keeps the current ones.
 */
export function ThemePreview({ themes }: Props) {
  return (
    <div className="theme-preview" data-theme={appThemeId(themes.app)} data-code-theme={themes.code} aria-label="Vista previa">
      {/* A picture of the interface: nothing in it can be focused or clicked. */}
      <div className="theme-preview-ui" inert>
        <div className="theme-preview-bar">
          <NodeIcon kind="server" size={14} />
          <b>localhost</b>
          <span className="muted">:27017</span>
        </div>
        <ul className="theme-preview-rows">
          {PREVIEW_ROWS.map(({ name, kind }, i) => (
            <li key={name} className={i === PREVIEW_SELECTED_ROW ? "selected" : undefined}>
              <NodeIcon kind={kind} size={14} />
              {name}
            </li>
          ))}
        </ul>
        <div className="theme-preview-buttons">
          <button>Cancelar</button>
          <button className="primary">Aplicar</button>
        </div>
      </div>
      <CodeEditor className="theme-preview-code" value={PREVIEW_SCRIPT} readOnly />
    </div>
  );
}
