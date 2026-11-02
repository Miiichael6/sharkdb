# 26. Acciones destructivas en sistema

- **Severidad:** BAJO (antes MEDIO)
- **Dónde:** src/shared/domain/destructiveActions.ts, src/shared/domain/systemNamespaces.ts, src/shared/ui/DeleteConfirmWindow.tsx
- **Estado:** resuelto

## Problema
«Eliminar base de datos» en `admin`/`local`/`config` y vaciar o eliminar colecciones `system.*` mostraban la misma ventana que cualquier otra base o colección, sin decir que MongoDB depende de ellas.

## Por qué no se ocultan
Robo 3T y mongosh también lo permiten, y a veces hace falta (p. ej. borrar `config` en un standalone que estuvo en sharding). El servidor ya rechaza los casos peligrosos: `local` en un replica set, `config` vía mongos y, en versiones modernas, `admin`. Lo arriesgado es vaciar `admin.system.users`/`system.roles`, que el servidor sí ejecuta.

## Solución
La ventana roja añade un aviso cuando el destino es una base del sistema (diciendo qué guarda) o una colección `system.*`, en eliminar BD, eliminar/vaciar colección, eliminar documentos, sustituir colección e índices. No se avisa al eliminar usuarios (viven en `admin`) ni funciones (viven en `system.js`). Se sigue pidiendo la palabra de confirmación.
