import { CONFIRM_WORD, confirmationMatches } from "../domain/confirmation";

interface Props {
  typed: string;
  onChange: (typed: string) => void;
  disabled?: boolean;
}

/** "Escribe confirmo para continuar": the field that unlocks a red button. Takes the focus when it opens. */
export function ConfirmWordField({ typed, onChange, disabled }: Props) {
  return (
    <label className="stack danger-confirm">
      <span className="muted">
        Escribe <code>{CONFIRM_WORD}</code> para continuar
      </span>
      <input
        className={confirmationMatches(typed) ? "confirmed" : ""}
        value={typed}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        spellCheck={false}
        autoComplete="off"
        autoFocus
      />
    </label>
  );
}
