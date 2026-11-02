// Vocabulary of the embedded shell (prelude.js, output.js, bson_types.js), for autocompletion.

export const GLOBALS = [
  "db",
  "use",
  "show",
  "print",
  "printjson",
  "tojson",
  "ObjectId",
  "ISODate",
  "Date",
  "NumberLong",
  "NumberInt",
  "Double",
  "NumberDecimal",
  "UUID",
  "BinData",
  "Timestamp",
  "Code",
  "MinKey",
  "MaxKey",
];

export const DB_METHODS = [
  "getName",
  "getCollection",
  "getSiblingDB",
  "runCommand",
  "adminCommand",
  "getCollectionInfos",
  "getCollectionNames",
  "getUsers",
  "stats",
  "version",
  "createCollection",
  "dropDatabase",
];

export const COLLECTION_METHODS = [
  "find",
  "findOne",
  "aggregate",
  "insertOne",
  "insertMany",
  "insert",
  "updateOne",
  "updateMany",
  "replaceOne",
  "update",
  "deleteOne",
  "deleteMany",
  "remove",
  "findAndModify",
  "findOneAndUpdate",
  "findOneAndReplace",
  "findOneAndDelete",
  "count",
  "countDocuments",
  "estimatedDocumentCount",
  "distinct",
  "createIndex",
  "getIndexes",
  "dropIndex",
  "stats",
  "getShardVersion",
  "getShardDistribution",
  "drop",
  "getName",
  "getFullName",
  "getDB",
];

/** Cursor modifiers: they return the same cursor, so a chain can go on after them. */
export const CURSOR_MODIFIERS = ["sort", "skip", "limit", "projection", "batchSize", "hint", "maxTimeMS"];

export const CURSOR_METHODS = [
  ...CURSOR_MODIFIERS,
  "toArray",
  "forEach",
  "map",
  "next",
  "hasNext",
  "count",
  "itcount",
  "close",
];

/** Collection methods that return a cursor. */
export const CURSOR_SOURCES = ["find", "aggregate"];

/** Query and update operators and aggregation stages, offered inside a filter or pipeline. */
export const OPERATORS = [
  ...["$eq", "$ne", "$gt", "$gte", "$lt", "$lte", "$in", "$nin", "$and", "$or", "$nor", "$not"],
  ...["$exists", "$type", "$regex", "$options", "$elemMatch", "$size", "$all", "$expr", "$text", "$mod"],
  ...["$set", "$unset", "$inc", "$push", "$pull", "$addToSet", "$rename", "$min", "$max", "$mul"],
  ...["$currentDate", "$pop", "$setOnInsert", "$each"],
  ...["$match", "$group", "$project", "$sort", "$limit", "$skip", "$unwind", "$lookup", "$count"],
  ...["$addFields", "$facet", "$replaceRoot", "$sample", "$out", "$merge", "$sum", "$avg", "$first", "$last"],
];
