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
    case "openConnection":
      return (
        <svg {...props} strokeLinecap="round" strokeLinejoin="round">
          <path d="M6.5 9.5 9.5 6.5M7 4.5l1.5-1.5a2.5 2.5 0 0 1 3.5 3.5L10.5 8M9 11.5 7.5 13A2.5 2.5 0 0 1 4 9.5L5.5 8" />
        </svg>
      );
    case "openDatabase":
      return (
        <svg {...props} strokeLinecap="round">
          <circle cx="7" cy="7" r="4.5" />
          <path d="m10.5 10.5 3.5 3.5" />
        </svg>
      );
    case "quickActions":
      return (
        <svg {...props} strokeLinejoin="round">
          <path d="M9 1.5 3.5 9H8l-1 5.5L12.5 7H8z" />
        </svg>
      );
    case "refresh":
      return (
        <svg {...props} strokeLinecap="round" strokeLinejoin="round">
          <path d="M13 8a5 5 0 1 1-1.5-3.6M13 2.5v2.5h-2.5" />
        </svg>
      );
    case "safeMode":
      return (
        <svg {...props} strokeLinejoin="round">
          <rect x="3" y="7" width="10" height="7.5" rx="1.5" />
          <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
        </svg>
      );
    case "notifications":
      return (
        <svg {...props} strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 11.5V7a4 4 0 0 1 8 0v4.5l1 1H3zM6.5 14a1.5 1.5 0 0 0 3 0" />
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
