import { describe, expect, it } from "vitest";
import {
  BUILTIN_ROLES,
  PASSWORD_REQUIRED,
  ROLE_INCOMPLETE,
  USER_REQUIRED,
  createUserCommand,
  newUserForm,
  updateUserCommand,
  userFormFrom,
  userSpecFromForm,
} from "./userSpec";

describe("userSpec", () => {
  it("starts a new user with read on its database", () => {
    expect(newUserForm("shop")).toEqual({ user: "", password: "", roles: [{ role: "read", db: "shop" }] });
    expect(BUILTIN_ROLES).toContain("readWrite");
    expect(BUILTIN_ROLES).toContain("root");
  });

  it("edits an existing user with a blank password and its roles", () => {
    const entry = { _id: "shop.ana", user: "ana", db: "shop", roles: [{ role: "readWrite", db: "shop" }] };
    expect(userFormFrom(entry)).toEqual({ user: "ana", password: "", roles: [{ role: "readWrite", db: "shop" }] });
  });

  it("trims the form and drops repeated roles", () => {
    const spec = userSpecFromForm(
      {
        user: " ana ",
        password: "s3cret",
        roles: [
          { role: " readWrite", db: "shop " },
          { role: "readWrite", db: "shop" },
          { role: "read", db: "admin" },
        ],
      },
      "create",
    );
    expect(spec).toEqual({
      user: "ana",
      pwd: "s3cret",
      roles: [
        { role: "readWrite", db: "shop" },
        { role: "read", db: "admin" },
      ],
    });
  });

  it("requires a name, a password when creating, and complete roles", () => {
    const ok = { user: "ana", password: "x", roles: [] };
    expect(() => userSpecFromForm({ ...ok, user: "  " }, "create")).toThrow(USER_REQUIRED);
    expect(() => userSpecFromForm({ ...ok, password: "" }, "create")).toThrow(PASSWORD_REQUIRED);
    expect(() => userSpecFromForm({ ...ok, roles: [{ role: "read", db: " " }] }, "create")).toThrow(ROLE_INCOMPLETE);
    expect(userSpecFromForm({ ...ok, password: "" }, "edit")).toEqual({ user: "ana", roles: [] });
  });

  it("builds createUser and updateUser with the command name first", () => {
    const roles = [{ role: "readWrite", db: "shop" }];
    const create = createUserCommand({ user: "ana", pwd: "x", roles });
    expect(Object.keys(create)[0]).toBe("createUser");
    expect(create).toEqual({ createUser: "ana", pwd: "x", roles });

    expect(updateUserCommand({ user: "ana", roles })).toEqual({ updateUser: "ana", roles });
    const withPassword = updateUserCommand({ user: "ana", pwd: "y", roles });
    expect(Object.keys(withPassword)[0]).toBe("updateUser");
    expect(withPassword.pwd).toBe("y");
  });
});
