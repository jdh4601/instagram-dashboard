import { notFound } from "next/navigation";
import { getHookRepository } from "@/lib/store";
import { ReelBreakdownReport } from "@/components/ReelBreakdownReport";

export const dynamic = "force-dynamic";

export default async function HookBreakdownPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const hook = await getHookRepository().get((await params).id);
  if (!hook?.breakdown) notFound();
  return <ReelBreakdownReport hook={hook} />;
}
