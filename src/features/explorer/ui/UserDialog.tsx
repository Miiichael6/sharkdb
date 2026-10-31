import { useId } from "react";
import { Modal, Spinner } from "../../../shared/ui/common";
import type { UserEntry } from "../domain/mongo";
import { BUILTIN_ROLES, userSpecFromForm, type UserSpec } from "../domain/userSpec";
import { Field } from "../../../shared/ui/Field";
import { useSubmit } from "./useSubmit";
import { useUserForm } from "./useUserForm";

interface Props {
  /** Database the user belongs to (its authentication database). */
  db: string;
  /** The user to edit; absent to add a new one. */
  initial?: UserEntry;
  onSubmit: (spec: UserSpec) => Promise<void>;
  onClose: () => void;
}

/** Robo 3T's "Add User" / "Edit User": name, password and roles `{role, db}`. */
export function UserDialog({ db, initial, onSubmit, onClose }: Props) {
  const { form, setUser, setPassword, addRole, removeRole, changeRole } = useUserForm(db, initial);
  const mode = initial ? "edit" : "create";
  const rolesListId = useId();
  // An invalid form throws before reaching the server; useSubmit shows it in the dialog.
  const { busy, error, submit } = useSubmit(() => onSubmit(userSpecFromForm(form, mode)));

  return (
    <Modal onClose={onClose} className="dialog user-dialog">
      <h3>
        {initial ? "Editar usuario" : "Añadir usuario"} <span className="muted">· {db}</span>
      </h3>
      <form onSubmit={submit}>
        <Field label="Usuario">
          <input
            value={form.user}
            onChange={(e) => setUser(e.target.value)}
            disabled={!!initial}
            autoFocus={!initial}
            spellCheck={false}
          />
        </Field>
        <Field label={initial ? "Nueva contraseña (vacía para no cambiarla)" : "Contraseña"}>
          <input
            type="password"
            value={form.password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus={!!initial}
            autoComplete="new-password"
          />
        </Field>

        <fieldset className="role-list">
          <legend className="muted">Roles</legend>
          {form.roles.map((r, i) => (
            <div key={i} className="role-row">
              <input
                aria-label={`Rol ${i + 1}`}
                list={rolesListId}
                placeholder="rol"
                value={r.role}
                onChange={(e) => changeRole(i, { role: e.target.value })}
                spellCheck={false}
              />
              <input
                aria-label={`Base de datos del rol ${i + 1}`}
                placeholder="base de datos"
                value={r.db}
                onChange={(e) => changeRole(i, { db: e.target.value })}
                spellCheck={false}
              />
              <button type="button" aria-label={`Quitar rol ${i + 1}`} onClick={() => removeRole(i)}>
                ×
              </button>
            </div>
          ))}
          {!form.roles.length && <p className="muted small">Sin roles: el usuario no podrá hacer nada.</p>}
          <button type="button" onClick={addRole}>
            Añadir rol
          </button>
          <datalist id={rolesListId}>
            {BUILTIN_ROLES.map((role) => (
              <option key={role} value={role} />
            ))}
          </datalist>
        </fieldset>

        {initial && <p className="muted small">Los roles se sustituyen por los de esta lista.</p>}
        {error && <p className="test error">{error}</p>}
        <div className="modal-footer">
          <span className="spacer" />
          <button type="button" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="primary" disabled={busy}>
            {busy && <Spinner />} {initial ? "Guardar" : "Crear"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
