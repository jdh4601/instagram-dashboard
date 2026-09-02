import Link from "next/link";
import { Activity, Info, Megaphone } from "lucide-react";
import type { AdUnit } from "@/lib/ads/adUnit";
import type { Reel } from "@/lib/schemas";
import { adUnitStatus, goalLabel, NONE } from "@/lib/ui/adUnitLabels";
import { detailPathForMedia } from "@/lib/ui/navigation";
import { AdUnitThumbnail } from "@/components/AdUnitThumbnail";
import { fmtCount, fmtWon } from "@/lib/ui/format";
import { Badge, Card, CardBody, CardHeader, EmptyState, Stat } from "@/components/ui";

interface Props {
  unit: AdUnit;
  /** 이 광고가 태운 오가닉 게시물. 잇지 못하면 null이고, 그래도 광고는 그대로 보여 준다. */
  post: Reel | null;
}

export function AdUnitDetail({ unit, post }: Props) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
      <div className="space-y-4">
        <Creative unit={unit} />
        <Performance unit={unit} />
        <ActivityCard unit={unit} />
      </div>
      <div className="space-y-4">
        <Details unit={unit} />
        <OriginalContent unit={unit} post={post} />
      </div>
    </div>
  );
}

/** 어느 소재를 태운 광고인지 한눈에 보여 주는 자리. */
function Creative({ unit }: { unit: AdUnit }) {
  const status = adUnitStatus(unit);

  return (
    <Card>
      <CardBody>
        <div className="flex items-center gap-4">
          <AdUnitThumbnail url={unit.thumbnailUrl} size="lg" />
          <div className="min-w-0 space-y-1.5">
            <Badge band={status.band}>{status.label}</Badge>
            <p className="line-clamp-2 font-medium text-neutral-900">{unit.name}</p>
            {unit.permalink && (
              <a
                href={unit.permalink}
                target="_blank"
                rel="noreferrer"
                className="inline-block text-xs text-brand-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
              >
                인스타그램에서 보기
              </a>
            )}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

function Performance({ unit }: { unit: AdUnit }) {
  if (!unit.hasDelivery) {
    return (
      <Card>
        <CardHeader title="성과" icon={<Megaphone size={16} className="text-brand-500" />} />
        <CardBody>
          {/* 0으로 채우면 "돌았는데 아무도 안 봤다"로 읽혀 멀쩡한 광고를 죽이게 된다. */}
          <EmptyState
            title="아직 집행 성과가 없습니다"
            hint="심사가 끝나고 노출이 시작되면 수치가 채워집니다."
          />
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader title="성과" icon={<Megaphone size={16} className="text-brand-500" />} />
      <CardBody>
        <div className="grid grid-cols-2 gap-3">
          <Stat
            labelQualifier={goalLabel(unit.goal)}
            label="결과"
            value={unit.results ? fmtCount(unit.results.count) : NONE}
          />
          <Stat
            label="결과당 비용"
            value={unit.costPerResult === null ? NONE : fmtWon(unit.costPerResult)}
          />
          <Stat labelQualifier="노출" label="조회" value={fmtCount(unit.impressions)} />
          <Stat labelQualifier="도달" label="조회자" value={fmtCount(unit.reach)} />
        </div>
        <p className="mt-3 text-xs text-neutral-400">
          지출 {fmtWon(unit.spend)}
          {unit.engagements !== null && ` · 참여 ${fmtCount(unit.engagements)}건`}
        </p>
      </CardBody>
    </Card>
  );
}

/**
 * 광고에 달린 행동을 가로 막대로 나열한다.
 *
 * 이름을 모르는 행동도 원문 키로 그린다. 고정 목록으로 거르면 Business Suite에는
 * 있는 막대가 여기서만 사라져, 화면이 조용히 덜 말하게 된다.
 */
function ActivityCard({ unit }: { unit: AdUnit }) {
  if (unit.activity.length === 0) return null;
  const max = Math.max(...unit.activity.map((row) => row.value), 1);

  return (
    <Card>
      <CardHeader title="활동" icon={<Activity size={16} className="text-brand-500" />} />
      <CardBody>
        <ul className="space-y-2.5">
          {unit.activity.map((row) => (
            <li key={row.key}>
              <div className="flex items-baseline justify-between gap-2">
                <span
                  className={row.label ? "text-sm text-neutral-700" : "text-sm text-neutral-400"}
                >
                  {row.label ?? row.key}
                </span>
                <span className="text-sm font-medium tabular-nums text-neutral-900">
                  {fmtCount(row.value)}
                </span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-surface-muted">
                <div
                  className="h-2 rounded-full bg-brand-500"
                  style={{ width: `${Math.max((row.value / max) * 100, 2)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}

function Details({ unit }: { unit: AdUnit }) {
  const status = adUnitStatus(unit);

  return (
    <Card>
      <CardHeader title="상세" icon={<Info size={16} className="text-brand-500" />} />
      <CardBody>
        <dl className="space-y-3 text-sm">
          <Field label="상태">
            <Badge band={status.band}>{status.label}</Badge>
          </Field>
          <Field label="목표">{goalLabel(unit.goal)}</Field>
          <Field label="예산">
            {unit.budget
              ? `${fmtWon(unit.budget.amount)}${unit.budget.kind === "DAILY" ? " / 일" : ""}`
              : NONE}
          </Field>
          <Field label="기간">{period(unit)}</Field>
        </dl>
      </CardBody>
    </Card>
  );
}

/**
 * 원본 콘텐츠 성과.
 *
 * 게시물 지표는 광고로 얻은 몫까지 함께 센다. 그래서 전체를 적고 그 옆에 광고분을
 * 따로 적어야, 오가닉이 얼마나 돌았는지 읽을 수 있다.
 */
function OriginalContent({ unit, post }: Props) {
  return (
    <Card>
      <CardHeader title="원본 콘텐츠 성과" />
      <CardBody>
        {post === null ? (
          <EmptyState
            title="이 광고와 이을 수 있는 게시물을 찾지 못했습니다"
            hint="페이스북 전용 소재이거나, 아직 동기화하지 않은 게시물일 수 있습니다."
          />
        ) : (
          <div className="space-y-3">
            <Link
              href={detailPathForMedia(post.mediaType ?? "REELS", post.id)}
              className="line-clamp-2 block text-sm font-medium text-brand-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            >
              {post.caption ?? post.id}
            </Link>
            <dl className="space-y-3 text-sm">
              <Field label="조회">
                {post.views.toLocaleString()}
                <span className="ml-1 text-xs text-neutral-400">
                  광고 {fmtCount(unit.impressions)}
                </span>
              </Field>
              <Field label="도달">
                {post.reach.toLocaleString()}
                <span className="ml-1 text-xs text-neutral-400">광고 {fmtCount(unit.reach)}</span>
              </Field>
              <Field label="참여">
                {(post.likes + post.comments + post.saves + post.shares).toLocaleString()}
                {unit.engagements !== null && (
                  <span className="ml-1 text-xs text-neutral-400">
                    광고 {fmtCount(unit.engagements)}
                  </span>
                )}
              </Field>
            </dl>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-neutral-500">{label}</dt>
      <dd className="text-right font-medium text-neutral-900">{children}</dd>
    </div>
  );
}

function period(unit: AdUnit): string {
  if (!unit.startTime) return NONE;
  const start = fmtDay(unit.startTime);
  const end = unit.endTime ? fmtDay(unit.endTime) : null;
  return end ? `${start} ~ ${end}` : `${start} 시작`;
}

function fmtDay(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return `${date.getFullYear()}. ${date.getMonth() + 1}. ${date.getDate()}.`;
}
