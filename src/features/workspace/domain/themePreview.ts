// What the "Tema" window shows to preview a theme.
import type { NodeKind } from "../../explorer/domain/tree";

/** A shell script with every kind of token the code themes color. */
export const PREVIEW_SCRIPT = `// Pedidos de la última semana
db.orders.find({
  _id: ObjectId("65f1c2a9e4b0a1d2c3f4a5b6"),
  status: "pagado",
  total: { $gte: 120.5 },
  createdAt: { $gt: ISODate("2026-10-24T00:00:00Z") },
  express: true,
}).sort({ total: -1 }).limit(20);`;

/** The rows of the interface sample: the second one is shown selected. */
export const PREVIEW_ROWS: readonly { name: string; kind: NodeKind }[] = [
  { name: "shop", kind: "database" },
  { name: "orders", kind: "collection" },
  { name: "customers", kind: "collection" },
];
export const PREVIEW_SELECTED_ROW = 1;
