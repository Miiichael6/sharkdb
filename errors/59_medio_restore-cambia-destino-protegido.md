# 59. Restaurar desde una conexión protegida/de producción preselecciona otra conexión como destino

- **Severidad:** MEDIO (discutible: la confirmación final nombra el destino)
- **Tipo:** explícito pero engañoso (el destino lo eligió el código, no el usuario)
- **Dónde:** src/features/backup/ui/useRestoreForm.ts (`useState(initial?.targetSid ?? origin.sid)` + `pickTarget` + `ensureConnected(targetId)`), src/features/connections/domain/endpoints.ts (`targetOptions` excluye protegidas/producción; `pickTarget` cae a la primera no bloqueada), src/features/backup/ui/RestoreWindow.tsx (solo una nota genérica), src/shared/domain/confirmation.ts (`CONFIRM_WORD = "confirmo"`)
- **Estado:** pendiente
- **Relacionado:** #15, #45 (resueltos: protección del destino)

## Problema
El destino inicial es la conexión del nodo (BD o colección, `explorerMenu.tsx`) o de la barra (`WorkspaceToolbar.tsx`) desde donde se abrió "Restaurar…". Si es protegida o de producción, no está en `targetOptions`, y `pickTarget` preselecciona la primera conexión utilizable de la lista y la conecta. No hay aviso de que el destino pedido no se puede usar: solo la nota genérica "Las conexiones protegidas… nunca aparecen como destino". La confirmación final ("Se va a MODIFICAR", `restoreConfirmation`) sí nombra el destino con su etiqueta, pero se confirma escribiendo la palabra genérica "confirmo", no el nombre. El comentario de `pickTarget` ("instead of jumping to another environment") solo se cumple cuando el destino está bloqueado por safe mode, no cuando está excluido.

## Escenario de fallo
Clic derecho en la BD `shop` de "PROD" → "Restaurar…". El formulario muestra como destino "QA" (la primera de la lista) y la conecta; el usuario, centrado en elegir la carpeta, marca `shop` y escribe "confirmo" sin fijarse en el nombre del destino. Las colecciones de `shop` en QA se reemplazan (`renameCollection` con `dropTarget`) y producción sigue sin restaurar.

## Recomendación
Si el destino pedido (`origin.sid` / `initial.targetSid`) no está en `targets`, dejar el destino vacío con un aviso explícito (conexión protegida) y obligar a elegirlo a mano. Que la confirmación pida el nombre de la conexión destino. En `useSyncForm` el destino empieza vacío a propósito; solo revisar el caso de `initial.targetSid` que deja de ofrecerse.
