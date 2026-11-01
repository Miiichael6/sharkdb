import type { DayPeriod } from "../domain/schedule";

const TITLES: Record<DayPeriod, string> = { day: "De día", afternoon: "De tarde", night: "De noche" };

/** Sun, setting sun or moon: when in the day the chosen time falls. */
export function DayPeriodIcon({ period }: { period: DayPeriod }) {
  return (
    <svg
      className={`day-period ${period}`}
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      role="img"
      aria-label={TITLES[period]}
    >
      <title>{TITLES[period]}</title>
      {period === "day" && (
        <>
          <circle cx="9" cy="9" r="3.2" />
          <path d="M9 1.8v1.6M9 14.6v1.6M1.8 9h1.6M14.6 9h1.6M3.9 3.9l1.1 1.1M13 13l1.1 1.1M3.9 14.1 5 13M13 5l1.1-1.1" />
        </>
      )}
      {period === "afternoon" && (
        <>
          <path d="M4.5 12.5a4.5 4.5 0 0 1 9 0" />
          <path d="M1.5 12.5h15M9 3.5v2M3.3 6.3l1.2 1.2M14.7 6.3l-1.2 1.2M5.5 15.5h7" />
        </>
      )}
      {period === "night" && <path d="M14.5 11.2A6 6 0 0 1 6.8 3.5a6 6 0 1 0 7.7 7.7Z" />}
    </svg>
  );
}
