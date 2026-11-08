import { CONFIRM_WORD, confirmationMatches } from "../domain/confirmation";

interface Props {
  typed: string;
  onChange: (typed: string) => void;
  disabled?: boolean;
  /** What has to be typed (`CONFIRM_WORD` by default). */
  word?: string;
}

/** "Escribe confirmo para continuar": the field that unlocks a red button. Takes the focus when it opens. */
export function ConfirmWordField({ typed, onChange, disabled, word = CONFIRM_WORD }: Props) {
  return (
    <label className="stack danger-confirm">
      <span className="muted">
        Escribe <code>{word}</code> para continuar
      </span>
      <input
        className={confirmationMatches(typed, word) ? "confirmed" : ""}
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
