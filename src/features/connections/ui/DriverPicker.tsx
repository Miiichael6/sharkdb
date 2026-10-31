import { useMemo, useState } from "react";
import { Avatar, Modal } from "../../../shared/ui/common";

const MONGODB = "mongodb";
/** Same size as `.driver-icon`. */
const DRIVER_ICON_SIZE = 52;

interface Driver {
  id: string;
  name: string;
  short: string;
  color: string;
  available: boolean;
}

// Only MongoDB is wired up; the rest are shown so the picker reads like the finished product.
const DRIVERS: Driver[] = [
  { id: MONGODB, name: "MongoDB", short: "Mg", color: "#0f7a3d", available: true },
  { id: "postgres", name: "PostgreSQL", short: "Pg", color: "#2563eb", available: false },
  { id: "mysql", name: "MySQL", short: "Ms", color: "#e8891c", available: false },
  { id: "mariadb", name: "MariaDB", short: "Ma", color: "#2a8a96", available: false },
  { id: "sqlite", name: "SQLite", short: "Sl", color: "#8b2bf0", available: false },
  { id: "redis", name: "Redis", short: "Re", color: "#b5241b", available: false },
  { id: "sqlserver", name: "SQL Server", short: "Ss", color: "#8a96a3", available: false },
];

export function DriverPicker({ onPick, onClose }: { onPick: (id: string) => void; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(MONGODB);

  const visible = useMemo(
    () => DRIVERS.filter((d) => d.name.toLowerCase().includes(query.toLowerCase())),
    [query],
  );
  const current = DRIVERS.find((d) => d.id === selected);

  return (
    <Modal onClose={onClose} className="picker">
      <input
        className="search"
        placeholder="Buscar..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && current?.available && onPick(current.id)}
        autoFocus
      />
      <div className="driver-grid">
        {visible.map((d) => (
          <button
            key={d.id}
            className={`driver ${d.id === selected ? "selected" : ""}`}
            disabled={!d.available}
            onClick={() => setSelected(d.id)}
            onDoubleClick={() => d.available && onPick(d.id)}
            title={d.available ? d.name : `${d.name}: próximamente`}
          >
            {d.id === MONGODB ? (
              <Avatar color={d.color} size={DRIVER_ICON_SIZE} />
            ) : (
              <span className="driver-icon" style={{ background: d.color }}>
                {d.short}
              </span>
            )}
            <span>{d.name}</span>
            {!d.available && <span className="soon">Pronto</span>}
          </button>
        ))}
      </div>
      <div className="modal-footer">
        <button onClick={onClose}>Cancelar</button>
        <span className="spacer" />
        <button className="primary" disabled={!current?.available} onClick={() => onPick(selected)}>
          Crear
        </button>
      </div>
    </Modal>
  );
}
