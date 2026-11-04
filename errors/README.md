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
| 17 | BAJO | ✅ [Remove documents confirmacion simple](resolved/17_bajo_remove-documents-confirmacion-simple.md) |
| 18 | BAJO | ✅ [Reindex en produccion](resolved/18_bajo_reindex-en-produccion.md) |
| 19 | BAJO | ✅ [Delete statement limit sobrescribible](resolved/19_bajo_delete-statement-limit-sobrescribible.md) |
| 20 | BAJO | ✅ [Numberint desborda](resolved/20_bajo_numberint-desborda.md) |
| 21 | BAJO | [Tipos que no sobreviven edicion](21_bajo_tipos-que-no-sobreviven-edicion.md) |
| 22 | BAJO | [Sin transacciones en shell](22_bajo_sin-transacciones-en-shell.md) |
| 23 | BAJO | [Menu copiar incoherente](23_bajo_menu-copiar-incoherente.md) |
| 24 | MEDIO | [Claves numericas cambian orden](24_medio_claves-numericas-cambian-orden.md) |
| 25 | MEDIO | ✅ [Copiar coleccion pierde opciones](resolved/25_medio_copiar-coleccion-pierde-opciones.md) |
| 26 | BAJO | ✅ [Acciones destructivas en sistema](resolved/26_bajo_acciones-destructivas-en-sistema.md) |
| 27 | MEDIO | ✅ [Restore sync fallan por validador](resolved/27_medio_restore-sync-fallan-por-validador.md) |
| 28 | BAJO | ✅ [Quitar validacion sin confirmacion](resolved/28_bajo_quitar-validacion-sin-confirmacion.md) |
| 29 | BAJO | [Remove function ignora write errors](29_bajo_remove-function-ignora-write-errors.md) |
| 30 | BAJO | ✅ [Safe mode huecos](resolved/30_bajo_safe-mode-huecos.md) |
| 31 | BAJO | ✅ [Editar indice misma clave ventana](resolved/31_bajo_editar-indice-misma-clave-ventana.md) |
| 32 | BAJO | [Nombre staging largo](32_bajo_nombre-staging-largo.md) |
| 33 | BAJO | [Precision en validador y filtros](33_bajo_precision-en-validador-y-filtros.md) |
| 34 | BAJO | ✅ [Editar en vista o timeseries](resolved/34_bajo_editar-en-vista-o-timeseries.md) |
| 35 | BAJO | [Renombres finales no atomicos](35_bajo_renombres-finales-no-atomicos.md) |
| 36 | ALTO | ✅ [Backup colecciones mayusculas](resolved/36_alto_backup-colecciones-mayusculas.md) |
| 37 | MEDIO | ✅ [FindOneAnd sin filtro](resolved/37_medio_findoneand-sin-filtro.md) |
| 38 | MEDIO | ✅ [DropIndex asterisco](resolved/38_medio_dropindex-asterisco.md) |
| 39 | MEDIO | ✅ [Insert id undefined guarda null](resolved/39_medio_insert-id-undefined-guarda-null.md) |
| 40 | MEDIO | ✅ [Aggregate out merge perezoso](resolved/40_medio_aggregate-out-merge-perezoso.md) |
| 41 | MEDIO | ✅ [Safe mode comandos faltantes](resolved/41_medio_safe-mode-comandos-faltantes.md) |
| 42 | MEDIO | ✅ [Cursor leido cambia tipos al editar](resolved/42_medio_cursor-leido-cambia-tipos-al-editar.md) |
| 43 | MEDIO | ✅ [Use no persiste entre ejecuciones](resolved/43_medio_use-no-persiste-entre-ejecuciones.md) |
| 44 | MEDIO | ✅ [Resultados abiertos tras reconectar](resolved/44_medio_resultados-abiertos-tras-reconectar.md) |
| 45 | MEDIO | ✅ [Proteccion destino URI guardada](resolved/45_medio_proteccion-destino-uri-guardada.md) |
| 46 | MEDIO | ✅ [Retencion borra backups buenos](resolved/46_medio_retencion-borra-backups-buenos.md) |
| 47 | MEDIO | ✅ [Programacion BD completa lista fija](resolved/47_medio_programacion-bd-completa-lista-fija.md) |
| 48 | MEDIO | [Backup carpeta existente mezcla](48_medio_backup-carpeta-existente-mezcla.md) |
| 49 | BAJO | ✅ [Staging huerfanas tras caida](resolved/49_bajo_staging-huerfanas-tras-caida.md) |
| 50 | BAJO | ✅ [Copiar coleccion borra ajena](resolved/50_bajo_copiar-coleccion-borra-ajena.md) |
| 51 | BAJO | [Reintentar insert duplica](51_bajo_reintentar-insert-duplica.md) |
| 52 | BAJO | ✅ [Menu scripts nombre con barra](resolved/52_bajo_menu-scripts-nombre-con-barra.md) |
| 53 | BAJO | [Redeclaracion ejecuta a medias](53_bajo_redeclaracion-ejecuta-a-medias.md) |
| 54 | BAJO | ✅ [Cancelar antes de registrar job](resolved/54_bajo_cancelar-antes-de-registrar-job.md) |
| 55 | MEDIO | ✅ [Ctrl+Enter en explorador re-ejecuta script](resolved/55_medio_ctrl-enter-explorador-reejecuta-script.md) |
| 56 | MEDIO | ✅ [Doble ejecución encolada sin cancelar](resolved/56_medio_doble-ejecucion-encolada-sin-cancelar.md) |
| 57 | BAJO | [Cancelar lectura no la detiene en servidor](57_bajo_cancelar-lectura-no-la-detiene-en-servidor.md) |
| 58 | MEDIO | [BD completa omite time series y vistas](58_medio_bd-completa-omite-timeseries-y-vistas.md) |
| 59 | MEDIO | [Restore cambia destino protegido](59_medio_restore-cambia-destino-protegido.md) |
| 60 | MEDIO | ✅ [Dos instancias duplican programadas](resolved/60_medio_dos-instancias-duplican-programadas.md) |
| 61 | MEDIO | [Gemelo protegido no activa safe mode](61_medio_gemelo-protegido-no-activa-safe-mode.md) |

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
- Cancelar o agotar el tiempo de una escritura la detiene también en el servidor: con `killSessions`, o con `killOp` (buscándola en `currentOp` por su `comment`) si es un `aggregate` con `$out`/`$merge`.
- El safe mode bloquea también `explain` de escrituras y los comandos de administración del servidor, réplica y sharding; un cliente desacoplado compartido usa el modo más estricto de quienes lo piden.
- Los enteros se guardan como Int32 (como mongosh), así un validador `bsonType: 'int'` los acepta.
- Borrar BD, colección, índice o usuario, y vaciar colección, piden confirmación escribiendo «confirmo».
- Una conexión abierta no se puede editar sin desconectarla antes (avisa que se cierran sus pestañas); desconectar o eliminar una conexión con pestañas sin guardar pide confirmación.

## Al terminar de corregir un error
mandar dicho archivo.md con el error a la carpeta `errors\resolved`