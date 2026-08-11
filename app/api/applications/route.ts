import { NextResponse } from "next/server";
import { getApplicationRepository } from "@/lib/store";

/**
 * 신청 목록. 폼 미연동이면 빈 배열이라 화면은 신청 구간을 감춘다.
 *
 * 응답에는 UTM만 담긴다(ApplicationSchema). 신청자 이름·연락처는 애초에 저장하지
 * 않으므로 이 엔드포인트로 개인정보가 나갈 일이 없다.
 */
export async function GET() {
  const applications = await getApplicationRepository().list();
  return NextResponse.json({ applications });
}
