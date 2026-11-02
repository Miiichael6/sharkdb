# Errores y riesgos en escrituras (auditoría 2026-11-02)

Revisión de deletes, updates, bulk, sync, restore y acciones destructivas del explorador.
Prioridad antes de usar en producción: 01, 02 → 03, 04 → 05, 10, 13.

| # | Severidad | Hallazgo |
|---|---|---|
| 01 | CRÍTICO | ✅ [Edicion con proyeccion](resolved/01_critico_edicion-con-proyeccion.md) |
| 02 | CRÍTICO | ✅ [Editar eliminar desde aggregate](resolved/02_critico_editar-eliminar-desde-aggregate.md) |
| 03 | ALTO | ✅ [Update sin operadores reemplaza](resolved/03_alto_update-sin-operadores-reemplaza.md) |
| 04 | ALTO | ✅ [Remove sin filtro vacia coleccion](resolved/04_alto_remove-sin-filtro-vacia-coleccion.md) |
| 05 | ALTO | ✅ [Numeros js siempre double](resolved/05_alto_numeros-js-siempre-double.md) |
| 06 | MEDIO | ✅ [Update legacy ignora upsert multi](resolved/06_medio_update-legacy-ignora-upsert-multi.md) |
| 07 | MEDIO | ✅ [Opciones ignoradas delete findandmodify](resolved/07_medio_opciones-ignoradas-delete-findandmodify.md) |
| 08 | MEDIO | ✅ [Undefined en filtro es null](resolved/08_medio_undefined-en-filtro-es-null.md) |
| 09 | MEDIO | ✅ [Cancelar no detiene escritura](resolved/09_medio_cancelar-no-detiene-escritura.md) |
| 10 | MEDIO | ✅ [Safe mode lista negra incompleta](resolved/10_medio_safe-mode-lista-negra-incompleta.md) |
| 11 | MEDIO | ✅ [Hold detached hereda safe mode](resolved/11_medio_hold-detached-hereda-safe-mode.md) |
| 12 | MEDIO | ✅ [Replace index pierde indice](resolved/12_medio_replace-index-pierde-indice.md) |
| 13 | MEDIO | ✅ [Copiar coleccion sobrescribe destino](resolved/13_medio_copiar-coleccion-sobrescribe-destino.md) |
| 14 | MEDIO | ✅ [Edicion sin control concurrencia](resolved/14_medio_edicion-sin-control-concurrencia.md) |
| 15 | MEDIO | ✅ [Proteccion por connection id](resolved/15_medio_proteccion-por-connection-id.md) |
| 16 | MEDIO | ✅ [Sync restore no atomico](resolved/16_medio_sync-restore-no-atomico.md) |
| 17 | BAJO | [Remove documents confirmacion simple](17_bajo_remove-documents-confirmacion-simple.md) |
| 18 | BAJO | [Reindex en produccion](18_bajo_reindex-en-produccion.md) |
| 19 | BAJO | [Delete statement limit sobrescribible](19_bajo_delete-statement-limit-sobrescribible.md) |
| 20 | BAJO | [Numberint desborda](20_bajo_numberint-desborda.md) |
| 21 | BAJO | [Tipos que no sobreviven edicion](21_bajo_tipos-que-no-sobreviven-edicion.md) |
| 22 | BAJO | [Sin transacciones en shell](22_bajo_sin-transacciones-en-shell.md) |
| 23 | BAJO | [Menu copiar incoherente](23_bajo_menu-copiar-incoherente.md) |
| 24 | MEDIO | [Claves numericas cambian orden](24_medio_claves-numericas-cambian-orden.md) |
| 25 | MEDIO | [Copiar coleccion pierde opciones](25_medio_copiar-coleccion-pierde-opciones.md) |
| 26 | BAJO | ✅ [Acciones destructivas en sistema](resolved/26_bajo_acciones-destructivas-en-sistema.md) |
| 27 | MEDIO | [Restore sync fallan por validador](27_medio_restore-sync-fallan-por-validador.md) |
| 28 | BAJO | [Quitar validacion sin confirmacion](28_bajo_quitar-validacion-sin-confirmacion.md) |
| 29 | BAJO | [Remove function ignora write errors](29_bajo_remove-function-ignora-write-errors.md) |
| 30 | BAJO | [Safe mode huecos](30_bajo_safe-mode-huecos.md) |
| 31 | BAJO | [Editar indice misma clave ventana](31_bajo_editar-indice-misma-clave-ventana.md) |
| 32 | BAJO | [Nombre staging largo](32_bajo_nombre-staging-largo.md) |
| 33 | BAJO | [Precision en validador y filtros](33_bajo_precision-en-validador-y-filtros.md) |
| 34 | BAJO | [Editar en vista o timeseries](34_bajo_editar-en-vista-o-timeseries.md) |
| 35 | BAJO | [Renombres finales no atomicos](35_bajo_renombres-finales-no-atomicos.md) |

## Lo que está bien protegido
- Sync y restore: llenan una colección provisional por cada colección y solo cuando están todas las ponen en lugar de las originales (`renameCollection` con `dropTarget`); si algo falla o se cancela antes, las borran y el destino queda como estaba. Los renombres finales no son atómicos entre sí: si uno falla, el error dice cuáles ya se reemplazaron. Comprueban el safe mode antes de cada lote; no se acepta como destino la misma conexión ni la misma colección física (UUID).
- Una conexión no puede ser destino de sync/restore si está protegida, es de producción o apunta al mismo servidor (host y puerto normalizados, SRV o túnel SSH) que una que lo es, aunque sea otra conexión guardada.
- Editar un índice crea el nuevo antes de borrar el viejo (con nombre provisional si se llama igual); con la misma clave, si el nuevo falla se restaura el original.
- Copiar una colección sobre otra que ya existe pide confirmación escrita. La copia se hace en una colección nueva (la del destino o, si ya existe, una provisional `sharkdb-copy-…` en su BD) con las opciones del origen y los índices antes que los documentos; si algo falla, se borra. La provisional ocupa el lugar del destino al final (`renameCollection` con `dropTarget`), así que el destino queda igual que el origen o como estaba. Una time series no se copia sobre un destino existente (MongoDB no permite renombrarla).
- Guardar una edición solo reemplaza el documento si sigue exactamente como se leyó; si otro proceso lo cambió, se avisa y se pregunta si sobrescribir.
- Editar o eliminar sin `_id` se rechaza (`NO_ID`).
- Los resultados con proyección o de `aggregate` no se pueden editar ni eliminar (marca `editable` del cursor).
- Un update sin operadores `$`, un reemplazo con `$` o un delete/remove sin filtro se rechazan antes de llegar al servidor (también en bulk y `bulkWrite`).
- Un `undefined` en el filtro de una escritura se rechaza (en MongoDB equivaldría a null y tocaría también los documentos sin ese campo); `update`/`remove` antiguos respetan `upsert`, `multi` y `justOne`, y las opciones de delete y findAndModify llegan al servidor.
- Cancelar o agotar el tiempo de una escritura la detiene también en el servidor (`killSessions`), salvo un `aggregate` con `$out`/`$merge`.
- El safe mode bloquea también `explain` de escrituras y los comandos de administración del servidor, réplica y sharding; un cliente desacoplado compartido usa el modo más estricto de quienes lo piden.
- Los enteros se guardan como Int32 (como mongosh), así un validador `bsonType: 'int'` los acepta.
- Borrar BD, colección, índice o usuario, y vaciar colección, piden confirmación escribiendo el nombre.

## Al terminar de corregir un error
mandar dicho archivo.md con el error a la carpeta `errors\resolved`