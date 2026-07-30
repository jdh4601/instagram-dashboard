#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// fresh clone에서 Docker bind mount가 root 소유 data/를 만들지 않도록 먼저 생성한다.
mkdirSync(join(root, "data"), { recursive: true });
