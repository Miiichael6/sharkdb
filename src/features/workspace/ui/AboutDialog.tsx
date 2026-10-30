import { Logo, Modal } from "../../../shared/ui/common";

/** "Acerca de" from the app menu. */
export function AboutDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal onClose={onClose} className="about">
      <Logo size={72} />
      <h3>Robo3B</h3>
      <p className="muted">Versión {__APP_VERSION__}</p>
      <p>Cliente de escritorio para MongoDB, inspirado en Robo 3T.</p>
      <div className="modal-footer">
        <span className="spacer" />
        <button onClick={onClose} autoFocus>
          Cerrar
        </button>
      </div>
    </Modal>
  );
}
