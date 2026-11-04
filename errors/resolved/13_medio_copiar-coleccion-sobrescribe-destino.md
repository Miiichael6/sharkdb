# 13. Copiar coleccion sobrescribe destino

- **Severidad:** MEDIO
- **Dónde:** src/features/explorer/ui/CopyCollectionDialog.tsx, src/features/explorer/domain/copySpec.ts
- **Estado:** resuelto

## Problema
La copia usa `$match {} + $out`, que sustituye el destino si ya existe; solo lo dice una nota gris y el botón es un 'Copiar' normal. Además, los índices se copian después de los datos, y si eso falla la copia queda a medias.

## Escenario de fallo
Te equivocas de nombre de destino y esa colección se pierde.

## Recomendación
Comprobar si el destino existe y, si existe, pedir confirmación roja escribiendo el nombre.
