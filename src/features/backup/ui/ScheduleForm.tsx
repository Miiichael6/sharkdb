import { displayName, type MongoConnection } from "../../connections/domain/connection";
import { TagBadge } from "../../connections/ui/TagBadge";
import { NodeIcon } from "../../explorer/ui/NodeIcon";
import { MISSING_CONNECTION, backupLabel, folderSafeName, folderTaken, type BackupSchedule } from "../domain/schedule";
import { RepeatFields } from "./RepeatFields";

interface Props {
  schedule: BackupSchedule | null;
  /** The connection it backs up, when it still exists. */
  connection: MongoConnection | undefined;
  /** Another schedule already saving into the same folder, when there is one. */
  folderTakenBy: BackupSchedule | undefined;
  onChange: (patch: Partial<BackupSchedule>) => void;
  /** Opens the backup windows: what to save, the folder and the confirmation word. */
  onChooseWhat: () => void;
  /** Shows the destination folder in the file explorer. */
  onOpenFolder: (dir: string) => void;
}

/** A schedule's settings, like TablePlus': each change is saved at once. */
export function ScheduleForm({ schedule, connection, folderTakenBy, onChange, onChooseWhat, onOpenFolder }: Props) {
  if (!schedule) {
    return <p className="schedule-empty muted">Elige un backup de la lista o crea uno con +.</p>;
  }
  const { backup } = schedule;
  return (
    <div className="schedule-form">
      <section className="schedule-card">
        <label className="schedule-row">
          <span>Nombre</span>
          <input
            className="schedule-name-input"
            value={schedule.name}
            onChange={(e) => onChange({ name: e.target.value })}
            spellCheck={false}
            aria-invalid={!!folderTakenBy}
          />
        </label>
        {folderTakenBy && <p className="test error small">{folderTaken(folderTakenBy)}</p>}
        <div className="schedule-row">
          <span id="schedule-notify">Avisar al terminar</span>
          <label className="switch">
            <input
              type="checkbox"
              checked={schedule.notify}
              onChange={(e) => onChange({ notify: e.target.checked })}
              aria-labelledby="schedule-notify"
            />
            <span aria-hidden />
          </label>
        </div>
      </section>

      <h3 className="schedule-heading">Cuándo</h3>
      <section className="schedule-card">
        <RepeatFields schedule={schedule} onChange={onChange} />
      </section>

      <h3 className="schedule-heading">Origen</h3>
      <section className="schedule-card">
        {backup ? (
          <>
            <div className="schedule-row">
              <span>Conexión</span>
              {connection ? (
                <span className="inline">
                  {displayName(connection)} <TagBadge tag={connection.tag} />
                </span>
              ) : (
                <span className="test error small">{MISSING_CONNECTION}</span>
              )}
            </div>
            <div className="schedule-row">
              <span>Qué guarda</span>
              <span className="muted">{backupLabel(backup)}</span>
            </div>
          </>
        ) : (
          <p className="muted small">Todavía no se eligió qué guardar.</p>
        )}
      </section>

      <h3 className="schedule-heading">Destino</h3>
      <section className="schedule-card">
        {backup ? (
          <div className="schedule-row">
            <span>Carpeta</span>
            <span className="schedule-dest">
              <span className="schedule-dir" title={backup.dir}>
                {backup.dir}
              </span>
              <button
                type="button"
                className="ghost ops-folder"
                onClick={() => onOpenFolder(backup.dir)}
                aria-label="Abrir la carpeta de destino"
                title={`Abrir ${backup.dir}`}
              >
                <NodeIcon kind="collections" />
              </button>
            </span>
          </div>
        ) : (
          <p className="muted small">Todavía no se eligió la carpeta.</p>
        )}
      </section>
      <p className="muted small">
        Cada ejecución va a su propia carpeta: <code>{folderSafeName(schedule.name)}/AAAA-MM-DD_HHMM</code>, en el formato de mongodump.
      </p>
      <p className="schedule-note small" role="note">
        Si cambias el nombre o la carpeta de destino, las copias nuevas van a otra carpeta. Las anteriores se quedan donde estaban: no se
        borran ni cuentan entre las 7 que se guardan.
      </p>

      <div className="schedule-actions">
        <button className={backup ? "" : "primary"} onClick={onChooseWhat}>
          {backup ? "Cambiar qué y dónde…" : "Elegir qué y dónde…"}
        </button>
      </div>
    </div>
  );
}
