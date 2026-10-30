// skip/limit of the page of a cursor result on screen, like Robo 3T's ◀ skip limit ▶ bar.

/** Documents per page, Robo 3T's default. */
export const DEFAULT_PAGE_SIZE = 50;

export interface Paging {
  skip: number;
  limit: number;
}

export const firstPage = (limit = DEFAULT_PAGE_SIZE): Paging => ({ skip: 0, limit });

export const nextPage = (p: Paging): Paging => ({ ...p, skip: p.skip + p.limit });

export const previousPage = (p: Paging): Paging => ({ ...p, skip: Math.max(0, p.skip - p.limit) });

const wholeAtLeast = (n: number, min: number) => (Number.isFinite(n) ? Math.max(min, Math.trunc(n)) : min);

/** Jumps to `skip` as typed by the user: whole and not negative. */
export const withSkip = (p: Paging, skip: number): Paging => ({ ...p, skip: wholeAtLeast(skip, 0) });

/** Changes the page size as typed by the user: whole and at least 1. */
export const withLimit = (p: Paging, limit: number): Paging => ({ ...p, limit: wholeAtLeast(limit, 1) });

/** Documents on screen, numbered from 1: `51 – 100`, or `0` if the page is empty. */
export const rangeLabel = (p: Paging, shown: number) => (shown ? `${p.skip + 1} – ${p.skip + shown}` : "0");
