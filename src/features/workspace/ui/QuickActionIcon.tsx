import type { QuickActionId } from "../domain/quickOpen";
import { ToolbarIcon } from "./ToolbarIcon";

// Same outlines and size as the toolbar, whose own icons are reused for the actions it also has.
const props = {
  width: 16,
  height: 16,
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

export function QuickActionIcon({ id }: { id: QuickActionId }) {
  switch (id) {
    case "openShell":
      return (
        <svg {...props}>
          <path d="m3 4.5 3.5 3.5L3 11.5M8 12h5" />
        </svg>
      );
    case "createCollection":
      return (
        <svg {...props}>
          <path d="M8 3v10M3 8h10" />
        </svg>
      );
    case "dbStats":
      return (
        <svg {...props}>
          <path d="M2.5 13.5h11M4.5 11V8M8 11V4M11.5 11V6.5" />
        </svg>
      );
    case "refresh":
      return <ToolbarIcon id="refresh" />;
    case "openMongosh":
      return <ToolbarIcon id="openMongosh" />;
    case "backup":
      return (
        <svg {...props}>
          <path d="M8 2v8M4.5 6.5 8 10l3.5-3.5M2.5 11v2.5h11V11" />
        </svg>
      );
    case "restore":
      return (
        <svg {...props}>
          <path d="M8 10V2M4.5 5.5 8 2l3.5 3.5M2.5 11v2.5h11V11" />
        </svg>
      );
    case "sync":
      return (
        <svg {...props}>
          <path d="M2.5 5.5h11L11 3M13.5 10.5h-11L5 13" />
        </svg>
      );
  }
}
