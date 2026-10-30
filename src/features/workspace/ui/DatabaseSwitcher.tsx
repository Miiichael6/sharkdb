import { ContextMenu } from "../../../shared/ui/ContextMenu";

export interface DatabaseChoice {
  key: string;
  name: string;
  current: boolean;
}

interface Props {
  x: number;
  y: number;
  databases: DatabaseChoice[];
  onPick: (key: string) => void;
  onClose: () => void;
}

/** "Show databases": the active session's databases, the current one checked. */
export function DatabaseSwitcher({ x, y, databases, onPick, onClose }: Props) {
  const items = databases.length
    ? databases.map((d) => ({ label: d.name, checked: d.current, onSelect: () => onPick(d.key) }))
    : [{ label: "No hay bases de datos cargadas", disabled: true, onSelect: () => {} }];
  return <ContextMenu x={x} y={y} items={items} onClose={onClose} label="Bases de datos" />;
}
