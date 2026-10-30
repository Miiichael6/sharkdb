export const meta = {
  name: 'tareas-paralelas',
  description: 'Ejecuta varias tareas de tasks/ en paralelo, cada una en su worktree y su rama, listas para unir a main',
  whenToUse: 'Tareas independientes entre sí (sin dependencias pendientes ni archivos compartidos importantes). args: [{ num: "09", branch: "robo3b/<slug>-09", notes?: "..." }]',
  phases: [{ title: 'Ejecutar', detail: 'una tarea por agente, en worktree aislado' }],
}

const RESULT = {
  type: 'object',
  properties: {
    num: { type: 'string' },
    branch: { type: 'string', description: 'Rama con el trabajo confirmado' },
    commit: { type: 'string', description: 'Hash corto del commit final' },
    closed: { type: 'boolean', description: 'La tarea quedó en tasks/done/' },
    checks: { type: 'string', description: 'Resultado de npm test, npm run build y cargo test (si aplica)' },
    summary: { type: 'string', description: 'Qué se hizo, en 3-6 líneas' },
    pending: { type: 'array', items: { type: 'string' }, description: 'Lo que queda sin hacer o sin probar' },
    mergeNotes: { type: 'string', description: 'Lo que hay que vigilar al unir con las otras tareas en paralelo' },
  },
  required: ['num', 'branch', 'commit', 'closed', 'checks', 'summary', 'pending', 'mergeNotes'],
}

const tasks = args ?? []
const others = (num) => tasks.filter((t) => t.num !== num).map((t) => t.num).join(', ')

phase('Ejecutar')
const results = await parallel(
  tasks.map((t) => () =>
    agent(
      `Haz la tarea ${t.num} del tablero de tasks/ de principio a fin, con la skill \`tasks\` y siguiendo sus reglas y la arquitectura de tasks/00_README.md.

Trabajas en un worktree aislado: crea y usa la rama \`${t.branch}\` desde la rama actual (main).
En paralelo se están haciendo las tareas ${others(t.num) || '(ninguna)'} en otras ramas: no las toques ni toques sus archivos más allá de lo imprescindible, y anota en mergeNotes cualquier punto donde vuestro trabajo se cruce.
${t.notes ? `\nNotas: ${t.notes}\n` : ''}
- No hay MongoDB ni UI interactiva en este entorno: lo que necesite prueba manual queda sin marcar y se dice en la bitácora y en pending. Si solo falta eso, cierra la tarea como la 06 y la 12: "✅ Terminada (prueba manual pendiente en la UI)".
- Antes de cerrar: \`npm test\`, \`npm run build\` y, si tocaste src-tauri, \`cargo test\` (en src-tauri) deben pasar.
- Confirma el trabajo en la rama con el mensaje de commit que propone la tarea, terminado en la línea:
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
- No hagas merge a main ni push.`,
      { label: `tarea ${t.num}`, phase: 'Ejecutar', isolation: 'worktree', schema: RESULT },
    ),
  ),
)

return results.filter(Boolean)
