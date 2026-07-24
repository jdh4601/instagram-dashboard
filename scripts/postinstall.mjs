#!/usr/bin/env node
// npm install 이후 GitHub Star를 부드럽게 권하는 안내 배너.
// 비대화식(정보 출력만) — CI/자동화 환경에서는 조용히 건너뛴다.
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = "https://github.com/jdh4601/ai-reels-analyzer";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// fresh clone에서 Docker bind mount가 root 소유 data/를 만들지 않도록 먼저 생성한다.
mkdirSync(join(root, "data"), { recursive: true });

// CI, 또는 이 저장소가 다른 프로젝트의 의존성으로 설치된 경우엔 출력하지 않는다.
if (process.env.CI || process.env.npm_config_global) {
  process.exit(0);
}

const cyan = (s) => `[36m${s}[0m`;
const yellow = (s) => `[33m${s}[0m`;
const dim = (s) => `[2m${s}[0m`;

const lines = [
  "",
  yellow("  ⭐  Enjoying ai-reels-analyzer?"),
  `      Star it on GitHub → ${cyan(REPO)}`,
  dim("      It's the easiest way to support the project. Thanks! 🙏"),
  "",
];

// 출력 실패가 설치를 깨뜨리면 안 되므로 방어적으로 처리한다.
try {
  process.stdout.write(lines.join("\n") + "\n");
} catch {
  /* 무시: 안내 문구는 부가 기능일 뿐이다. */
}
