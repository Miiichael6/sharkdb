import { useEffect, useState } from "react";
import { useServices } from "../../../app/services";
import { formatBytes } from "../../../shared/format";
import { errorMessage } from "../../../shared/errors";
import { CodeEditor } from "../../../shared/ui/CodeEditor";
import { SadShark, Spinner } from "../../../shared/ui/common";
import { formatValue } from "../../shell/domain/bsonFormat";
import type { ExplorerService } from "../application/explorerService";
import type { Doc, IndexSpec } from "../domain/mongo";
import type { TreeNode } from "../domain/tree";

export type PanelMode = "default" | "serverStatus" | "hostInfo" | "buildInfo" | "dbStats" | "collStats";

interface Props {
  node: TreeNode;
  mode: PanelMode;
  /** Bumped by the parent after a change, to refetch. */
  version: number;
  childCount?: number;
  onAction: (mode: PanelMode) => void;
  /** Left out while the session is read-only: the index table then hides its edit buttons. */
  onEditIndex?: (ix: IndexSpec) => void;
  onDropIndex?: (ix: IndexSpec) => void;
}

type Content =
  /** `eyebrow`: where the title lives (the database of a collection), above it in small. */
  | { type: "stats"; title: string; eyebrow: string; scope: StatsScope; data: Doc; indexes?: IndexSpec[] }
  | { type: "json"; title: string; data: unknown }
  | { type: "code"; title: string; code: string }
  | { type: "indexes"; title: string; indexes: IndexSpec[] }
  | { type: "hint"; title: string; text: string }
  /** The server's hint: its count comes from the tree, which may load after the panel. */
  | { type: "serverHint"; title: string };

async function loadContent(mongo: ExplorerService, n: TreeNode, mode: PanelMode): Promise<Content> {
  switch (mode) {
    case "serverStatus":
      return { type: "json", title: "Estado del servidor", data: await mongo.serverStatus(n.sid) };
    case "hostInfo":
      return { type: "json", title: "Info del host", data: await mongo.hostInfo(n.sid) };
    case "buildInfo":
      return { type: "json", title: "Versión de MongoDB", data: await mongo.buildInfo(n.sid) };
    case "dbStats":
      return dbContent(mongo, n);
    case "collStats":
      break;
    case "default":
      switch (n.kind) {
        case "server":
          return { type: "serverHint", title: n.label };
        case "database":
          return dbContent(mongo, n);
        case "collection":
          if (n.data?.type === "view") return { type: "json", title: `Vista ${n.coll}`, data: n.data.options };
          break;
        case "indexes":
          return {
            type: "indexes",
            title: `Índices de ${n.coll}`,
            indexes: await mongo.listIndexes(n.sid, n.db!, n.coll!),
          };
        case "index":
          return { type: "json", title: `Índice ${n.label}`, data: n.data };
        case "user":
          return { type: "json", title: `Usuario ${n.label}`, data: n.data };
        case "function": {
          const v = n.data.value;
          return { type: "code", title: `Función ${n.label}`, code: typeof v === "string" ? v : (v?.$code ?? JSON.stringify(v, null, 2)) };
        }
        default:
          return { type: "hint", title: n.label, text: "Despliega la carpeta para ver su contenido." };
      }
  }
  // Collection statistics + its indexes.
  const [data, indexes] = await Promise.all([
    mongo.collStats(n.sid, n.db!, n.coll!),
    mongo.listIndexes(n.sid, n.db!, n.coll!),
  ]);
  return { type: "stats", title: n.coll!, eyebrow: `${n.db} · colección`, scope: "collection", data, indexes };
}

async function dbContent(mongo: ExplorerService, n: TreeNode): Promise<Content> {
  const data = await mongo.dbStats(n.sid, n.db!);
  return { type: "stats", title: n.db!, eyebrow: "Base de datos", scope: "database", data };
}

export function DetailPanel({ node, mode, version, childCount, onAction, onEditIndex, onDropIndex }: Props) {
  const { explorer } = useServices();
  const [content, setContent] = useState<Content | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setContent(null);
    setError("");
    loadContent(explorer, node, mode).then(
      (c) => alive && setContent(c),
      (e) => alive && setError(errorMessage(e)),
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.key, mode, version]);

  if (error) return <div className="panel"><p className="test error">{error}</p></div>;
  if (!content) return <div className="panel center"><Spinner /></div>;

  const layout =
    content.type === "serverHint" ? "panel panel-fill" : content.type === "json" || content.type === "code" ? "panel panel-code" : "panel";
  return (
    <div className={layout}>
      <div className="panel-head">
        {content.type === "stats" ? (
          <div className="panel-title">
            <span className="panel-eyebrow">{content.eyebrow}</span>
            <h2>
              {content.title}
              {content.data.capped === true && <span className="ix-prop">limitada</span>}
            </h2>
          </div>
        ) : (
          <h2>{content.title}</h2>
        )}
        {node.kind === "server" && (
          <div className="panel-actions">
            <button onClick={() => onAction("serverStatus")}>Estado del servidor</button>
            <button onClick={() => onAction("hostInfo")}>Info del host</button>
            <button onClick={() => onAction("buildInfo")}>Versión</button>
          </div>
        )}
      </div>

      {content.type === "hint" && <p className="muted">{content.text}</p>}
      {content.type === "serverHint" && (
        <>
          <p className="muted">{childCount ?? "…"} bases de datos. Clic derecho para más opciones.</p>
          {/* This panel only shows while no tab is open: the sea is empty. */}
          <div className="empty-sea">
            <SadShark label="No hiciste ninguna consulta" />
            <p className="muted">No hiciste ninguna consulta</p>
          </div>
        </>
      )}
      {content.type === "json" && <CodeView text={formatValue(content.data, "utc")} />}
      {content.type === "code" && <CodeView text={content.code} />}
      {content.type === "stats" && (
        <>
          <Metrics items={metricsOf(content.scope, content.data)} />
          {content.indexes && (
            <>
              <h3 className="panel-sub">
                Índices <span className="muted">{content.indexes.length}</span>
              </h3>
              <IndexTable
                indexes={content.indexes}
                sizes={content.data.indexSizes}
                onEdit={onEditIndex}
                onDrop={onDropIndex}
              />
            </>
          )}
          <MoreDetails data={content.data} />
        </>
      )}
      {content.type === "indexes" && <IndexTable indexes={content.indexes} onEdit={onEditIndex} onDrop={onDropIndex} />}
    </div>
  );
}

/** JSON or code as "Ver documento" shows it: the read-only dark editor, which scrolls on its own. */
function CodeView({ text, className = "detail-code" }: { text: string; className?: string }) {
  return <CodeEditor className={className} value={text} readOnly />;
}

type StatsScope = "collection" | "database";

const isBytes = (k: string) => /size$/i.test(k) && k !== "scaleFactor";

/** A stat as a number: the server may send 64-bit ones in extended JSON (`{ $numberLong: "…" }`). */
function num(v: unknown): number | undefined {
  if (typeof v === "number") return v;
  if (v && typeof v === "object") {
    const raw = Object.values(v as Doc)[0];
    const n = Number(raw);
    if (Object.keys(v as Doc).length === 1 && Object.keys(v as Doc)[0].startsWith("$number") && Number.isFinite(n)) return n;
  }
  return undefined;
}
const count = (n: number | undefined) => (n === undefined ? "—" : n.toLocaleString());
const bytes = (n: number | undefined) => (n === undefined ? "—" : formatBytes(n));

interface Metric {
  label: string;
  value: string;
  /** A line of context under the value: what it's made of, or what it compares to. */
  hint?: string;
}

/** Data over disk: WiredTiger compresses, so the disk often holds a fraction of the data. */
function compression(data: number | undefined, disk: number | undefined): string | undefined {
  if (!data || !disk) return undefined;
  const r = data / disk;
  return r >= 1.1 ? `comprimido ${r.toFixed(1)}×` : undefined;
}

/** The handful of figures worth reading at a glance; the rest go to "Más detalles". */
function metricsOf(scope: StatsScope, d: Doc): Metric[] {
  const avg = num(d.avgObjSize);
  const perDoc = avg ? `${formatBytes(avg)} por documento` : undefined;
  if (scope === "collection") {
    const nIdx = num(d.nindexes);
    return [
      { label: "Documentos", value: count(num(d.count)), hint: perDoc },
      { label: "Datos", value: bytes(num(d.size)), hint: "sin comprimir" },
      { label: "En disco", value: bytes(num(d.storageSize)), hint: compression(num(d.size), num(d.storageSize)) },
      { label: "Índices", value: bytes(num(d.totalIndexSize)), hint: nIdx === undefined ? undefined : `${nIdx} ${nIdx === 1 ? "índice" : "índices"}` },
    ];
  }
  const views = num(d.views);
  return [
    { label: "Colecciones", value: count(num(d.collections)), hint: views ? `y ${views} ${views === 1 ? "vista" : "vistas"}` : undefined },
    { label: "Documentos", value: count(num(d.objects)), hint: perDoc },
    { label: "Datos", value: bytes(num(d.dataSize)), hint: "sin comprimir" },
    { label: "En disco", value: bytes(num(d.storageSize)), hint: compression(num(d.dataSize), num(d.storageSize)) },
    { label: "Índices", value: bytes(num(d.indexSize)), hint: num(d.indexes) === undefined ? undefined : `${count(num(d.indexes))} índices` },
  ];
}

/** Fields already in the metrics or the title, or that say nothing (`ok`, `scaleFactor`). */
const SHOWN = new Set([
  "ns", "db", "ok", "scaleFactor", "capped",
  "count", "size", "storageSize", "totalIndexSize", "nindexes", "avgObjSize", "indexSizes",
  "collections", "views", "objects", "dataSize", "indexes", "indexSize",
]);

function Metrics({ items }: { items: Metric[] }) {
  return (
    <dl className="metrics">
      {items.map((m) => (
        <div key={m.label} className="metric">
          <dt>{m.label}</dt>
          <dd>
            <span className="metric-value">{m.value}</span>
            {m.hint && <span className="metric-hint">{m.hint}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Everything else the server sent: scalars as a list, nested documents in the editor. */
function MoreDetails({ data }: { data: Doc }) {
  const rest = Object.entries(data).filter(([k]) => !SHOWN.has(k));
  const scalars = rest.filter(([, v]) => v === null || typeof v !== "object" || num(v) !== undefined);
  const nested = rest.filter(([, v]) => v !== null && typeof v === "object" && num(v) === undefined);
  if (!scalars.length && !nested.length) return null;
  const show = (k: string, v: unknown) => {
    const n = num(v);
    if (n === undefined) return String(v);
    return isBytes(k) ? formatBytes(n) : n.toLocaleString();
  };
  return (
    <details className="nested">
      <summary>Más detalles</summary>
      {scalars.length > 0 && (
        <dl className="facts">
          {scalars.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{show(k, v)}</dd>
            </div>
          ))}
        </dl>
      )}
      {nested.length > 0 && <CodeView text={formatValue(Object.fromEntries(nested), "utc")} className="detail-code nested-code" />}
    </details>
  );
}

/** An index key's direction or kind, as a short mark next to the field. */
function keyKind(v: unknown): { mark: string; title: string } {
  if (v === 1) return { mark: "↑", title: "ascendente" };
  if (v === -1) return { mark: "↓", title: "descendente" };
  return { mark: String(v), title: String(v) };
}

function IndexTable({
  indexes,
  sizes,
  onEdit,
  onDrop,
}: {
  indexes: IndexSpec[];
  /** Bytes by index name (`indexSizes` of collStats), when known. */
  sizes?: Doc;
  onEdit?: (ix: IndexSpec) => void;
  onDrop?: (ix: IndexSpec) => void;
}) {
  return (
    <table className="grid index-table">
      <thead>
        <tr>
          <th>Nombre</th>
          <th>Claves</th>
          <th>Propiedades</th>
          {sizes && <th className="num">Tamaño</th>}
          <th />
        </tr>
      </thead>
      <tbody>
        {indexes.map((ix) => {
          const props = [
            ix.name === "_id_" && "automático",
            ix.unique && "único",
            ix.sparse && "disperso",
            ix.expireAfterSeconds !== undefined && `TTL ${ix.expireAfterSeconds}s`,
            ix.partialFilterExpression && "parcial",
            ix.weights && "texto",
          ].filter((p): p is string => Boolean(p));
          return (
            <tr key={ix.name}>
              <td className="ix-name">{ix.name}</td>
              <td>
                <span className="ix-keys">
                  {Object.entries(ix.key).map(([field, v]) => {
                    const k = keyKind(v);
                    return (
                      <span key={field} className="ix-key" title={`${field}: ${k.title}`}>
                        {field}
                        <span className="ix-dir">{k.mark}</span>
                      </span>
                    );
                  })}
                </span>
              </td>
              <td>
                {props.length ? (
                  <span className="ix-props">
                    {props.map((p) => (
                      <span key={p} className="ix-prop">{p}</span>
                    ))}
                  </span>
                ) : (
                  <span className="muted">—</span>
                )}
              </td>
              {sizes && <td className="num muted">{bytes(num(sizes[ix.name]))}</td>}
              <td className="row-actions">
                {ix.name !== "_id_" && (
                  <>
                    {onEdit && <button className="ghost" onClick={() => onEdit(ix)}>Editar</button>}
                    {onDrop && <button className="ghost danger-text" onClick={() => onDrop(ix)}>Eliminar</button>}
                  </>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
