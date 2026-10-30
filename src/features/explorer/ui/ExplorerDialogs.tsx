import { ConfirmDialog } from "../../../shared/ui/common";
import type { CopyProgress, CopyRequest } from "../domain/copySpec";
import type { IndexSpec } from "../domain/mongo";
import type { UserSpec } from "../domain/userSpec";
import { CopyCollectionDialog, type CopyDestination } from "./CopyCollectionDialog";
import { IndexDialog, PromptDialog } from "./dialogs";
import { UserDialog } from "./UserDialog";
import type { ExplorerDialog } from "./useExplorerActions";

interface Props {
  dialog: ExplorerDialog;
  onClose: () => void;
  /** Open connections a collection can be copied to. */
  destinations: CopyDestination[];
  onSubmitIndex: (spec: IndexSpec) => Promise<void>;
  onSubmitUser: (spec: UserSpec) => Promise<void>;
  onCopy: (request: CopyRequest, onProgress: (p: CopyProgress) => void) => Promise<void>;
  onConfirm: () => void;
}

/** Renders whichever dialog the explorer actions opened. */
export function ExplorerDialogs(props: Props) {
  const { dialog, destinations, onClose, onSubmitIndex, onSubmitUser, onCopy, onConfirm } = props;
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
    case "user":
      return <UserDialog db={dialog.node.db!} initial={dialog.initial} onClose={onClose} onSubmit={onSubmitUser} />;
    case "copy": {
      const { sid, db, coll } = dialog.node;
      return (
        <CopyCollectionDialog
          source={{ sid, db: db!, coll: coll! }}
          destinations={destinations}
          onClose={onClose}
          onCopy={onCopy}
        />
      );
    }
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
