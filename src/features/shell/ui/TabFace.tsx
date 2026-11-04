import { Fragment } from "react";
import { LockIcon } from "../../../shared/ui/LockIcon";
import type { BarEntry } from "../domain/splitTabs";
import type { TabConnection } from "../domain/tabConnection";
import { isDirty } from "../domain/tabs";
import { COLUMNS_ICON } from "./splitIcons";

const LOCK_SIZE_PX = 11;

/** Lock before a pane's title when its connection is production or protected. */
const guardLock = (conn: TabConnection | null) =>
  conn?.guard && (
    <span className="tab-lock">
      <LockIcon size={LOCK_SIZE_PX} />
    </span>
  );

interface Props {
  entry: BarEntry;
  /** Each pane's connection (null when deleted), in pane order. */
  connections: (TabConnection | null)[];
}

/** What a bar entry shows: its title or, for a split, both panes' titles around the columns icon, the active one stronger. */
export function TabFace({ entry, connections }: Props) {
  const dirty = entry.panes.some(isDirty) && <span aria-label="sin guardar"> •</span>;
  if (entry.panes.length === 1) {
    return (
      <span className="tab-title">
        {guardLock(connections[0])}
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
          <span className={`tab-split-name ${entry.activePane === i ? "current" : ""}`}>
            {guardLock(connections[i])}
            {pane.title}
          </span>
        </Fragment>
      ))}
      {dirty}
    </span>
  );
}
