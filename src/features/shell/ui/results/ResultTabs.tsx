import { useId, useRef } from "react";
import { resultTitle, type ResultEntry } from "../../domain/resultLayout";
import { useActivePill } from "../useActivePill";
import type { RunState } from "../useShellRun";
import { ResultEntryView } from "./ResultEntryView";
import { useResultTabs } from "./useResultTabs";
import { useTrackScroll } from "./useTrackScroll";
import type { ResultViewState } from "./useResultView";

interface Props {
  sid: string;
  entries: ResultEntry[];
  run: RunState;
  view: ResultViewState;
}

const MIDDLE_BUTTON = 1;

/**
 * Many results in sub-tabs, drawn like the shell tabs: a segmented control whose highlight slides to
 * the selected one, each with its ×. When they don't fit, tabs keep a fixed width and the track
 * scrolls, with arrows at both ends. Hidden tabs stay mounted, so each cursor keeps its own page;
 * closing a tab frees its cursor.
 */
export function ResultTabs({ sid, entries, run, view }: Props) {
  const { open, selected, select, close, onPanelKeyDown, onListKeyDown } = useResultTabs(entries.length, run.outcome);
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
      {open.map((index, position) => (
        <div
          key={index}
          id={panelId(index)}
          role="tabpanel"
          aria-labelledby={tabId(index)}
          hidden={position !== selected}
          className="script-output result-tab-panel"
        >
          <ResultEntryView sid={sid} entry={entries[index]} run={run} view={view} />
        </div>
      ))}
    </div>
  );
}
