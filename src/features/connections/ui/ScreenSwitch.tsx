import { SegmentedControl, type Segment } from "../../../shared/ui/SegmentedControl";

export type Screen = "connections" | "backups";

const SCREENS: readonly Segment<Screen>[] = [
  { id: "connections", title: "Conexiones", label: <ConnectionsIcon /> },
  { id: "backups", title: "Backups programados", label: <BackupsIcon /> },
];

interface Props {
  screen: Screen;
  onChange: (screen: Screen) => void;
}

/** The two buttons, top left of the start window, that switch between the connections and the scheduled backups. */
export function ScreenSwitch({ screen, onChange }: Props) {
  return <SegmentedControl segments={SCREENS} value={screen} onChange={onChange} label="Pantalla" className="screen-switch" />;
}

function ConnectionsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
      <ellipse cx="8" cy="3.5" rx="5" ry="2" />
      <path d="M3 3.5v9c0 1.1 2.2 2 5 2s5-.9 5-2v-9M3 8c0 1.1 2.2 2 5 2s5-.9 5-2" />
    </svg>
  );
}

function BackupsIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M2.5 8a5.5 5.5 0 1 0 1.6-3.9M2.5 2.5v2.2h2.2M8 5v3l2 1.5" />
    </svg>
  );
}
