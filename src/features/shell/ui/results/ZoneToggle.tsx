import type { DateZone } from "../../domain/bsonFormat";

const ZONES: { zone: DateZone; label: string; title: string }[] = [
  { zone: "utc", label: "UTC", title: "Fechas en UTC" },
  { zone: "local", label: "Local", title: "Fechas en la hora local de este equipo" },
];

/** UTC / Local switch for the dates shown. */
export function ZoneToggle({ zone, onChange }: { zone: DateZone; onChange: (zone: DateZone) => void }) {
  return (
    <div className="segmented" role="group" aria-label="Zona horaria de las fechas">
      {ZONES.map((z) => (
        <button key={z.zone} type="button" title={z.title} aria-pressed={zone === z.zone} className={zone === z.zone ? "active" : ""} onClick={() => onChange(z.zone)}>
          {z.label}
        </button>
      ))}
    </div>
  );
}
