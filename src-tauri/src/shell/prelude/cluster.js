// Atajos de replica set (`rs`) y sharding (`sh`) del shell clásico. Son de solo lectura:
// reconfigurar el clúster se hace con `db.adminCommand(...)` explícito.
(function (native, lib) {
  'use strict';

  const { failWith } = lib;

  // Lo que responde `isMaster` en un mongos.
  const MONGOS_MSG = 'isdbgrid';

  const admin = () => db.getSiblingDB('admin');

  const rs = {
    status() { return admin().runCommand({ replSetGetStatus: 1 }); },
    conf() { return admin().runCommand({ replSetGetConfig: 1 }).config; },
    config() { return this.conf(); },
    isMaster() { return db.isMaster(); },
    toString() { return 'rs: status(), conf(), isMaster()'; },
  };

  // Resumen de la base `config` de un mongos, como lo que imprime `sh.status()` pero como datos.
  // `getCollection` evita que `config.version` resuelva al método `db.version()`.
  function shardingStatus() {
    if (db.isMaster().msg !== MONGOS_MSG) {
      failWith('ShardingError', 'sh.status: la conexión no es un mongos (el servidor no tiene sharding)');
    }
    const config = db.getSiblingDB('config');
    const all = (name, filter = {}) => config.getCollection(name).find(filter).toArray();
    return {
      shardingVersion: config.getCollection('version').findOne(),
      shards: all('shards'),
      activeMongoses: all('mongos'),
      balancer: admin().runCommand({ balancerStatus: 1 }),
      databases: all('databases'),
      collections: all('collections', { dropped: { $ne: true } }),
    };
  }

  const sh = {
    status() { return shardingStatus(); },
    toString() { return 'sh: status()'; },
  };

  Object.assign(globalThis, { rs, sh });
});
