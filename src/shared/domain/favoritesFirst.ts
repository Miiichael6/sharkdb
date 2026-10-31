// The order of every database list with favorites: the favorites first, then the rest, each group alphabetical.

/** Compares database names putting `favorites` first, each group alphabetical. */
export function favoritesFirst(favorites: string[]): (a: string, b: string) => number {
  const favorite = new Set(favorites);
  return (a, b) => Number(favorite.has(b)) - Number(favorite.has(a)) || a.localeCompare(b);
}
