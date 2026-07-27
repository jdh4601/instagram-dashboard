import { ArrowRight, UserRoundSearch } from "lucide-react";
import type { AccountFunnel } from "@/lib/analysis/accountFunnel";
import { ACCOUNT_FUNNEL_WINDOW_DAYS } from "@/lib/analysis/accountFunnel";
import { fmtCount, fmtPct } from "@/lib/ui/format";
import { Badge, Card, CardBody, CardHeader } from "@/components/ui";

interface Props {
  funnel: AccountFunnel | null;
}

export function AccountFunnelCard({ funnel }: Props) {
  if (funnel === null) return null;

  return (
    <Card>
      <CardHeader
        title={`최근 ${ACCOUNT_FUNNEL_WINDOW_DAYS}일 팔로워 순증 분해`}
        icon={<UserRoundSearch size={16} className="text-brand-600" />}
        action={<Badge>계정 전체 기준</Badge>}
      />
      <CardBody className="space-y-2">
        <div className="flex items-center gap-1">
          <Stage label="도달" value={fmtCount(funnel.reach)} />
          <ArrowRight size={14} className="shrink-0 text-neutral-300" aria-hidden="true" />
          <Stage
            label="프로필 방문"
            value={funnel.profileViews === null ? "-" : fmtCount(funnel.profileViews)}
            sub={funnel.viewRate === null ? undefined : fmtPct(funnel.viewRate)}
          />
          <ArrowRight size={14} className="shrink-0 text-neutral-300" aria-hidden="true" />
          {/* 팔로우와 링크 클릭은 순차 단계가 아니라 방문에서 갈라지는 병렬 결과다.
              사이에 화살표를 두면 "팔로워가 링크를 눌렀다"로 읽혀 사실과 달라진다. */}
          <div className="flex flex-1 items-stretch divide-x divide-neutral-200/60">
            <Stage
              label="팔로우"
              value={funnel.follows === null ? "-" : fmtCount(funnel.follows)}
              sub={funnel.followRate === null ? undefined : fmtPct(funnel.followRate)}
              accent
            />
            <Stage
              label="링크 클릭"
              value={funnel.websiteClicks === null ? "-" : fmtCount(funnel.websiteClicks)}
              sub={funnel.linkClickRate === null ? undefined : fmtPct(funnel.linkClickRate)}
              accent
            />
          </div>
        </div>
        <p className="text-xs text-neutral-400">
          팔로우·링크 클릭은 방문 대비 비율(병렬 결과)
          {funnel.netFollows === null ? "" : ` · 순증 ${fmtSigned(funnel.netFollows)}`}
          {funnel.unfollows === null ? "" : ` (언팔 ${fmtCount(funnel.unfollows)})`}
        </p>
        <p className="text-xs text-neutral-400">
          {funnel.date} 기준 · 게시물 귀속이 아닌 계정 전체 수치라 미디어 필터와 무관합니다.
        </p>
      </CardBody>
    </Card>
  );
}

function fmtSigned(value: number): string {
  return value > 0 ? `+${fmtCount(value)}` : fmtCount(value);
}

function Stage({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="flex-1 text-center">
      <p className="text-xs text-neutral-500">{label}</p>
      <p
        className={`text-lg font-bold tabular-nums ${accent ? "text-brand-600" : "text-neutral-900"}`}
      >
        {value}
      </p>
      <p className="min-h-4 text-xs text-neutral-400">{sub ?? ""}</p>
    </div>
  );
}
