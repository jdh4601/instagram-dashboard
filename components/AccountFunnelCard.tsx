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
      <CardBody>
        <div className="flex items-center gap-1">
          <Stage label="도달" value={fmtCount(funnel.reach)} />
          <ArrowRight size={14} className="shrink-0 text-neutral-300" aria-hidden="true" />
          <Stage
            label="프로필 방문"
            value={funnel.profileViews === null ? "-" : fmtCount(funnel.profileViews)}
            sub={funnel.viewRate === null ? undefined : fmtPct(funnel.viewRate)}
            delta={funnel.deltas.viewRate}
            since={funnel.previousDate}
          />
          <ArrowRight size={14} className="shrink-0 text-neutral-300" aria-hidden="true" />
          {/* 팔로우와 링크 클릭은 순차 단계가 아니라 방문에서 갈라지는 병렬 결과다.
              사이에 화살표를 두면 "팔로워가 링크를 눌렀다"로 읽혀 사실과 달라진다. */}
          <div className="flex flex-1 items-stretch divide-x divide-neutral-200/60">
            <Stage
              label="팔로우"
              value={funnel.follows === null ? "-" : fmtCount(funnel.follows)}
              sub={funnel.followRate === null ? undefined : fmtPct(funnel.followRate)}
              delta={funnel.deltas.followRate}
              since={funnel.previousDate}
              accent
            />
            <Stage
              label="링크 클릭"
              value={funnel.websiteClicks === null ? "-" : fmtCount(funnel.websiteClicks)}
              sub={funnel.linkClickRate === null ? undefined : fmtPct(funnel.linkClickRate)}
              delta={funnel.deltas.linkClickRate}
              since={funnel.previousDate}
              accent
            />
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

function Stage({
  label,
  value,
  sub,
  delta,
  since,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  delta?: number | null;
  since?: string | null;
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
      <RateDelta delta={delta ?? null} since={since ?? null} />
    </div>
  );
}

// 전환율의 증감은 퍼센트포인트다. 비율을 비율로 나눈 "몇 % 상승"은 6.0%→6.1%가
// "+1.7% 상승"으로 보여 오해를 부른다.
function RateDelta({ delta, since }: { delta: number | null; since: string | null }) {
  if (delta === null) return <p className="min-h-4" aria-hidden="true" />;

  const rounded = Number(delta.toFixed(2));
  const title = since === null ? undefined : `${since} 대비`;

  if (rounded === 0) {
    return (
      <p className="min-h-4 text-[11px] text-neutral-400 tabular-nums" title={title}>
        변화 없음
      </p>
    );
  }

  const up = rounded > 0;
  return (
    <p
      className={`min-h-4 text-[11px] tabular-nums ${up ? "text-band-strong" : "text-band-weak"}`}
      title={title}
    >
      {up ? "▲" : "▼"} {Math.abs(rounded).toFixed(2)}%p
    </p>
  );
}
