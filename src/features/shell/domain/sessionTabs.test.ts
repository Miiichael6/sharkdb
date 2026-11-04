import { describe, expect, it } from "vitest";
import { editOpenConnectionRequest, unsavedSessionTabsRequest } from "./sessionTabs";
import type { ShellTab } from "./tabs";

const tab = (title: string, dirty = false): ShellTab => ({
  id: title,
  sid: "s1",
  serverLabel: "LOCAL",
  db: "test",
  title,
  code: dirty ? "cambiado" : "x",
  filePath: dirty ? `C:/${title}` : null,
  savedCode: "x",
  runOnOpen: false,
  runRequest: 0,
});

describe("editOpenConnectionRequest", () => {
  it("says the tabs close, naming the unsaved ones", () => {
    const request = editOpenConnectionRequest("LOCAL", [tab("Asistencia"), tab("a.js", true), tab("b.js", true)]);
    expect(request.title).toBe("Editar “LOCAL”");
    expect(request.message).toBe(
      "Para editar la conexión hay que desconectarla. Se cerrarán sus 3 pestañas (2 con cambios sin guardar: “a.js”, “b.js”).",
    );
    expect(request.confirmLabel).toBe("Desconectar y editar");
  });

  it("speaks of one tab in singular and leaves out the list when nothing is unsaved", () => {
    expect(editOpenConnectionRequest("LOCAL", [tab("Asistencia")]).message).toBe(
      "Para editar la conexión hay que desconectarla. Se cerrará su pestaña.",
    );
  });

  it("only asks to disconnect when the connection has no tabs", () => {
    expect(editOpenConnectionRequest("LOCAL", []).message).toBe("Para editar la conexión hay que desconectarla.");
  });
});

describe("unsavedSessionTabsRequest", () => {
  it("doesn't ask when no tab has unsaved changes", () => {
    expect(unsavedSessionTabsRequest("LOCAL", [tab("Asistencia")], "disconnect")).toBeNull();
  });

  it("names the unsaved tabs and the action", () => {
    const tabs = [tab("Asistencia"), tab("a.js", true)];
    expect(unsavedSessionTabsRequest("LOCAL", tabs, "disconnect")).toEqual({
      title: "Cambios sin guardar",
      message: "“LOCAL” tiene pestañas con cambios sin guardar: “a.js”. Se cerrarán sin guardar. ¿Desconectar igualmente?",
      confirmLabel: "Desconectar sin guardar",
    });
    expect(unsavedSessionTabsRequest("LOCAL", tabs, "delete")?.confirmLabel).toBe("Eliminar sin guardar");
  });
});
