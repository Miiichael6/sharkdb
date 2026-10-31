import { Fragment } from "react";
import type { BarEntry } from "../domain/splitTabs";
import { isDirty } from "../domain/tabs";
import { COLUMNS_ICON } from "./splitIcons";

/** What a bar entry shows: its title or, for a split, both panes' titles around the columns icon, the active one stronger. */
export function TabFace({ entry }: { entry: BarEntry }) {
  const dirty = entry.panes.some(isDirty) && <span aria-label="sin guardar"> •</span>;
  if (entry.panes.length === 1) {
    return (
      <span className="tab-title">
        {entry.panes[0].title}
        {dirty}
      </span>
    );
  }
  // The columns icon sits in the middle, each pane's title centred in its half.
  return (
    <span className="tab-title tab-split">
      {entry.panes.map((pane, i) => (
        <Fragment key={pane.id}>
          {i === 1 && <span className="tab-split-icon">{COLUMNS_ICON}</span>}
          <span className={`tab-split-name ${entry.activePane === i ? "current" : ""}`}>{pane.title}</span>
        </Fragment>
      ))}
      {dirty}
    </span>
  );
}
