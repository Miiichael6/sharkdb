interface Item {
  name: string;
  detail?: string;
}

interface Props {
  items: Item[];
  selected: string[];
  onChange: (selected: string[]) => void;
  disabled?: boolean;
}

/** The collections a backup or restore covers, with a toggle for all of them. */
export function CollectionChecklist({ items, selected, onChange, disabled }: Props) {
  const all = items.length > 0 && selected.length === items.length;
  const toggle = (name: string, checked: boolean) =>
    onChange(checked ? items.map((i) => i.name).filter((n) => n === name || selected.includes(n)) : selected.filter((n) => n !== name));

  return (
    <div className="checklist">
      <label className="check checklist-all">
        <input type="checkbox" checked={all} disabled={disabled || !items.length} onChange={(e) => onChange(e.target.checked ? items.map((i) => i.name) : [])} />
        Todas ({selected.length} de {items.length})
      </label>
      <div className="checklist-items">
        {items.map((item) => (
          <label key={item.name} className="check">
            <input type="checkbox" checked={selected.includes(item.name)} disabled={disabled} onChange={(e) => toggle(item.name, e.target.checked)} />
            <span className="grow">{item.name}</span>
            {item.detail && <span className="muted small">{item.detail}</span>}
          </label>
        ))}
      </div>
    </div>
  );
}
