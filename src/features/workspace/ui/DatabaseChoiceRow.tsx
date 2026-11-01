import type { MouseEvent } from "react";
import { NodeIcon } from "../../explorer/ui/NodeIcon";
import { MISSING_DATABASE } from "../../explorer/domain/pinnedDatabases";

interface Props {
  name: string;
  favorite: boolean;
  checked: boolean;
  /** The row the arrows move from (Shift extends from it). */
  anchor: boolean;
  /** A favorite the server no longer has: it can only be unmarked. */
  missing: boolean;
  onClick: (e: MouseEvent) => void;
  onToggle: () => void;
  onToggleStar: () => void;
}

const FAVORITE_STAYS = "Favorita: quita la estrella para sacarla del explorador";

/** One database of the "Bases de datos" window: checkbox, star and name. */
export function DatabaseChoiceRow({ name, favorite, checked, anchor, missing, onClick, onToggle, onToggleStar }: Props) {
  const starLabel = favorite ? `Quitar ${name} de favoritas` : `Marcar ${name} como favorita`;
  return (
    <li
      role="option"
      aria-selected={checked}
      className={`${checked ? "active" : ""} ${anchor ? "anchor" : ""} ${missing ? "missing" : ""}`}
      title={missing ? MISSING_DATABASE : undefined}
      onClick={onClick}
    >
      <input
        type="checkbox"
        aria-label={`Elegir ${name}`}
        title={favorite ? FAVORITE_STAYS : undefined}
        checked={checked}
        disabled={missing || favorite}
        onClick={(e) => e.stopPropagation()}
        onChange={onToggle}
      />
      <button
        type="button"
        className={`db-star ${favorite ? "on" : ""}`}
        title={starLabel}
        aria-label={starLabel}
        aria-pressed={favorite}
        onClick={(e) => {
          e.stopPropagation();
          onToggleStar();
        }}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
          <path
            d="M8 1.5l1.9 4.1 4.4.5-3.3 3 .9 4.4L8 11.3l-3.9 2.2.9-4.4-3.3-3 4.4-.5z"
            fill={favorite ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <NodeIcon kind="database" />
      <span className="db-name">{name}</span>
      {missing && <span className="db-missing">{MISSING_DATABASE}</span>}
    </li>
  );
}
