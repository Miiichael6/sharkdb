# 56. Ctrl+Enter / F5 durante una ejecución encola otra ejecución completa, invisible y que Detener no frena

- **Severidad:** MEDIO
- **Tipo:** implícito (la segunda ejecución no se ve en la UI ni se puede cancelar)
- **Dónde:** src/features/shell/ui/QueryEditor.tsx (keymap `Mod-Enter`/`F5` con `Prec.highest` llama a `onRun` sin mirar `running`), src/features/shell/ui/ShellTab.tsx (`execute` no comprueba `run.running`; solo lo hace el `onKeyDown` de la sección, que el editor nunca alcanza), src/features/shell/ui/useShellRun.ts (`run` sin guarda de concurrencia), src-tauri/src/shell/runtime.rs (`Job::Run` encolados en un mpsc; `cancel()` solo pone el `AtomicBool`), src-tauri/src/shell/watchdog.rs (`arm()` hace `cancel.store(false)` al empezar cada job)
- **Estado:** resuelto — frontend: `shellService` sabe qué pestañas tienen un script en curso (`isRunning`, desde que se envía hasta que acaba o falla) y `useShellRun.run` ignora la llamada mientras tanto, así cubre el keymap del editor, el botón y `runRequest`. Backend: `ShellRuntime::run` rechaza con `BUSY` un script si ya hay otro en curso o en cola en la pestaña (no se encola), así ningún job hereda el flag de cancelación limpiado por `arm()`. Tests: `shellService.test.ts` (`knows a tab is running from the moment the script is sent until it ends, even if it fails`) y `shell/tests/runtime.rs` (`a_second_run_while_one_is_running_is_rejected_not_queued`).
- **Relacionado:** #09 (resuelto: `killSessions` solo actúa sobre el job en curso), #54, #55 (el efecto de `runRequest` tampoco mira `running`)

## Problema
- Pulsar Ctrl+Enter o F5 dentro del editor mientras corre un script envía otro `execute_script`; el backend lo encola y lo ejecuta en cuanto termina el primero.
- La UI pone `running: false` al recibir el resultado del primero, así que el botón Detener desaparece mientras el segundo se ejecuta.
- Si se pulsa Detener, el flag de cancelación se consume en el primer job; al empezar el segundo, `watchdog.arm()` lo resetea y el segundo corre entero.

## Escenario de fallo
Un script lento con `db.ventas.insertMany([...])` o `updateMany({}, {$inc: {stock: -1}})`; el usuario, impaciente, pulsa Ctrl+Enter otra vez (y quizá Detener). Resultado: inserciones duplicadas o doble decremento, sin que la UI muestre la segunda ejecución.

## Recomendación
- Frontend: ignorar `run` mientras `running` (en `useShellRun.run`, así cubre el keymap, el botón y `runRequest`).
- Backend: rechazar `execute_script` si la pestaña ya tiene un job en curso, o que `cancel` invalide también los jobs encolados (contador de generación en vez de que `arm()` limpie el flag).
