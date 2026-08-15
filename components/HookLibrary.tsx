"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Heart, Plus, Link2, Trash2, Pencil, Scissors, LoaderCircle } from "lucide-react";
import {
  HOOK_CATEGORIES,
  HOOK_CATEGORY_LABELS,
  type Hook,
  type HookDraft,
} from "@/lib/schemas";
import {
  selectHooks,
  splitHookSections,
  HOOK_SORT_LABELS,
  type HookCategoryFilter,
  type HookSort,
} from "@/lib/ui/hookSelect";
import { fmtCount } from "@/lib/ui/format";
import { HOOK_CATEGORY_CLASSES } from "@/lib/ui/hookCategoryStyle";
import { EmptyState, cn } from "@/components/ui";
import { HookForm } from "@/components/HookForm";

interface Props {
  hooks: Hook[];
  onSave: (draft: HookDraft, id?: string) => Promise<void>;
  onToggleFavorite: (id: string, next: boolean) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onBreakdown: (
    id: string,
    onProgress: (progress: { percent: number; message: string }) => void,
  ) => Promise<void>;
}

interface BreakdownJob {
  running: boolean;
  percent: number;
  message: string;
  error?: string;
}

function HookRow({
  hook,
  onToggleFavorite,
  onDelete,
  onEdit,
  onBreakdown,
  breakdownJob,
}: {
  hook: Hook;
  onToggleFavorite: Props["onToggleFavorite"];
  onDelete: Props["onDelete"];
  onEdit: (hook: Hook) => void;
  onBreakdown: (hook: Hook) => void;
  breakdownJob?: BreakdownJob;
}) {
  return (
    <li className="flex items-center gap-3 rounded-card border border-border-subtle bg-surface p-3">
      {hook.thumbnailUrl ? (
        // 원본 릴스 썸네일은 인스타 CDN에서 온다. next/image로 감싸면 도메인 허용
        // 목록을 사람이 손으로 관리해야 해서, 보관함에서는 그냥 img로 둔다.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={hook.thumbnailUrl}
          alt=""
          className="aspect-[9/16] w-12 shrink-0 rounded-lg object-cover"
        />
      ) : (
        // 썸네일이 없어도 같은 자리를 차지해야 줄 높이가 들쭉날쭉하지 않다.
        <div className="aspect-[9/16] w-12 shrink-0 rounded-lg bg-surface-muted" aria-hidden />
      )}

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-neutral-900">{hook.text}</p>
        {hook.sourceHandle && (
          <p className="mt-0.5 text-xs text-neutral-400">
            Inspired by @{hook.sourceHandle}
          </p>
        )}
        {hook.note && <p className="mt-1 text-xs text-neutral-500">{hook.note}</p>}
        {breakdownJob?.running && (
          <p role="status" className="mt-1 text-xs font-medium text-brand-700">
            {breakdownJob.message} · {breakdownJob.percent}%
          </p>
        )}
        {breakdownJob?.error && (
          <p role="alert" className="mt-1 text-xs text-band-weak">
            {breakdownJob.error}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <span
          className={cn(
            "rounded-md px-2 py-1 text-xs font-medium",
            HOOK_CATEGORY_CLASSES[hook.category],
          )}
        >
          {HOOK_CATEGORY_LABELS[hook.category]}
        </span>

        {hook.views != null && (
          <span
            aria-label={`조회수 ${fmtCount(hook.views)}`}
            className="rounded-md bg-surface-muted px-2 py-1 text-xs font-medium text-neutral-600"
          >
            {fmtCount(hook.views)}
          </span>
        )}

        {hook.sourceUrl && (
          <a
            href={hook.sourceUrl}
            target="_blank"
            rel="noreferrer noopener"
            aria-label="원본 릴스 열기"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-neutral-400 hover:bg-surface-muted hover:text-neutral-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
          >
            <Link2 size={16} />
          </a>
        )}

        {hook.sourceUrl &&
          (hook.breakdown && !breakdownJob?.running ? (
            <Link
              href={`/hooks/${hook.id}/breakdown`}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-neutral-900 px-3 text-xs font-semibold text-white hover:bg-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            >
              <Scissors size={14} aria-hidden />
              해체 결과
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => onBreakdown(hook)}
              disabled={breakdownJob?.running}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-brand-50 px-3 text-xs font-semibold text-brand-700 hover:bg-brand-100 disabled:cursor-wait disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            >
              {breakdownJob?.running ? (
                <LoaderCircle size={14} className="animate-spin" aria-hidden />
              ) : (
                <Scissors size={14} aria-hidden />
              )}
              {breakdownJob?.running ? `${breakdownJob.percent}%` : "해체하기"}
            </button>
          ))}

        <button
          type="button"
          onClick={() => onEdit(hook)}
          aria-label="훅 수정"
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-neutral-400 hover:bg-surface-muted hover:text-neutral-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
        >
          <Pencil size={16} />
        </button>

        <button
          type="button"
          onClick={() => onDelete(hook.id)}
          aria-label="훅 삭제"
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-neutral-400 hover:bg-surface-muted hover:text-band-weak focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
        >
          <Trash2 size={16} />
        </button>

        <button
          type="button"
          onClick={() => onToggleFavorite(hook.id, !hook.isFavorite)}
          aria-pressed={hook.isFavorite}
          aria-label="즐겨찾기"
          className={cn(
            "inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
            hook.isFavorite ? "text-band-weak" : "text-neutral-300 hover:text-neutral-400",
          )}
        >
          <Heart size={18} fill={hook.isFavorite ? "currentColor" : "none"} />
        </button>
      </div>
    </li>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
        {title} · {count}
      </h2>
      <ul className="space-y-2">{children}</ul>
    </section>
  );
}

export function HookLibrary({ hooks, onSave, onToggleFavorite, onDelete, onBreakdown }: Props) {
  const [category, setCategory] = useState<HookCategoryFilter>("all");
  const [sort, setSort] = useState<HookSort>("latest");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [breakdownJobs, setBreakdownJobs] = useState<Record<string, BreakdownJob>>({});

  const visible = useMemo(() => selectHooks(hooks, category, sort), [hooks, category, sort]);
  const sections = splitHookSections(visible);

  function openAdd() {
    setEditingId(null);
    setAdding(true);
  }

  function close() {
    setAdding(false);
    setEditingId(null);
  }

  async function submit(draft: HookDraft, id?: string) {
    await onSave(draft, id);
    close();
  }

  async function startBreakdown(hook: Hook) {
    setBreakdownJobs((current) => ({
      ...current,
      [hook.id]: { running: true, percent: 1, message: "해체를 준비하는 중" },
    }));
    try {
      await onBreakdown(hook.id, (progress) =>
        setBreakdownJobs((current) => ({
          ...current,
          [hook.id]: { running: true, ...progress },
        })),
      );
      setBreakdownJobs((current) => ({
        ...current,
        [hook.id]: { running: false, percent: 100, message: "해체 완료" },
      }));
    } catch (error) {
      setBreakdownJobs((current) => ({
        ...current,
        [hook.id]: {
          running: false,
          percent: 0,
          message: "해체 실패",
          error: error instanceof Error ? error.message : "릴스 해체에 실패했습니다",
        },
      }));
    }
  }

  /**
   * 수정 폼은 누른 행 자리에서 연다.
   *
   * 목록 맨 위에 열면 스무 번째 줄에서 연필을 눌렀을 때 폼이 화면 밖에 생겨
   * 버튼이 안 먹은 것처럼 보인다. 새 훅 추가만 목록 위에 둔다 — 그건 어느 행과도
   * 묶이지 않고, 버튼 바로 아래라 이미 눈에 들어온다.
   */
  function renderRow(hook: Hook) {
    if (hook.id === editingId) {
      return (
        <li key={hook.id}>
          <HookForm key={hook.id} editing={hook} onSubmit={submit} onCancel={close} />
        </li>
      );
    }
    return (
      <HookRow
        key={hook.id}
        hook={hook}
        onToggleFavorite={onToggleFavorite}
        onDelete={onDelete}
        onBreakdown={startBreakdown}
        breakdownJob={breakdownJobs[hook.id]}
        onEdit={(target) => {
          setAdding(false);
          setEditingId(target.id);
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as HookSort)}
          aria-label="정렬 기준"
          className="min-h-11 rounded-lg border border-border-subtle bg-surface px-3 text-sm text-neutral-600"
        >
          {(Object.keys(HOOK_SORT_LABELS) as HookSort[]).map((value) => (
            <option key={value} value={value}>
              {HOOK_SORT_LABELS[value]}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={openAdd}
          className="ml-auto inline-flex min-h-11 items-center gap-1 rounded-lg bg-brand-600 px-3 text-sm font-medium text-white hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
        >
          <Plus size={16} aria-hidden />
          훅 추가
        </button>
      </div>

      {/* 분류는 값이 아니라 라벨만 화면에 남기는 칩으로 고른다 — 저장 값이 그대로
          노출되면 나중에 분류 체계를 바꿀 때 화면 문구까지 끌려간다. */}
      <div role="group" aria-label="분류 필터" className="flex flex-wrap gap-1">
        {(["all", ...HOOK_CATEGORIES] as HookCategoryFilter[]).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setCategory(value)}
            aria-pressed={category === value}
            className={cn(
              "min-h-11 rounded-lg px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
              category === value
                ? "bg-brand-600 text-white"
                : "bg-surface-muted text-neutral-600 hover:text-neutral-900",
            )}
          >
            {value === "all" ? "전체 분류" : HOOK_CATEGORY_LABELS[value]}
          </button>
        ))}
      </div>

      {adding && <HookForm key="new" editing={null} onSubmit={submit} onCancel={close} />}

      {hooks.length === 0 ? (
        <EmptyState
          title="아직 담아 둔 훅이 없습니다"
          hint="잘된 릴스의 첫 문장을 훅 추가로 담아 두면 다음 대본을 쓸 때 바로 꺼내 쓸 수 있습니다."
        />
      ) : visible.length === 0 ? (
        <EmptyState title="이 분류에 담아 둔 훅이 없습니다" hint="다른 분류를 골라 보세요." />
      ) : (
        <div className="space-y-5">
          {sections.favorites.length > 0 && (
            <Section title="즐겨찾는 훅" count={sections.favorites.length}>
              {sections.favorites.map(renderRow)}
            </Section>
          )}

          <Section title="전체 훅" count={sections.all.length}>
            {sections.all.map(renderRow)}
          </Section>
        </div>
      )}
    </div>
  );
}
