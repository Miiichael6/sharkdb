# 05. Numeros js siempre double

- **Severidad:** ALTO
- **Dónde:** src-tauri/src/shell/convert/to_bson.rs (`Type::Int | Type::Float => Bson::Double`)
- **Estado:** resuelto — los enteros JS que caben en 32 bits se envían como Int32 y el resto como Double, como mongosh (`-0` sigue siendo Double). Efecto: un Double entero leído y guardado de nuevo desde un script queda Int32, igual que en mongosh.

## Problema
Todo número de JS se guarda como Double, también los enteros. mongosh los envía como Int32.

## Escenario de fallo
`$set:{qty:5}` o `$inc:{n:1}` cambian el tipo del campo de Int32 a Double. Falla un validador `bsonType:'int'`, o fallan las apps con tipos fijos (Java, C#, Go).

## Recomendación
Enviar los enteros que quepan en 32 bits como Int32 y el resto como Double, igual que mongosh.
