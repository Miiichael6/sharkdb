import { MongoLogo } from "../../../shared/ui/MongoLogo";
import type { NodeKind } from "../domain/tree";

interface Props {
  kind: NodeKind;
  /** A collection that is a view (drawn as an eye). */
  view?: boolean;
  /** An expanded folder (drawn open). */
  open?: boolean;
  size?: number;
}

/**
 * Solid icon of a tree node: server (MongoDB's leaf), database, collection, index… The same set labels
 * them elsewhere.
 * Holes are cut with even-odd fills, so they show whatever is behind (row hover, selection).
 */
export function NodeIcon({ kind, view = false, open = false, size = 15 }: Props) {
  const p = { width: size, height: size, viewBox: "0 0 16 16", fill: "currentColor", "aria-hidden": true, className: `icon icon-${kind}` };
  switch (kind) {
    case "server":
      return <MongoLogo size={size} className="icon icon-server" />;
    case "database":
      return (
        <svg {...p}>
          <ellipse cx="8" cy="3.4" rx="5.5" ry="2" />
          <path d="M2.5 5.4v2.4c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2V5.4c-1.2.8-3.2 1.3-5.5 1.3S3.7 6.2 2.5 5.4Z" />
          <path d="M2.5 9.9v2.6c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2V9.9c-1.2.8-3.2 1.3-5.5 1.3s-4.3-.5-5.5-1.3Z" />
        </svg>
      );
    case "collection":
      return view ? (
        <svg {...p}>
          <path
            fillRule="evenodd"
            d="M8 3c4 0 6.7 3.3 7.2 5-.5 1.7-3.2 5-7.2 5S1.3 9.7.8 8C1.3 6.3 4 3 8 3Zm0 2.6a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8Zm0 1.1a1.3 1.3 0 1 1 0 2.6 1.3 1.3 0 0 1 0-2.6Z"
          />
        </svg>
      ) : (
        <svg {...p}>
          <rect x="1.5" y="2" width="13" height="3.5" rx="1" />
          <rect x="1.5" y="6.5" width="4" height="3" rx="0.6" />
          <rect x="6.5" y="6.5" width="8" height="3" rx="0.6" />
          <rect x="1.5" y="10.5" width="4" height="3.5" rx="0.6" />
          <rect x="6.5" y="10.5" width="8" height="3.5" rx="0.6" />
        </svg>
      );
    case "index":
      return (
        <svg {...p}>
          <path fillRule="evenodd" d="M5 4.3a3.7 3.7 0 1 1 0 7.4 3.7 3.7 0 0 1 0-7.4Zm0 2.4a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6Z" />
          <rect x="8.4" y="7" width="6.6" height="2" rx="0.5" />
          <rect x="11" y="8.5" width="1.7" height="3" rx="0.4" />
          <rect x="13.3" y="8.5" width="1.7" height="2.2" rx="0.4" />
        </svg>
      );
    case "user":
      return (
        <svg {...p}>
          <circle cx="8" cy="4.8" r="3.1" />
          <path d="M1.8 14.5c0-3.3 2.8-5.6 6.2-5.6s6.2 2.3 6.2 5.6c0 .3-.2.5-.5.5H2.3a.5.5 0 0 1-.5-.5Z" />
        </svg>
      );
    case "function":
      return (
        <svg {...p}>
          <path
            fillRule="evenodd"
            d="M4 1.5h8A2.5 2.5 0 0 1 14.5 4v8a2.5 2.5 0 0 1-2.5 2.5H4A2.5 2.5 0 0 1 1.5 12V4A2.5 2.5 0 0 1 4 1.5Zm6.6 2.6c-1.5-.3-2.6.4-2.9 1.9l-.2.9H6.3v1.3h.9l-.6 3c-.1.6-.4.8-1 .7l-.2 1.2c1.5.3 2.4-.4 2.7-1.8l.6-3.1h1.3V6.9H8.7l.2-.7c.1-.6.5-.9 1.5-.8Z"
          />
        </svg>
      );
    default:
      return open ? (
        <svg {...p}>
          <path d="M1.5 4A1.5 1.5 0 0 1 3 2.5h3L7.5 4H12a1.5 1.5 0 0 1 1.5 1.5v1H4.6a1.5 1.5 0 0 0-1.4 1L1.5 12Z" />
          <path d="M4.8 7.5h10.1l-2 5.2a1.3 1.3 0 0 1-1.2.8H2.3Z" />
        </svg>
      ) : (
        <svg {...p}>
          <path d="M1.5 4A1.5 1.5 0 0 1 3 2.5h3L7.5 4H13a1.5 1.5 0 0 1 1.5 1.5V12a1.5 1.5 0 0 1-1.5 1.5H3A1.5 1.5 0 0 1 1.5 12Z" />
        </svg>
      );
  }
}
