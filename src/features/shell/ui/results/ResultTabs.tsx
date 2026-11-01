import { useId, useRef } from "react";
import { resultTitle, type ResultEntry } from "../../domain/resultLayout";
import { useActivePill } from "../useActivePill";
import type { RunState } from "../useShellRun";
import { ConsoleView } from "./ConsoleView";
import { ResultEntryView } from "./ResultEntryView";
import type { ResultTabsState } from "./useResultTabs";
import { useTrackScroll } from "./useTrackScroll";
import type { ResultViews } from "./useResultView";

interface Props {
  sid: string;
  entries: ResultEntry[];
  run: RunState;
  /** Which tabs are open and shown, kept by the panel, whose toolbar sets the shown one's view. */
  tabs: ResultTabsState;
  views: ResultViews;
  onGoToLine: (line: number) => void;
}

const MIDDLE_BUTTON = 1;

/**
 * Many results in sub-tabs, drawn like the shell tabs: a segmented control whose highlight slides to
 * the selected one, each with its ×. When they don't fit, tabs keep a fixed width and the track
 * scrolls, with arrows at both ends. Hidden tabs stay mounted, so each cursor keeps its own page;
 * closing a tab frees its cursor and forgets its view. Each tab has its own view; in the Console one it
 * lists only its statement.
 */
export function ResultTabs({ sid, entries, run, tabs, views, onGoToLine }: Props) {
  const { open, selected, select, close, onPanelKeyDown, onListKeyDown } = tabs;
  const id = useId();
  const tabId = (i: number) => `${id}-tab-${i}`;
  const panelId = (i: number) => `${id}-panel-${i}`;
  const track = useRef<HTMLDivElement>(null);
  const selectedId = open.length ? tabId(open[selected]) : null;
  const { pill, ready } = useActivePill(track, selectedId, open.join());
  const scroll = useTrackScroll(track, selectedId, open.join());

  const closeTab = (position: number) => {
    const entry = entries[open[position]];
    if (entry.kind === "statement" && entry.value) run.pagers.get(entry.value.index)?.close().catch(() => {});
    views.reset(open[position]);
    close(position);
  };

  if (!open.length) return <div className="script-output muted small">Se cerraron todos los resultados.</div>;
  return (
    <div className="result-tabs" onKeyDown={onPanelKeyDown}>
      <div className="tab-bar result-tab-bar">
        {scroll.overflows && (
          <button className="result-tab-arrow" aria-label="Resultados anteriores" disabled={scroll.atStart} onClick={() => scroll.page(-1)}>
            ‹
          </button>
        )}
        <div ref={track} className="tab-track" role="tablist" aria-label="Resultados" onKeyDown={onListKeyDown} onWheel={scroll.onWheel}>
          {pill && (
            <span aria-hidden className={`tab-pill ${ready ? "ready" : ""}`} style={{ transform: `translateX(${pill.left}px)`, width: pill.width }} />
          )}
          {open.map((index, position) => {
            const entry = entries[index];
            const title = resultTitle(entry);
            const active = position === selected;
            return (
              <div
                key={index}
                id={tabId(index)}
                data-tab-id={tabId(index)}
                role="tab"
                aria-selected={active}
                aria-controls={panelId(index)}
                tabIndex={active ? 0 : -1}
                title={title}
                className={`tab ${active ? "active" : ""} ${entry.kind === "error" ? "error" : ""}`}
                onClick={() => select(position)}
                onMouseDown={(e) => e.button === MIDDLE_BUTTON && (e.preventDefault(), closeTab(position))}
              >
                <span className="tab-title">{title}</span>
                <button
                  className="tab-close"
                  tabIndex={-1}
                  aria-label={`Cerrar ${title}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(position);
                  }}
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
        {scroll.overflows && (
          <button className="result-tab-arrow" aria-label="Resultados siguientes" disabled={scroll.atEnd} onClick={() => scroll.page(1)}>
            ›
          </button>
        )}
      </div>
      {open.map((index, position) => {
        const view = views.stateOf([index]);
        return (
          <div
            key={index}
            id={panelId(index)}
            role="tabpanel"
            aria-labelledby={tabId(index)}
            hidden={position !== selected}
            className="script-output result-tab-panel"
          >
            {view.mode === "console" ? (
              <ConsoleView outcome={run.outcome!} run={run} view={view} entry={entries[index]} onGoToLine={onGoToLine} />
            ) : (
              <ResultEntryView sid={sid} entry={entries[index]} run={run} view={view} />
            )}
          </div>
        );
      })}
    </div>
  );
}
