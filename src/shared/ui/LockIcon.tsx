/** The safe-mode lock: closed, or `open` when safe mode is off. */
export function LockIcon({ open = false, size = 16 }: { open?: boolean; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="7" width="10" height="7.5" rx="1.5" />
      {open ? <path d="M5.5 7V4a2.5 2.5 0 0 1 4.9-.7" /> : <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />}
    </svg>
  );
}
