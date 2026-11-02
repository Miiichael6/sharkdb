# 12. Replace index pierde indice

- **Severidad:** MEDIO
- **Dónde:** src/features/explorer/infrastructure/commandMongoAdmin.ts (`replaceIndex`)
- **Estado:** pendiente

## Problema
Reemplazar un índice primero lo borra y luego crea el nuevo; si la creación falla, el error se ignora (`.catch(() => {})`).

## Escenario de fallo
Si se pierde un índice `unique` en producción, empiezan a entrar duplicados; si es uno de rendimiento, hay colscans.

## Recomendación
Crear primero el nuevo con otro nombre y luego borrar el viejo, y mostrar siempre el error.
