import type { TestState } from "./useConnectionForm";

interface Props {
  state: TestState;
}

export function TestResult({ state }: Props) {
  if (state.status === "ok") {
    const n = state.info.databases.length;
    return (
      <p className="test ok" role="status">
        Conexión correcta · MongoDB {state.info.version} · {n} {n === 1 ? "base de datos" : "bases de datos"}
      </p>
    );
  }
  if (state.status === "error") {
    return (
      <p className="test error" role="alert">
        {state.message}
      </p>
    );
  }
  return null;
}
