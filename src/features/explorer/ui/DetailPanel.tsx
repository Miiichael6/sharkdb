import { useEffect, useState } from "react";
import { useServices } from "../../../app/services";
import { formatBytes } from "../../../shared/format";
import { errorMessage } from "../../../shared/errors";
import { Spinner } from "../../../shared/ui/common";
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
  | { type: "stats"; title: string; data: Doc; indexes?: IndexSpec[] }
  | { type: "json"; title: string; data: unknown }
  | { type: "code"; title: string; code: string }
  | { type: "indexes"; title: string; indexes: IndexSpec[] }
  | { type: "hint"; title: string; text: string };

async function loadContent(mongo: ExplorerService, n: TreeNode, mode: PanelMode, childCount?: number): Promise<Content> {
  switch (mode) {
    case "serverStatus":
      return { type: "json", title: "Estado del servidor", data: await mongo.serverStatus(n.sid) };
    case "hostInfo":
      return { type: "json", title: "Info del host", data: await mongo.hostInfo(n.sid) };
    case "buildInfo":
      return { type: "json", title: "Versión de MongoDB", data: await mongo.buildInfo(n.sid) };
    case "dbStats":
      return { type: "stats", title: `Estadísticas de ${n.db}`, data: await mongo.dbStats(n.sid, n.db!) };
    case "collStats":
      break;
    case "default":
      switch (n.kind) {
        case "server":
          return {
            type: "hint",
            title: n.label,
            text: `${childCount ?? "…"} bases de datos. Clic derecho para más opciones.`,
          };
        case "database":
          return { type: "stats", title: `Estadísticas de ${n.db}`, data: await mongo.dbStats(n.sid, n.db!) };
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
  return { type: "stats", title: `${n.db}.${n.coll}`, data, indexes };
}

export function DetailPanel({ node, mode, version, childCount, onAction, onEditIndex, onDropIndex }: Props) {
  const { explorer } = useServices();
  const [content, setContent] = useState<Content | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setContent(null);
    setError("");
    loadContent(explorer, node, mode, childCount).then(
      (c) => alive && setContent(c),
      (e) => alive && setError(errorMessage(e)),
    );
    return () => {
      alive = false;
    };
    // childCount only feeds the server hint; don't refetch for it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.key, mode, version]);

  if (error) return <div className="panel"><p className="test error">{error}</p></div>;
  if (!content) return <div className="panel center"><Spinner /></div>;

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>{content.title}</h2>
        {node.kind === "server" && (
          <div className="panel-actions">
            <button onClick={() => onAction("serverStatus")}>Estado del servidor</button>
            <button onClick={() => onAction("hostInfo")}>Info del host</button>
            <button onClick={() => onAction("buildInfo")}>Versión</button>
          </div>
        )}
      </div>

      {content.type === "hint" && <p className="muted">{content.text}</p>}
      {content.type === "json" && <pre className="json">{JSON.stringify(content.data, null, 2)}</pre>}
      {content.type === "code" && <pre className="json">{content.code}</pre>}
      {content.type === "stats" && (
        <>
          <StatsGrid data={content.data} />
          {content.indexes && (
            <>
              <h3 className="panel-sub">Índices · {content.indexes.length}</h3>
              <IndexTable indexes={content.indexes} onEdit={onEditIndex} onDrop={onDropIndex} />
            </>
          )}
        </>
      )}
      {content.type === "indexes" && <IndexTable indexes={content.indexes} onEdit={onEditIndex} onDrop={onDropIndex} />}
    </div>
  );
}

const isBytes = (k: string) => /size$/i.test(k) && k !== "scaleFactor";

function StatsGrid({ data }: { data: Doc }) {
  const scalars = Object.entries(data).filter(([, v]) => v === null || typeof v !== "object");
  const nested = Object.entries(data).filter(([, v]) => v !== null && typeof v === "object");
  return (
    <>
      <dl className="stats">
        {scalars.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{typeof v === "number" && isBytes(k) ? `${formatBytes(v)}` : typeof v === "number" ? v.toLocaleString() : String(v)}</dd>
          </div>
        ))}
      </dl>
      {nested.length > 0 && (
        <details className="nested">
          <summary>Más detalles</summary>
          <pre className="json">{JSON.stringify(Object.fromEntries(nested), null, 2)}</pre>
        </details>
      )}
    </>
  );
}

function IndexTable({
  indexes,
  onEdit,
  onDrop,
}: {
  indexes: IndexSpec[];
  onEdit?: (ix: IndexSpec) => void;
  onDrop?: (ix: IndexSpec) => void;
}) {
  return (
    <table className="grid">
      <thead>
        <tr>
          <th>Nombre</th>
          <th>Claves</th>
          <th>Propiedades</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {indexes.map((ix) => (
          <tr key={ix.name}>
            <td>{ix.name}</td>
            <td className="mono">{JSON.stringify(ix.key)}</td>
            <td>
              {[
                ix.unique && "único",
                ix.sparse && "disperso",
                ix.expireAfterSeconds !== undefined && `TTL ${ix.expireAfterSeconds}s`,
                ix.partialFilterExpression && "parcial",
                ix.weights && "texto",
              ]
                .filter(Boolean)
                .join(" · ") || <span className="muted">—</span>}
            </td>
            <td className="row-actions">
              {ix.name !== "_id_" && (
                <>
                  {onEdit && <button className="ghost" onClick={() => onEdit(ix)}>Editar</button>}
                  {onDrop && <button className="ghost danger-text" onClick={() => onDrop(ix)}>Eliminar</button>}
                </>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
