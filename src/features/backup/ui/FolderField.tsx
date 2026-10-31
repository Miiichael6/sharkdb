import { Field } from "../../../shared/ui/Field";

interface Props {
  label: string;
  value: string;
  onChange: (dir: string) => void;
  onBrowse: () => void;
  /** The typed folder was left: time to read it. */
  onBlur?: () => void;
  disabled?: boolean;
}

/** A folder path, typed or picked with "Examinar…". */
export function FolderField({ label, value, onChange, onBrowse, onBlur, disabled }: Props) {
  return (
    <Field label={label}>
      <div className="inline">
        <input className="grow" value={value} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} disabled={disabled} spellCheck={false} />
        <button type="button" onClick={onBrowse} disabled={disabled}>
          Examinar…
        </button>
      </div>
    </Field>
  );
}
