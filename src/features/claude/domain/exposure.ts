// Which open connections Claude may use: all of them except the ones the user unchecked. Pure.

/** An open connection as the Claude tab lists it. */
export interface OpenConnection {
  id: string;
  name: string;
  safeMode: boolean;
}

export interface ExposableConnection extends OpenConnection {
  exposed: boolean;
}

/** What the MCP server is told (`mcp_set_exposed`). */
export interface ExposedConnection {
  id: string;
  name: string;
}

export function exposable(open: OpenConnection[], hidden: string[]): ExposableConnection[] {
  return open.map((conn) => ({ ...conn, exposed: !hidden.includes(conn.id) }));
}

export function exposedOf(list: ExposableConnection[]): ExposedConnection[] {
  return list.filter((c) => c.exposed).map(({ id, name }) => ({ id, name }));
}

/** The unchecked ids after checking (`exposed`) or unchecking one. */
export function withExposure(hidden: string[], id: string, exposed: boolean): string[] {
  const rest = hidden.filter((h) => h !== id);
  return exposed ? rest : [...rest, id];
}

export const sameExposure = (a: ExposedConnection[], b: ExposedConnection[]) =>
  a.length === b.length && a.every((c, i) => c.id === b[i].id && c.name === b[i].name);
