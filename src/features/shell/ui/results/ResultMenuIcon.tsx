export type ResultMenuAction =
  | "expand"
  | "collapse"
  | "view"
  | "edit"
  | "insert"
  | "copyValue"
  | "copyName"
  | "copyPath"
  | "copyJson"
  | "delete";

// Same Lucide-style outlines as the shell toolbar, drawn at 12px for menus.
const props = {
  width: 12,
  height: 12,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

export function ResultMenuIcon({ action }: { action: ResultMenuAction }) {
  switch (action) {
    case "expand":
      return (
        <svg {...props}>
          <path d="m7 15 5 5 5-5M7 9l5-5 5 5" />
        </svg>
      );
    case "collapse":
      return (
        <svg {...props}>
          <path d="m7 20 5-5 5 5M7 4l5 5 5-5" />
        </svg>
      );
    case "view":
      return (
        <svg {...props}>
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
    case "edit":
      return (
        <svg {...props}>
          <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z" />
        </svg>
      );
    case "insert":
      return (
        <svg {...props}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6M12 12v6M9 15h6" />
        </svg>
      );
    case "copyValue":
      return (
        <svg {...props}>
          <rect x="8" y="8" width="14" height="14" rx="2" />
          <path d="M4 16a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2" />
        </svg>
      );
    case "copyName":
      return (
        <svg {...props}>
          <path d="M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4z" />
          <circle cx="7.5" cy="7.5" r="1" />
        </svg>
      );
    case "copyPath":
      return (
        <svg {...props}>
          <circle cx="6" cy="19" r="3" />
          <circle cx="18" cy="5" r="3" />
          <path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" />
        </svg>
      );
    case "copyJson":
      return (
        <svg {...props}>
          <path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5a2 2 0 0 0 2 2h1M16 21h1a2 2 0 0 0 2-2v-5a2 2 0 0 1 2-2 2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1" />
        </svg>
      );
    case "delete":
      return (
        <svg {...props}>
          <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6" />
        </svg>
      );
  }
}
