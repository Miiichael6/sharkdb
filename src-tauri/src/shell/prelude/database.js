// Base de datos del shell (`db`) y la conexión (`db.getMongo()`): comandos de servidor, de
// usuarios y de operaciones en curso con los atajos del shell clásico.
(function (native, lib) {
  'use strict';

  const { num, withChildren, scaleOption, Collection } = lib;

  // Escala de `printCollectionStats()` cuando no se indica: bytes, como el shell clásico.
  const NO_SCALE = 1;
  const STATS_SEPARATOR = '---';

  // `currentOp(true)` lista también las operaciones inactivas y las del sistema.
  const currentOpFilter = (filter) =>
    filter === true ? { $all: true } : typeof filter === 'object' && filter !== null ? filter : {};

  const writeConcernOf = (writeConcern) => (writeConcern ? { writeConcern } : {});

  class DB {
    constructor(name) {
      this._name = name;
      return withChildren(this, (coll) => this.getCollection(coll));
    }

    getName() { return this._name; }
    getCollection(name) { return new Collection(this, name); }
    getSiblingDB(name) { return new DB(name); }
    getMongo() { return new Mongo(); }

    runCommand(command) {
      return native.runCommand(this._name, typeof command === 'string' ? { [command]: 1 } : command);
    }

    adminCommand(command) { return this.getSiblingDB('admin').runCommand(command); }

    getCollectionInfos(filter = {}) {
      return this.runCommand({ listCollections: 1, filter }).cursor.firstBatch;
    }

    getCollectionNames() { return this.getCollectionInfos().map((c) => c.name).sort(); }
    getUsers() { return this.runCommand({ usersInfo: 1 }).users; }
    stats(scale = undefined) { return this.runCommand({ dbStats: 1, ...scaleOption(scale) }); }
    version() { return this.adminCommand({ buildInfo: 1 }).version; }
    createCollection(name, options = {}) { return this.runCommand({ create: name, ...options }); }
    dropDatabase() { return this.runCommand({ dropDatabase: 1 }); }

    serverStatus(options = {}) { return this.adminCommand({ serverStatus: 1, ...options }); }
    hostInfo() { return this.adminCommand({ hostInfo: 1 }); }
    isMaster() { return this.runCommand({ isMaster: 1 }); }
    currentOp(filter = {}) { return this.adminCommand({ currentOp: 1, ...currentOpFilter(filter) }); }
    killOp(opId) { return this.adminCommand({ killOp: 1, op: opId }); }

    // Imprime los `stats()` de cada colección, separados como en el shell clásico.
    printCollectionStats(scale = NO_SCALE) {
      this.getCollectionNames().forEach((name) => {
        print(name);
        printjson(this.getCollection(name).stats(scale));
        print(STATS_SEPARATOR);
      });
    }

    createUser(user, writeConcern = undefined) {
      const { user: name, ...rest } = user;
      this.runCommand({ createUser: name, ...rest, ...writeConcernOf(writeConcern) });
      const { pwd, ...shown } = user;
      print(`Successfully added user: ${tojson(shown)}`);
    }

    updateUser(name, update, writeConcern = undefined) {
      this.runCommand({ updateUser: name, ...update, ...writeConcernOf(writeConcern) });
    }

    dropUser(name, writeConcern = undefined) {
      return Boolean(num(this.runCommand({ dropUser: name, ...writeConcernOf(writeConcern) }).ok));
    }

    grantRolesToUser(name, roles, writeConcern = undefined) {
      this.runCommand({ grantRolesToUser: name, roles, ...writeConcernOf(writeConcern) });
    }

    revokeRolesFromUser(name, roles, writeConcern = undefined) {
      this.runCommand({ revokeRolesFromUser: name, roles, ...writeConcernOf(writeConcern) });
    }

    toString() { return this._name; }
    tojson() { return this.toString(); }
  }

  // La conexión de la pestaña. Solo da acceso a sus bases de datos: no abre conexiones nuevas.
  class Mongo {
    getDB(name) { return new DB(name); }
    adminCommand(command) { return this.getDB('admin').runCommand(command); }
    getDBs() { return this.adminCommand({ listDatabases: 1, authorizedDatabases: true }); }
    getDBNames() { return this.getDBs().databases.map((d) => d.name); }

    toString() { return 'conexión de la pestaña'; }
    tojson() { return this.toString(); }
  }

  Object.assign(lib, { DB });
});
