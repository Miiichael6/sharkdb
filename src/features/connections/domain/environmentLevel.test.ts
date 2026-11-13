import { describe, expect, it } from "vitest";
import { newConnection, type MongoConnection, type Tag } from "./connection";
import { DEVELOPMENT_LEVEL, LOCAL_LEVEL, PRODUCTION_LEVEL, QA_LEVEL, canSyncDocumentsTo, environmentLevel } from "./environmentLevel";

const connection = (id: string, tag: Tag, over: { protected?: boolean; host?: string } = {}): MongoConnection => ({
  ...newConnection(),
  id,
  name: id,
  host: over.host ?? `${id}.corp`,
  protected: !!over.protected,
  tag,
});

const PROD = connection("prod", "production");
const QA = connection("qa", "testing");
const STAGING = connection("staging", "staging");
const LOCAL = connection("local", "local");
const DEV = connection("dev", "development");
const ALL = [PROD, QA, STAGING, LOCAL, DEV];

describe("environmentLevel", () => {
  it("ranks production over QA over development over local", () => {
    expect(environmentLevel("production")).toBe(PRODUCTION_LEVEL);
    expect([environmentLevel("testing"), environmentLevel("staging")]).toEqual([QA_LEVEL, QA_LEVEL]);
    expect([environmentLevel("development"), environmentLevel("local")]).toEqual([DEVELOPMENT_LEVEL, LOCAL_LEVEL]);
  });

  it("lets documents go only to a lower environment", () => {
    const allowed = [[PROD, QA], [PROD, STAGING], [PROD, LOCAL], [QA, LOCAL], [STAGING, DEV], [DEV, LOCAL]];
    const forbidden = [[QA, PROD], [LOCAL, QA], [QA, STAGING], [LOCAL, DEV], [DEV, DEV], [DEV, QA], [QA, QA], [LOCAL, PROD]];
    for (const [source, target] of allowed) expect(canSyncDocumentsTo(source, target, ALL), `${source.id}→${target.id}`).toBe(true);
    for (const [source, target] of forbidden) expect(canSyncDocumentsTo(source, target, ALL), `${source.id}→${target.id}`).toBe(false);
  });

  it("never writes to a protected connection or to the server of one", () => {
    const shielded = connection("shielded", "local", { protected: true });
    const twin = connection("twin", "local", { host: "shared.corp" });
    const guard = connection("guard", "testing", { host: "shared.corp", protected: true });
    const all = [PROD, shielded, twin, guard];
    expect(canSyncDocumentsTo(PROD, shielded, all)).toBe(false);
    expect(canSyncDocumentsTo(PROD, twin, all)).toBe(false);
  });
});
