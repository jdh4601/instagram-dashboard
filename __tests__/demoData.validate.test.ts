import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { ReelSchema, AccountSnapshotSchema, AccountProfileSchema } from "@/lib/schemas";

const dir = join(__dirname, "..", "examples", "demo-data");
const read = (f: string) => JSON.parse(readFileSync(join(dir, f), "utf8"));

describe("demo data fixtures validate against schemas", () => {
  it("reels.json is a valid Reel[]", () => {
    const reels = z.array(ReelSchema).parse(read("reels.json"));
    expect(reels.length).toBeGreaterThan(0);
  });
  it("snapshots.json is a valid AccountSnapshot[]", () => {
    z.array(AccountSnapshotSchema).parse(read("snapshots.json"));
  });
  it("profile.json is a valid AccountProfile", () => {
    AccountProfileSchema.parse(read("profile.json"));
  });
});
