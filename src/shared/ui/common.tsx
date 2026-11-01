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
];
/** The tail fin: the first facets of the body. */
const SHARK_TAIL = 4;
/** The lower fins, drawn over the body and flapped while swimming. */
const SHARK_FINS: [string, string][] = [
  ["#15437F", "600,612 550,600 440,795"],
  ["#2468B5", "550,600 500,590 440,795"],
];
// Upper and lower teeth interlock and fill the whole mouth; the zigzag marks where they meet.
const SHARK_TEETH: [string, string][] = [
  ["#FFFFFF", "745,562 795.5,550.4 770.4,576.7"],
  ["#FFFFFF", "795.5,550.4 832.9,541.8 806.1,597.5"],
  ["#FFFFFF", "832.9,541.8 866.6,534.1 836.9,615.4"],
  ["#FFFFFF", "866.6,534.1 898.1,526.9 865.3,631.9"],
  ["#FFFFFF", "898.1,526.9 928,520 892.1,647.5"],
  ["#C9DFF1", "770.4,576.7 806.1,597.5 795.5,550.4"],
  ["#C9DFF1", "806.1,597.5 836.9,615.4 832.9,541.8"],
  ["#C9DFF1", "836.9,615.4 865.3,631.9 866.6,534.1"],
  ["#C9DFF1", "865.3,631.9 892.1,647.5 898.1,526.9"],
  ["#C9DFF1", "892.1,647.5 905,655 928,520"],
];
const SHARK_TEETH_SEAM =
  "745,562 770.4,576.7 795.5,550.4 806.1,597.5 832.9,541.8 836.9,615.4 866.6,534.1 865.3,631.9 898.1,526.9 892.1,647.5 928,520";

/** Where the tail meets the body: points left of it bend, the ones on the joint stay put so no gap opens. */
const TAIL_JOINT_X = 200;
const TAIL_PIVOT = [209, 516];
const TAIL_SWING_DEG = 11;
const TAIL_STEPS = 16;

function bendTail(points: string, deg: number) {
  const a = (deg * Math.PI) / 180;
  const [cos, sin] = [Math.cos(a), Math.sin(a)];
  const [px, py] = TAIL_PIVOT;
  return points
    .split(" ")
    .map((p) => {
      const [x, y] = p.split(",").map(Number);
      if (x >= TAIL_JOINT_X) return p;
      const [dx, dy] = [x - px, y - py];
      return `${(px + dx * cos - dy * sin).toFixed(1)},${(py + dx * sin + dy * cos).toFixed(1)}`;
    })
    .join(" ");
}

/** One full wag per tail facet, as SMIL `values`. */
const TAIL_WAG = SHARK_BODY.slice(0, SHARK_TAIL).map(([, points]) =>
  Array.from({ length: TAIL_STEPS + 1 }, (_, k) =>
    bendTail(points, TAIL_SWING_DEG * Math.sin((2 * Math.PI * k) / TAIL_STEPS)),
  ).join(";"),
);

/**
 * The shark's facets; swimming wags the tail and flaps the fins (slower when calm), staring gives it a hunter's look
 * and sad drops its fins, its brow and its gaze.
 */
function Shark({
  swimming = false,
  calm = false,
  staring = false,
  sad = false,
}: {
  swimming?: boolean;
  calm?: boolean;
  staring?: boolean;
  sad?: boolean;
}) {
  // Each facet is stroked in its own color so no seams show between them.
  const facet = ([fill, points]: [string, string], i: number) => (
    <polygon key={i} points={points} fill={fill} stroke={fill} />
  );
  const bodyFacet = ([fill, points]: [string, string], i: number) => (
    <polygon key={i} points={points} fill={fill} stroke={fill}>
      {swimming && i < SHARK_TAIL && (
        <animate attributeName="points" dur={calm ? "1.2s" : "0.5s"} repeatCount="indefinite" values={TAIL_WAG[i]} />
      )}
    </polygon>
  );
  return (
    <g className={swimming ? `shark-swim${calm ? " shark-calm" : ""}` : sad ? "shark-sad" : undefined}>
      <g strokeWidth={2} strokeLinejoin="round">
        {SHARK_BODY.map(bodyFacet)}
        <g className="shark-fins">{SHARK_FINS.map(facet)}</g>
        {SHARK_TEETH.map(facet)}
      </g>
      <polyline points={SHARK_TEETH_SEAM} fill="none" stroke="#8FB7DA" strokeWidth={3} strokeLinejoin="round" />
      <g fill="none" stroke="#15437F" strokeWidth={9} strokeLinecap="round">
        <line x1="702" y1="476" x2="690" y2="548" />
        <line x1="676" y1="482" x2="664" y2="556" />
        <line x1="650" y1="488" x2="638" y2="564" />
      </g>
      <circle cx="812" cy="480" r="22" fill="#0A1220" />
      {staring ? (
        <>
          <circle cx="820" cy="487" r="5.5" fill="#FFFFFF" />
          <polygon points="784,450 842,454 838,477 786,464" fill="#6EC1F5" stroke="#6EC1F5" strokeWidth={2} />
          <line x1="788" y1="464" x2="836" y2="477" stroke="#15437F" strokeWidth={5} strokeLinecap="round" />
        </>
      ) : sad ? (
        // The brow rises towards the snout, the opposite of the hunter's, the eye looks down and a tear falls.
        <>
          <circle cx="804" cy="490" r="7" fill="#FFFFFF" />
          <line x1="782" y1="452" x2="826" y2="418" stroke="#15437F" strokeWidth={7} strokeLinecap="round" />
          <path d="M796 512 Q 784 534 796 542 Q 808 534 796 512 Z" fill="#BFE6FF" />
        </>
      ) : (
        <circle cx="805" cy="472" r="7" fill="#FFFFFF" />
      )}
    </g>
  );
}

export function Logo({ size = 120, swimming = false }: { size?: number; swimming?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="57 42 900 900" overflow="visible" aria-hidden>
      <Shark swimming={swimming} calm />
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

/** The shark swimming in place, for a script that is still running. */
export function SwimmingShark() {
  return (
    <svg className="swimming-shark" viewBox="0 130 1000 760" role="img" aria-label="Ejecutando">
      <Shark swimming staring />
    </svg>
  );
}

/** The shark alone in an empty sea, fins down, with one bubble rising: nothing open yet. */
export function SadShark({ label }: { label: string }) {
  return (
    <svg className="sad-shark" viewBox="0 0 1060 940" role="img" aria-label={label}>
      <g className="sad-bubble">
        <circle cx="962" cy="540" r="28" fill="#8FD3FF" fillOpacity={0.25} stroke="#6EC1F5" strokeWidth={6} />
        <circle cx="952" cy="530" r="7" fill="#FFFFFF" />
      </g>
      <Shark sad />
    </svg>
  );
}
