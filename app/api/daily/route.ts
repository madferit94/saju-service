import { NextResponse } from "next/server";
import { getCachedDailyContext } from "../../../lib/saju/daily-context-cache";
import { koreanClock, nextDailyRefresh } from "../../../lib/saju/daily-fortune";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const now = new Date();
  const { date, hour } = koreanClock(now);
  const nextRefreshAt = nextDailyRefresh(now);
  if (hour < 9) {
    return NextResponse.json({ ready: false, date, nextRefreshAt }, {
      headers: { "Cache-Control": "no-store" },
    });
  }
  try {
    const context = await getCachedDailyContext(date);
    return NextResponse.json({ ready: true, context, nextRefreshAt }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ ready: false, error: "오늘 운세 자료를 준비하지 못했습니다." }, {
      status: 503, headers: { "Cache-Control": "no-store" },
    });
  }
}
