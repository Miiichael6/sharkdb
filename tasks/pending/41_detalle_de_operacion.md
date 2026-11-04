# 41 · Detalle de una operación: origen → destino y colecciones por BD

**Estado:** ⛔ Bloqueada (D24)
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
- [ ] `OperationEndpoint` gana `address?: string`; `connectionEndpoint` (`connections/domain/endpoints.ts`) lo rellena con `hostLabel(conn)` y, si hay túnel, `vía SSH host:puerto`; nunca usuario ni contraseña. Test del texto: campos, URI con varios hosts, SRV y SSH (R90)
- [ ] `OperationRow.tsx` (`Endpoint`): muestra la dirección en `muted` debajo del nombre; carpeta de backup/restore: la ruta completa, como ya hace el `title`

### Paso 2: Vista de detalle
- [ ] `src/app/operations/OperationDetail.tsx` (nuevo): cabecera (tipo, estado, duración, Cancelar si corre), ruta origen → destino del paso 1 y una `DatabaseSection` por BD (`byDatabase` de la 40). Se abre con clic o Enter en la fila según D24 (R89)
- [ ] `src/app/operations/DatabaseSection.tsx` (nuevo): toggle con la BD como título + `databaseSummary` (`12/20 · 64 %` y el punto del estado que manda). Abierta por defecto la BD en curso; las terminadas, plegadas (R91)
- [ ] `src/app/operations/CollectionCell.tsx` (nuevo): punto de color + nombre (con elipsis y `title`) + % alineado a la derecha; `title`/`aria-label` con el estado en texto y, si falló, el error; si tiene duplicados (restore), "⚠ N duplicados" (R92, R96)

### Paso 3: Estados y colores
- [ ] `collectionStatusStyle` en `shared/domain/collectionProgress.ts`: estado → etiqueta y clase, según D23. Colores con los tokens que ya usa el panel (`--muted`, `--accent`, `--warn`, `--ok`, `--danger`), sin hex nuevos (R93)
- [ ] `App.css`, junto a `.ops-status`: `.ops-dot.<estado>`; `running` reutiliza el pulso `ops-pulse` (sin animación con `prefers-reduced-motion`); `discarded` es un punto hueco y el % tachado. Comprobar contraste en temas claro y oscuro

### Paso 4: Verificación
- [ ] Prueba real de sync prod → QA con 2 BDs: la cabecera dice entorno, host y puerto de ambos lados; las celdas pasan gris → azul → ámbar → verde; la BD en curso se abre sola
- [ ] Restore desde carpeta y backup a carpeta: se ve la ruta; el backup pasa directo a verde por colección
- [ ] Cancelar a mitad y forzar un error: celdas descartadas y en rojo, con el motivo en el tooltip
- [ ] Panel estrecho (mínimo de ancho del panel) con 60+ colecciones: sin scroll horizontal, nombres largos con elipsis
- [ ] Código organizado: una responsabilidad por archivo, lógica pura separada de la integración, sin duplicación ni código muerto
- [ ] `npm test`, typecheck y `vite build` pasan
- [ ] Commit: `feat(operations): detalle de la operación con el avance de cada colección por BD`
- **Cierre de Fase 25**

## Criterios de aceptación
- [ ] Un clic en una operación del panel muestra origen y destino con entorno, host y puerto (o carpeta)
- [ ] Las colecciones salen agrupadas por BD, en secciones plegables con la BD como título y su resumen
- [ ] Cada colección muestra punto de color, nombre y su % de 0 a 100, en verde al terminar
- [ ] El estado se entiende sin depender del color (tooltip / texto accesible)

## Bitácora
<!-- Resumida: 1 a 3 entradas de una línea. Solo decisiones no obvias, problemas y desviaciones. -->
- 2026-11-04: Pedida por el usuario: "tabla toggle con la BD como título; punto de color, colección y %; verde al terminar; de producción a QA con host y puerto". Backup incluido aunque no lo nombró: sale gratis con la 40.
