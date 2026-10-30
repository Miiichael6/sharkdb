// Users of a database: the form the dialog edits and its translation to `createUser` /
// `updateUser`, like Robo 3T's "Add User" / "Edit User".
import type { Doc, UserEntry } from "./mongo";

export interface RoleGrant {
  role: string;
  db: string;
}

export interface UserForm {
  user: string;
  /** Empty when editing means "keep the current password". */
  password: string;
  roles: RoleGrant[];
}

/** Validated form, ready to turn into a command. `pwd` is absent when it must not change. */
export interface UserSpec {
  user: string;
  pwd?: string;
  roles: RoleGrant[];
}

export type UserFormMode = "create" | "edit";

/** MongoDB's built-in roles, grouped as the docs list them (database, admin, cluster, backup, all). */
export const BUILTIN_ROLES = [
  "read",
  "readWrite",
  "dbAdmin",
  "dbOwner",
  "userAdmin",
  "clusterAdmin",
  "clusterManager",
  "clusterMonitor",
  "hostManager",
  "backup",
  "restore",
  "readAnyDatabase",
  "readWriteAnyDatabase",
  "userAdminAnyDatabase",
  "dbAdminAnyDatabase",
  "root",
] as const;

export const USER_REQUIRED = "Indica el nombre del usuario";
export const PASSWORD_REQUIRED = "Indica la contraseña del nuevo usuario";
export const ROLE_INCOMPLETE = "Cada rol necesita nombre y base de datos";

/** Empty form for a new user of `db`, with `read` on that database preselected. */
export const newUserForm = (db: string): UserForm => ({ user: "", password: "", roles: [{ role: "read", db }] });

/** Form to edit an existing user: its roles as they are, the password left blank. */
export const userFormFrom = (entry: UserEntry): UserForm => ({
  user: entry.user,
  password: "",
  roles: entry.roles.map(({ role, db }) => ({ role, db })),
});

/** Checks the form and trims it; repeated `{role, db}` pairs are kept once. Throws the message to show. */
export function userSpecFromForm(form: UserForm, mode: UserFormMode): UserSpec {
  const user = form.user.trim();
  if (!user) throw USER_REQUIRED;
  if (mode === "create" && !form.password) throw PASSWORD_REQUIRED;
  const roles = uniqueRoles(form.roles.map((r) => ({ role: r.role.trim(), db: r.db.trim() })));
  if (roles.some((r) => !r.role || !r.db)) throw ROLE_INCOMPLETE;
  return form.password ? { user, pwd: form.password, roles } : { user, roles };
}

function uniqueRoles(roles: RoleGrant[]): RoleGrant[] {
  const seen = new Set<string>();
  return roles.filter((r) => {
    const key = `${r.role}\u0000${r.db}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** `createUser` command; the command name goes first, as the server requires. */
export const createUserCommand = (spec: UserSpec): Doc => ({ createUser: spec.user, pwd: spec.pwd, roles: spec.roles });

/** `updateUser` replaces the whole role list; the password only goes when it changes. */
export function updateUserCommand(spec: UserSpec): Doc {
  const command: Doc = { updateUser: spec.user, roles: spec.roles };
  if (spec.pwd) command.pwd = spec.pwd;
  return command;
}
