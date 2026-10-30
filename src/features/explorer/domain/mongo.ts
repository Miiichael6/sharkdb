// MongoDB entities the explorer works with, as the server returns them.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Doc = Record<string, any>;

export interface DatabaseEntry {
  name: string;
  sizeOnDisk: number;
  empty: boolean;
}

export interface CollectionEntry {
  name: string;
  type: "collection" | "view" | "timeseries";
  options: Doc;
}

export interface IndexSpec {
  name: string;
  key: Doc;
  unique?: boolean;
  sparse?: boolean;
  background?: boolean;
  expireAfterSeconds?: number;
  partialFilterExpression?: Doc;
  default_language?: string;
  language_override?: string;
  weights?: Doc;
  [k: string]: unknown;
}

export interface UserEntry {
  _id: string;
  user: string;
  db: string;
  roles: { role: string; db: string }[];
}

export interface FunctionEntry {
  _id: string;
  value: { $code?: string } | string;
}

export const SYSTEM_DATABASES = ["admin", "config", "local"];
