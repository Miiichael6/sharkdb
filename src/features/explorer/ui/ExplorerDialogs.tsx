import { ConfirmDialog } from "../../../shared/ui/common";
import type { IndexSpec } from "../domain/mongo";
import { IndexDialog, PromptDialog } from "./dialogs";
import type { ExplorerDialog } from "./useExplorerActions";

interface Props {
  dialog: ExplorerDialog;
  onClose: () => void;
  onSubmitIndex: (spec: IndexSpec) => Promise<void>;
  onConfirm: () => void;
}

/** Renders whichever dialog the explorer actions opened. */
export function ExplorerDialogs({ dialog, onClose, onSubmitIndex, onConfirm }: Props) {
  switch (dialog?.kind) {
    case "prompt":
      return (
        <PromptDialog
          title={dialog.title}
          fields={dialog.fields}
          note={dialog.note}
          confirmLabel={dialog.confirmLabel}
          onSubmit={dialog.submit}
          onClose={onClose}
        />
      );
    case "index":
      return (
        <IndexDialog collection={dialog.node.coll!} initial={dialog.initial} onClose={onClose} onSubmit={onSubmitIndex} />
      );
    case "confirm":
      return (
        <ConfirmDialog
          title={dialog.title}
          message={dialog.message}
          confirmLabel={dialog.label}
          onCancel={onClose}
          onConfirm={onConfirm}
        />
      );
    default:
      return null;
  }
}
