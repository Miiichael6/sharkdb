# 23. Menu copiar incoherente

- **Severidad:** BAJO
- **Dónde:** src/features/shell/ui/results/useResultMenu.tsx, src/features/shell/ui/results/ValueResult.tsx
- **Estado:** pendiente

## Problema
Las opciones de copia del menú contextual dependen del tipo de resultado. Los cursores no editables (proyección, aggregate) usan la regla de Robo 3T; el resto usa el menú antiguo.

## Escenario de fallo
- `findOne`, `toArray()` y demás valores (`ValueResult`): en la raíz salen «Copiar nombre/ruta» desactivados y en campos simples sale «Copiar JSON».
- `find` sin proyección: en la raíz salen «Copiar valor» (repite «Copiar JSON») y «Copiar nombre/ruta» desactivados; en campos simples sale «Copiar JSON».

## Recomendación
Una sola regla de copia en todos los menús: «Copiar valor/nombre/ruta» en campos y «Copiar JSON» en documentos, objetos y arrays, sin entradas desactivadas que no aplican. «Editar», «Insertar» y «Eliminar» solo se añaden si el resultado es editable.
