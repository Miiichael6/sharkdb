import { useState, type MouseEvent } from "react";
import { Spinner } from "../../../shared/ui/common";
import { ContextMenu } from "../../../shared/ui/ContextMenu";
import { DROP_ICON, DUPLICATE_ICON } from "../../explorer/ui/menuIcons";
import { DEFAULT_SCHEDULE_NAME, repeatShort, type BackupSchedule } from "../domain/schedule";

interface Props {
  schedules: BackupSchedule[];
  /** The schedule whose backup is running now: shown apart, above the others, whatever the search. */
  running: BackupSchedule | null;
  selectedId: string | null;
  /** Nothing matches the search, though there are schedules. */
  filtered: boolean;
  onSelect: (id: string | null) => void;
  onToggle: (schedule: BackupSchedule, enabled: boolean) => void;
  onRun: (schedule: BackupSchedule) => void;
  onDuplicate: (schedule: BackupSchedule) => void;
  onDelete: (schedule: BackupSchedule) => void;
  /** Cancels the running backup; missing while it's still starting. */
  onCancelRun: (() => void) | undefined;
  /** Why its switch can't be turned on, if it can't. */
  enableBlockerOf: (schedule: BackupSchedule) => string | null;
  /** Why ▶ can't run it, if it can't. */
  runBlockerOf: (schedule: BackupSchedule) => string | null;
}

interface MenuState {
  x: number;
  y: number;
  schedule: BackupSchedule;
}

const PLAY_ICON = (
  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
    <path d="M3 1.5v9l7.5-4.5z" fill="currentColor" />
  </svg>
);

const STOP_ICON = (
  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
    <rect x="2" y="2" width="8" height="8" rx="1.5" fill="currentColor" />
  </svg>
);

/**
 * The backup schedules, like TablePlus': name and when it runs, the switch that turns one on, and ▶ to run it now.
 * One backup runs at a time; while it does, it sits in "Ejecutando" above the rest and every other ▶ waits.
 */
export function ScheduleList(props: Props) {
  const { schedules, running, selectedId, filtered, onSelect, onToggle, onRun, onDuplicate, onDelete, onCancelRun } = props;
  const { enableBlockerOf, runBlockerOf } = props;
  const [menu, setMenu] = useState<MenuState | null>(null);
  const waiting = schedules.filter((s) => s.id !== running?.id);

  const row = (s: BackupSchedule) => {
    const switchBlocked = enableBlockerOf(s);
    const runBlocked = runBlockerOf(s);
    const stop = (e: MouseEvent) => e.stopPropagation();
    return (
      <li
        key={s.id}
        role="option"
        aria-selected={s.id === selectedId}
        className={`schedule-item ${s.id === selectedId ? "selected" : ""}`}
        onClick={(e) => {
          stop(e);
          onSelect(s.id);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          onSelect(s.id);
          setMenu({ x: e.clientX, y: e.clientY, schedule: s });
        }}
      >
        <span className="schedule-name" title={s.name || DEFAULT_SCHEDULE_NAME}>
          {s.name || DEFAULT_SCHEDULE_NAME}
        </span>
        <span className="schedule-time muted" title={repeatShort(s)}>
          {repeatShort(s)}
        </span>
        {s.id === running?.id ? (
          <>
            <Spinner />
            <button
              className="ghost schedule-run schedule-cancel"
              title="Cancelar el backup"
              aria-label={`Cancelar el backup ${s.name}`}
              disabled={!onCancelRun}
              onClick={(e) => {
                stop(e);
                onCancelRun?.();
              }}
            >
              {STOP_ICON}
            </button>
          </>
        ) : (
          <>
            <label className="switch" title={switchBlocked ?? (s.enabled ? "Activo" : "Desactivado")} onClick={stop}>
              <input
                type="checkbox"
                checked={s.enabled && !switchBlocked}
                disabled={!!switchBlocked}
                onChange={(e) => onToggle(s, e.target.checked)}
                aria-label={`Activar ${s.name}`}
              />
              <span aria-hidden />
            </label>
            <button
              className="ghost schedule-run"
              title={runBlocked ?? "Ejecutar el backup"}
              aria-label={`Ejecutar el backup ${s.name}`}
              disabled={!!runBlocked}
              onClick={(e) => {
                stop(e);
                onRun(s);
              }}
            >
              {PLAY_ICON}
            </button>
          </>
        )}
      </li>
    );
  };

  return (
    <>
      {running && (
        <section className="schedule-running" aria-label="Ejecutando">
          <h4 className="schedule-running-title">Ejecutando</h4>
          <ul className="schedule-list" role="listbox" aria-label="Backup en curso">
            {row(running)}
          </ul>
        </section>
      )}
      {waiting.length ? (
        <ul className="schedule-list" role="listbox" aria-label="Backups programados" onClick={() => onSelect(null)}>
          {waiting.map(row)}
        </ul>
      ) : (
        !running && (
          <p className="schedule-empty muted">
            {filtered ? "Ningún backup coincide." : "Todavía no hay backups programados. Crea uno con +."}
          </p>
        )
      )}
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          label="Backup programado"
          onClose={() => setMenu(null)}
          items={[
            { label: "Ejecutar", icon: PLAY_ICON, onSelect: () => onRun(menu.schedule), disabled: !!runBlockerOf(menu.schedule) },
            { label: "Duplicar", icon: DUPLICATE_ICON, onSelect: () => onDuplicate(menu.schedule) },
            { label: "Eliminar", icon: DROP_ICON, onSelect: () => onDelete(menu.schedule), danger: true, separatorBefore: true },
          ]}
        />
      )}
    </>
  );
}
