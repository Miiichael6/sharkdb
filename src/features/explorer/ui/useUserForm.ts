import { useState } from "react";
import type { UserEntry } from "../domain/mongo";
import { newUserForm, userFormFrom, type RoleGrant, type UserForm } from "../domain/userSpec";

/** State of the user dialog's form: name, password and the editable list of roles. */
export function useUserForm(db: string, initial?: UserEntry) {
  const [form, setForm] = useState<UserForm>(() => (initial ? userFormFrom(initial) : newUserForm(db)));

  const setUser = (user: string) => setForm((f) => ({ ...f, user }));
  const setPassword = (password: string) => setForm((f) => ({ ...f, password }));
  const addRole = () => setForm((f) => ({ ...f, roles: [...f.roles, { role: "", db }] }));
  const removeRole = (i: number) => setForm((f) => ({ ...f, roles: f.roles.filter((_, j) => j !== i) }));
  const changeRole = (i: number, change: Partial<RoleGrant>) =>
    setForm((f) => ({ ...f, roles: f.roles.map((r, j) => (j === i ? { ...r, ...change } : r)) }));

  return { form, setUser, setPassword, addRole, removeRole, changeRole };
}
