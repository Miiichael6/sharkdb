import { useServices } from "../../../../app/services";

interface Props {
  value: string;
  onChange: (path: string) => void;
  /** Title of the file dialog. */
  dialogTitle: string;
  placeholder?: string;
}

/** A path that can be typed or chosen with the system file dialog. */
export function FilePathInput({ value, onChange, dialogTitle, placeholder }: Props) {
  const { connections } = useServices();

  const browse = async () => {
    const path = await connections.pickFile(dialogTitle);
    if (path) onChange(path);
  };

  return (
    <div className="inline">
      <input
        className="grow mono"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        spellCheck={false}
      />
      <button type="button" onClick={browse}>
        Examinar…
      </button>
    </div>
  );
}
