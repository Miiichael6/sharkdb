import type { ToolbarActionId } from "../domain/toolbarActions";

const props = { width: 16, height: 16, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", "aria-hidden": true };

export function ToolbarIcon({ id }: { id: ToolbarActionId }) {
  switch (id) {
    case "toggleSidebar":
      return (
        <svg {...props}>
          <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" />
          <path d="M6 2.5v11" />
        </svg>
      );
    case "menu":
      return (
        <svg {...props} strokeLinecap="round">
          <path d="M3 4.5h10M3 8h10M3 11.5h10" />
        </svg>
      );
    case "connections":
      return (
        <svg {...props}>
          <rect x="2" y="2" width="12" height="5" rx="1" />
          <rect x="2" y="9" width="12" height="5" rx="1" />
          <path d="M4.5 4.5h.01M4.5 11.5h.01" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case "databases":
      return (
        <svg {...props}>
          <ellipse cx="8" cy="3.5" rx="5.5" ry="2" />
          <path d="M2.5 3.5v9c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2v-9M2.5 8c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2" />
        </svg>
      );
    case "openMongosh":
      return (
        <svg {...props} strokeLinecap="round" strokeLinejoin="round">
          <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" />
          <path d="m4.5 6 2 2-2 2M8.5 10.5h3" />
        </svg>
      );
    case "refresh":
      return (
        <svg {...props} strokeLinecap="round" strokeLinejoin="round">
          <path d="M13 8a5 5 0 1 1-1.5-3.6M13 2.5v2.5h-2.5" />
        </svg>
      );
    case "logs":
      return (
        <svg {...props} strokeLinecap="round">
          <rect x="2.5" y="1.5" width="11" height="13" rx="1.5" />
          <path d="M5 5h6M5 8h6M5 11h4" />
        </svg>
      );
  }
}
