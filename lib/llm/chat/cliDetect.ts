import { execFile } from "node:child_process";
import { CLI_PRESETS, CLI_PROVIDER_IDS, type CliProviderId } from "@/lib/llm/cliProviders";

/** --version 한 번 띄우는 비용이므로 짧게 잡는다. 넘기면 없는 것으로 본다. */
const PROBE_TIMEOUT_MS = 3_000;

export type CliAvailability = Record<CliProviderId, boolean>;

// 설정 화면을 열 때마다 프로세스를 세 개 띄우지 않도록 결과를 캐시한다.
// 개발 중 CLI를 새로 설치하면 서버 재시작이 필요하지만, 그 편이 매 요청 spawn보다 낫다.
let cached: Promise<CliAvailability> | null = null;

function probe(command: string): Promise<boolean> {
  return new Promise((resolve) => {
    execFile(command, ["--version"], { timeout: PROBE_TIMEOUT_MS }, (error) => {
      resolve(!error);
    });
  });
}

export function detectAvailableClis(): Promise<CliAvailability> {
  if (!cached) {
    cached = Promise.all(
      CLI_PROVIDER_IDS.map(async (id) => [id, await probe(CLI_PRESETS[id].command)] as const),
    ).then((entries) => Object.fromEntries(entries) as CliAvailability);
  }
  return cached;
}

/** 테스트와 설치 직후 재확인용. */
export function resetCliDetectionCache(): void {
  cached = null;
}
