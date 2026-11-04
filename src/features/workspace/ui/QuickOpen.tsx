import { useMemo, useState, type ReactNode } from "react";
import { CommandPalette } from "../../../shared/ui/CommandPalette";
import { NodeIcon } from "../../explorer/ui/NodeIcon";
import {
  fuzzyRank,
  QUICK_OPEN_PLACEHOLDERS,
  type QuickActionId,
  type QuickItem,
  type QuickOpenMode,
} from "../domain/quickOpen";
import { QuickActionIcon } from "./QuickActionIcon";

const EMPTY_TEXT: Record<QuickOpenMode, string> = {
  connection: "No hay conexiones que coincidan",
  action: "No hay acciones que coincidan",
};

const ICONS: Record<QuickOpenMode, (item: QuickItem) => ReactNode> = {
  connection: () => <NodeIcon kind="server" />,
  action: (item) => <QuickActionIcon id={item.id as QuickActionId} />,
};

interface Props {
  mode: QuickOpenMode;
  /** Where the palette acts, e.g. the database of the quick actions. */
  context?: string;
  items: QuickItem[];
  onPick: (id: string) => void;
  onClose: () => void;
}

/** The quick open palette in one of its modes: open connection or database actions. */
export function QuickOpen({ mode, context, items, onPick, onClose }: Props) {
  const [query, setQuery] = useState("");
  const ranked = useMemo(
    () => fuzzyRank(query, items).map((item) => ({ ...item, icon: ICONS[mode](item) })),
    [query, items, mode],
  );
  const placeholder = context ? `${QUICK_OPEN_PLACEHOLDERS[mode]} (${context})` : QUICK_OPEN_PLACEHOLDERS[mode];
  return (
    <CommandPalette
      label={QUICK_OPEN_PLACEHOLDERS[mode]}
      placeholder={placeholder}
      query={query}
      onQueryChange={setQuery}
      items={ranked}
      emptyText={EMPTY_TEXT[mode]}
      onPick={(item) => {
        onClose();
        onPick(item.id);
      }}
      onClose={onClose}
    />
  );
}
