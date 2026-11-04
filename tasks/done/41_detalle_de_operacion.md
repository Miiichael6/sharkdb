# 41 · Detalle de una operación: origen → destino y colecciones por BD

**Estado:** ✅ Terminada
**Fase:** 25 Detalle de operaciones · **Depende de:** 40 · **Doc:** R89–R93, R96 (D23, D24)

## Objetivo
En el panel derecho de Operaciones, un clic en una operación (sync, restore o backup) muestra su detalle: de dónde a dónde va (entorno, host y puerto) y una tabla por BD, plegable, con una celda por colección: **punto de color · nombre · 0–100 %**.

```
← Operaciones                         Sync · En curso · 1 min 12 s
[PRODUCCIÓN] Prod  mongo-prod-01:27017
        ↓
[QA]         QA    10.0.4.12:27017 (vía SSH bastion:22)
▾ ventas                         12/20 · 64 %   ● en curso
   ● clientes            100 %
   ● pedidos              47 %
   ○ facturas              0 %
▸ inventario                       0/8 · 0 %    ○ pendiente
```

## Pasos

### Paso 1: Origen y destino con host y puerto
- [x] `OperationEndpoint` gana `address?: string`; `connectionEndpoint` (`connections/domain/endpoints.ts`) lo rellena con `hostLabel(conn)` y, si hay túnel, `vía SSH host:puerto`; nunca usuario ni contraseña. Test del texto: campos, URI con varios hosts, SRV y SSH (R90)
- [x] `OperationRow.tsx` (`Endpoint`): muestra la dirección en `muted` debajo del nombre; carpeta de backup/restore: la ruta completa, como ya hace el `title`

### Paso 2: Vista de detalle
- [x] `src/app/operations/OperationDetail.tsx` (nuevo): cabecera (tipo, estado, duración, Cancelar si corre), ruta origen → destino del paso 1 y una `DatabaseSection` por BD (`byDatabase` de la 40). Se abre con clic o Enter en la fila, en una **sub-ventana** (D24) (R89)
- [x] `src/app/operations/DatabaseSection.tsx` (nuevo): toggle con la BD como título + `databaseSummary` (`12/20 · 64 %` y el punto del estado que manda). Abierta por defecto la BD en curso; las terminadas, plegadas (R91)
- [x] `src/app/operations/CollectionCell.tsx` (nuevo): punto de color + nombre (con elipsis y `title`) + % alineado a la derecha; `title`/`aria-label` con el estado en texto y, si falló, el error; si tiene duplicados (restore), "⚠ N duplicados" (R92, R96)

### Paso 3: Estados y colores
- [x] `collectionStatusLabel` / `collectionDescription` en `shared/domain/collectionProgress.ts`: estado → etiqueta (la clase es el propio estado), según D23. Colores con los tokens que ya usa el panel (`--muted`, `--accent`, `--warn`, `--ok`, `--danger`), sin hex nuevos (R93)
- [x] `App.css`, junto a `.ops-status`: `.ops-dot.<estado>`; `running` reutiliza el pulso `ops-pulse` (sin animación con `prefers-reduced-motion`); `discarded` es un punto hueco y el % tachado
- [x] Sync y restore: dos contenedores, "1 · Copia provisional" y "2 · Reemplazo"; cada colección pasa al segundo al quedar copiada (pedido del usuario)

### Paso 4: Verificación
- [x] Prueba real de sync prod → QA con 2 BDs: la cabecera dice entorno, host y puerto de ambos lados; las celdas pasan gris → azul → ámbar → verde; la BD en curso se abre sola
- [x] Restore desde carpeta y backup a carpeta: se ve la ruta; el backup pasa directo a verde por colección
- [x] Cancelar a mitad y forzar un error: celdas descartadas y en rojo, con el motivo en el tooltip
- [x] Contraste de los puntos en temas claro y oscuro
- [x] Sub-ventana estrecha con 60+ colecciones: sin scroll horizontal, nombres completos (sin elipsis)
- [x] Código organizado: una responsabilidad por archivo, lógica pura separada de la integración, sin duplicación ni código muerto
- [x] `npm test`, typecheck y `vite build` pasan
- [x] Commit: `feat(operations): detalle de la operación con el avance de cada colección por BD`
- **Cierre de Fase 25**

## Criterios de aceptación
- [x] Un clic en una operación del panel muestra origen y destino con entorno, host y puerto (o carpeta)
- [x] Las colecciones salen agrupadas por BD, en secciones plegables con la BD como título y su resumen
- [x] Cada colección muestra punto de color, nombre y su % de 0 a 100, en verde al terminar
- [x] El estado se entiende sin depender del color (tooltip / texto accesible)

## Bitácora
<!-- Resumida: 1 a 3 entradas de una línea. Solo decisiones no obvias, problemas y desviaciones. -->
- 2026-11-04: Pedida por el usuario: "tabla toggle con la BD como título; punto de color, colección y %; verde al terminar; de producción a QA con host y puerto". Backup incluido aunque no lo nombró: sale gratis con la 40.
- 2026-11-04: D24 → sub-ventana. `openModalWindow` gana `updates`: la ventana principal reenvía la operación en cada cambio; Cancelar se confirma en el detalle y se pide a la principal con `askOpener` (dueña del job y de las notificaciones).
- 2026-11-04: Dirección sin credenciales: una URI que no se puede leer no se muestra (podría llevar la contraseña). Pruebas manuales hechas por el usuario (sin conexión de producción aquí): todo OK.
- 2026-11-04: Fases separadas solo en sync/restore (usan colecciones provisionales); la entrada guarda `staged` para que una copiada y luego descartada no vuelva a la fase 1.
