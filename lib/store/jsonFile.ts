import { chmod, mkdir, rename, unlink, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname } from "node:path";

// Internal helpers shared by the JSON-file repositories in this directory.
// Not part of the public store API.

// Per-file promise-chain mutex. Read-modify-write cycles on the same file
// are chained onto the previous operation's tail so they serialize, while
// operations on different files run concurrently. The stored tail never
// rejects, so a failed operation cannot poison the chain for later ones.
const tails = new Map<string, Promise<void>>();

export function withFileLock<T>(file: string, fn: () => Promise<T>): Promise<T> {
  const prev = tails.get(file) ?? Promise.resolve();
  const result = prev.then(fn);
  const tail = result.then(
    () => undefined,
    () => undefined,
  );
  tails.set(file, tail);
  // Drop settled chain heads so the map cannot grow unboundedly.
  void tail.then(() => {
    if (tails.get(file) === tail) tails.delete(file);
  });
  return result;
}

// Atomic write: serialize to a sibling temp file, then rename over the
// target. POSIX rename is atomic, so concurrent readers always see either
// the old or the new complete file — never a truncated one.
export async function writeJsonAtomic(
  file: string,
  value: unknown,
  options: { mode?: number } = {},
): Promise<void> {
  const dir = dirname(file);
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });
  const tmp = `${file}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await writeFile(tmp, JSON.stringify(value, null, 2), {
      encoding: "utf8",
      mode: options.mode,
    });
    if (options.mode !== undefined) await chmod(tmp, options.mode);
    await rename(tmp, file);
    // Older versions used a fixed sibling name. Clean up harmless crash debris
    // after a successful replacement without making the write fail.
    await unlink(`${file}.tmp`).catch(() => undefined);
  } catch (error) {
    await unlink(tmp).catch(() => undefined);
    throw error;
  }
}
