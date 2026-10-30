import { useState } from "react";

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function PasswordInput({ value, onChange, placeholder }: Props) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="inline">
      <input
        className="grow"
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="new-password"
      />
      <button type="button" className="ghost" onClick={() => setVisible((v) => !v)}>
        {visible ? "Ocultar" : "Mostrar"}
      </button>
    </div>
  );
}
