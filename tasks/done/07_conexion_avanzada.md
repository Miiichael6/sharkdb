# 07 · Conexión avanzada: SSH, TLS y réplicas

**Estado:** ✅ Terminada
**Fase:** 5 Conexión · **Depende de:** 01 · **Doc:** R12

## Objetivo
El formulario de conexión cubre las pestañas avanzadas de Robo 3T: túnel SSH (si D3 lo confirma), certificados TLS, replica set / read preference y timeouts.

## Pasos

### Paso 1: Modelo
- [x] `src/features/connections/domain/connection.ts`: ampliar `MongoConnection` con `ssh`, `tlsFiles` (CA, cert cliente, permitir inválidos), `replicaSet`, `readPreference`, `connectTimeoutMs`; migración de conexiones guardadas sin estos campos en `domain/migrate.ts` + tests; `buildUri` añade los parámetros (R12)

### Paso 2: Backend
- [x] Nuevo `src-tauri/src/ssh_tunnel.rs` (crate `russh`): abrir túnel local por sesión con contraseña o clave privada, cerrarlo al desconectar; `mongo.rs::connect` lo usa si la conexión tiene `ssh` (R12)
- [x] Contraseñas y passphrases fuera del JSON plano: guardarlas con `keyring` (crate) desde `store.rs` (R12)

### Paso 3: UI
- [x] Separar `ConnectionForm.tsx` en pestañas `ConnectionTab`, `AuthTab`, `SshTab`, `TlsTab`, `AdvancedTab` (archivos propios) con selector de ficheros (`tauri-plugin-dialog`) (R12)

### Paso 4: Verificación
- [x] Prueba real: conectar a un Mongo detrás de un bastión SSH (p. ej. contenedor `linuxserver/openssh-server`) y a uno con TLS autofirmado
- [x] Código organizado: una responsabilidad por archivo, lógica pura separada de la integración, sin duplicación ni código muerto
- [x] `npm test`, `npm run build`, `cargo test` pasan
- [x] Commit: `feat(connections): túnel SSH, TLS con certificados y opciones avanzadas`
- **Cierre de Fase 5**

## Criterios de aceptación
- [x] Una conexión vía SSH funciona y el túnel se cierra al desconectar
- [x] Las conexiones guardadas antes de esta tarea siguen cargando
- [x] Ninguna contraseña queda en texto plano en el archivo de conexiones

## Bitácora
<!-- Resumida: 1 a 3 entradas de una línea. Solo decisiones no obvias, problemas y desviaciones. -->
- 2026-10-30: russh con backend `ring` (aws-lc-rs exige cmake/NASM en Windows); huellas TOFU en `known_hosts` propio de la carpeta de la app; con túnel solo un host y `directConnection=true`.
- 2026-10-30: Secretos (incluida la contraseña de la URI) en el keyring del SO como `<id>:<campo>`; `store.rs` migra solo los archivos antiguos con texto plano.
- 2026-10-30: Verificado contra bastión Docker (contraseña, clave+passphrase, credenciales erróneas, huella cambiada) y mongod TLS con CA y cert cliente; `close` ahora espera al listener abortado para liberar el puerto.
