import { NextResponse } from "next/server";
import { getCachedDailyContext } from "../../../../lib/saju/daily-context-cache";
import { koreanClock } from "../../../../lib/saju/daily-fortune";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const { date, hour } = koreanClock(new Date());
  if (hour < 9) {
    return NextResponse.json({ error: "before_release_time", date }, { status: 425, headers: { "Cache-Control": "no-store" } });
  }
  try {
    const context = await getCachedDailyContext(date);
    return NextResponse.json({ ready: true, date: context.date, dayGanji: context.dayGanji }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ error: "daily_context_failed" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
