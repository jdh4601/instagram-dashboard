import { spawn as nodeSpawn } from "node:child_process";
import { CLI_PRESETS, type CliProviderId } from "@/lib/llm/cliProviders";
import type { ChatModel, ChatStreamArgs, ChatTurn } from "@/lib/llm/types";

/** CLI는 첫 토큰까지도 오래 걸릴 수 있어 넉넉하게 잡되, 무한정 매달리지는 않는다. */
const DEFAULT_TIMEOUT_MS = 120_000;

/** SIGTERM에 응답하지 않는 프로세스를 강제 종료하기까지의 유예. */
const KILL_GRACE_MS = 2_000;

const STDERR_EXCERPT = 200;

// 테스트에서 가짜 프로세스를 주입할 수 있을 만큼만 좁힌 자식 프로세스 인터페이스.
interface ChildLike {
  stdout: { on(event: "data", listener: (chunk: unknown) => void): unknown };
  stderr: { on(event: "data", listener: (chunk: unknown) => void): unknown };
  stdin: { write(chunk: string): unknown; end(): unknown };
  on(event: "close", listener: (code: number | null) => void): unknown;
  on(event: "error", listener: (error: Error) => void): unknown;
  kill(signal?: NodeJS.Signals): boolean;
}

type SpawnLike = (command: string, args: string[], options: object) => ChildLike;

interface Options {
  providerId: CliProviderId;
  timeoutMs?: number;
  spawn?: SpawnLike;
}

const ROLE_LABEL: Record<ChatTurn["role"], string> = {
  user: "사용자",
  assistant: "어시스턴트",
};

/**
 * 세 CLI의 system 프롬프트 플래그가 제각각이라, 지시문과 대화를 하나의 stdin 본문으로
 * 합쳐 넘긴다. argv에 실으면 인자 길이 제한과 인용 문제를 동시에 떠안는다.
 */
export function buildCliPrompt(system: string, turns: ChatTurn[]): string {
  const conversation = turns
    .map((turn) => `[${ROLE_LABEL[turn.role]}]\n${turn.content}`)
    .join("\n\n");

  return [
    system,
    "---",
    "위 지침에 따라, 아래 대화의 마지막 사용자 메시지에 답하세요.",
    "코드를 작성하거나 파일을 수정하지 말고, 분석 결과만 평문으로 답하세요.",
    "---",
    conversation,
  ].join("\n\n");
}

/**
 * 이 PC에 설치된 코딩 CLI를 챗봇 백엔드로 쓴다.
 *
 * 커맨드와 인자는 CLI_PRESETS 상수에서만 오고 셸을 거치지 않으므로, 사용자 입력이
 * 명령으로 해석될 여지가 없다. 프롬프트는 stdin으로만 전달한다.
 */
export function createLocalCliChatModel(opts: Options): ChatModel {
  const preset = CLI_PRESETS[opts.providerId];
  const spawnFn: SpawnLike = opts.spawn ?? (nodeSpawn as unknown as SpawnLike);
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return {
    async *stream({ system, turns, signal }: ChatStreamArgs) {
      const child = spawnFn(preset.command, preset.args, {
        shell: false,
        stdio: ["pipe", "pipe", "pipe"],
      });

      const queue: string[] = [];
      let wake: (() => void) | null = null;
      let finished = false;
      let failure: Error | null = null;
      let stderrText = "";
      let killTimer: ReturnType<typeof setTimeout> | null = null;

      const notify = () => {
        const resume = wake;
        wake = null;
        resume?.();
      };

      const finish = (error: Error | null) => {
        if (finished) return;
        finished = true;
        failure = error;
        notify();
      };

      const terminate = () => {
        child.kill("SIGTERM");
        // SIGTERM을 무시하는 프로세스가 스트림을 영원히 붙잡지 못하게 한다.
        killTimer = setTimeout(() => child.kill("SIGKILL"), KILL_GRACE_MS);
      };

      child.stdout.on("data", (chunk) => {
        queue.push(String(chunk));
        notify();
      });
      child.stderr.on("data", (chunk) => {
        stderrText += String(chunk);
      });

      child.on("error", (error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") {
          finish(
            new Error(
              `${preset.label}을(를) 찾을 수 없습니다. '${preset.command}' 명령이 PATH에 있어야 합니다 (설치: ${preset.installHint}).`,
            ),
          );
          return;
        }
        finish(new Error(`${preset.label} 실행에 실패했습니다: ${error.message}`));
      });

      child.on("close", (code) => {
        if (code === 0) {
          finish(null);
          return;
        }
        const detail = stderrText.trim().slice(0, STDERR_EXCERPT);
        finish(
          new Error(
            `${preset.label}이(가) 오류로 종료했습니다 (코드 ${code})${detail ? `: ${detail}` : ""}`,
          ),
        );
      });

      const timer = setTimeout(() => {
        terminate();
        finish(new Error(`${preset.label} 응답이 제한 시간(${timeoutMs / 1000}초)을 넘겼습니다.`));
      }, timeoutMs);

      const onAbort = () => {
        terminate();
        finish(new Error("응답 생성이 중단되었습니다."));
      };
      signal?.addEventListener("abort", onAbort, { once: true });

      child.stdin.write(buildCliPrompt(system, turns));
      child.stdin.end();

      try {
        for (;;) {
          while (queue.length > 0) yield queue.shift()!;
          if (finished) break;
          await new Promise<void>((resolve) => {
            wake = resolve;
          });
        }
        if (failure) throw failure;
      } finally {
        clearTimeout(timer);
        if (killTimer) clearTimeout(killTimer);
        signal?.removeEventListener("abort", onAbort);
        // 소비자가 도중에 루프를 빠져나간 경우에도 프로세스를 남기지 않는다.
        if (!finished) child.kill("SIGTERM");
      }
    },
  };
}
