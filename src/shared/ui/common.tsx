import { useEffect, type CSSProperties, type ReactNode } from "react";
import { MongoLogo } from "./MongoLogo";

// The app icon (src-tauri/icons/icon.svg): a faceted shark, as [fill, points] in back-to-front order.
const SHARK_BODY: [string, string][] = [
  ["#56B0EE", "205,492 70,270 135,520"],
  ["#6EC1F5", "205,492 70,270 175,455"],
  ["#2468B5", "205,492 135,520 212,540"],
  ["#1C559E", "212,540 135,520 95,720"],
  ["#6EC1F5", "560,385 470,190 495,390"],
  ["#3A8FD6", "495,390 470,190 455,258 474,280 440,326 430,397"],
  ["#6EC1F5", "945,498 720,400 640,492"],
  ["#8FD3FF", "720,400 560,385 640,492"],
  ["#56B0EE", "560,385 640,492 420,500"],
  ["#6EC1F5", "560,385 430,397 420,500"],
  ["#4AA6E8", "430,397 320,440 420,500"],
  ["#3A92DC", "320,440 205,492 420,500"],
  ["#3A92DC", "945,498 640,492 745,562 928,520"],
  ["#2F7FCC", "640,492 745,562 620,618"],
  ["#3486D2", "640,492 620,618 420,500"],
  ["#2468B5", "420,500 620,618 330,578"],
  ["#1C559E", "420,500 330,578 212,540"],
  ["#2F7FCC", "420,500 205,492 212,540"],
  ["#2468B5", "745,562 905,655 848,684"],
  ["#1C559E", "745,562 848,684 700,640 620,618"],
  ["#15437F", "335,576 270,662 292,566"],
  ["#15437F", "600,612 550,600 440,795"],
  ["#2468B5", "550,600 500,590 440,795"],
  ["#2A0A14", "928,520 745,562 905,655"],
  ["#14040A", "745,562 836.5,541 825,608.5"],
  ["#D23A50", "928,520 745,562 761,571.3 925,537.5"],
  ["#B82E44", "905,655 745,562 763.3,557.8 907.8,638.8"],
];
const SHARK_TEETH = [
  "777,554.7 801.6,549 784.9,568.8",
  "807,547.8 831.6,542.1 812,573.4",
  "837,540.9 861.6,535.2 839.1,578.1",
  "867,534 891.6,528.3 866.1,582.7",
  "897,527.1 921.6,521.5 893.2,587.3",
  "779.3,581.9 800.3,594.1 790.7,572.9",
  "804.9,596.8 825.9,609 816.8,579.2",
  "830.5,611.7 851.5,623.9 842.9,585.4",
  "856.1,626.6 877.1,638.8 869,591.6",
  "881.7,641.5 902.7,653.7 895.1,597.9",
];
const SHARK_BROW: [string, string][] = [
  ["#15437F", "742,446 895,478 884,502 764,474"],
  ["#0F3466", "764,474 884,502 830,490"],
];

export function Logo({ size = 120 }: { size?: number }) {
  // Each facet is stroked in its own color so no seams show between them.
  const facet = ([fill, points]: [string, string], i: number) => (
    <polygon key={i} points={points} fill={fill} stroke={fill} />
  );
  return (
    <svg width={size} height={size} viewBox="57 42 900 900" aria-hidden>
      <g strokeWidth={2} strokeLinejoin="round">
        {SHARK_BODY.map(facet)}
        {SHARK_TEETH.map((points, i) => (
          <polygon key={i} points={points} fill="#FFFFFF" stroke="#FFFFFF" />
        ))}
      </g>
      <g fill="none" stroke="#15437F" strokeWidth={9} strokeLinecap="round">
        <line x1="702" y1="476" x2="690" y2="548" />
        <line x1="676" y1="482" x2="664" y2="556" />
        <line x1="650" y1="488" x2="638" y2="564" />
      </g>
      <circle cx="812" cy="482" r="20" fill="#0A1220" />
      <circle cx="804" cy="490" r="4.5" fill="#EAF6FF" />
      <g strokeWidth={2} strokeLinejoin="round">
        {SHARK_BROW.map(facet)}
      </g>
    </svg>
  );
}

/** Share of the avatar the leaf takes. */
const AVATAR_LOGO_SCALE = 0.62;

/** A MongoDB connection: the leaf on a disc tinted with the connection's colour. */
export function Avatar({ color, size = 34 }: { color: string; size?: number }) {
  return (
    <div className="avatar" style={{ "--avatar": color, width: size, height: size } as CSSProperties}>
      <MongoLogo size={Math.round(size * AVATAR_LOGO_SCALE)} />
    </div>
  );
}

export function Modal({
  children,
  onClose,
  className = "",
}: {
  children: ReactNode;
  onClose: () => void;
  className?: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${className}`}>{children}</div>
    </div>
  );
}

export function Spinner() {
  return <span className="spinner" aria-label="Cargando" />;
}
