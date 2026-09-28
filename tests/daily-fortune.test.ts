import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";
import { calculate, type SajuInput } from "../lib/saju/chart";
import { calculateDaewoon } from "../lib/saju/daewoon";
import { buildDailyContext, buildPersonalDailyFortune, koreanClock, nextDailyRefresh } from "../lib/saju/daily-fortune";

test("한국 시간 오전 9시 경계와 자정, 연말의 다음 갱신 시각을 계산한다", () => {
  const before = new Date("2026-09-28T23:59:59+09:00");
  const morning = new Date("2026-09-29T08:59:59+09:00");
  const released = new Date("2026-09-29T09:00:00+09:00");
  assert.deepEqual(koreanClock(morning), { date: "2026-09-29", hour: 8 });
  assert.deepEqual(koreanClock(released), { date: "2026-09-29", hour: 9 });
  assert.equal(nextDailyRefresh(before), "2026-09-29T00:00:00.000Z");
  assert.equal(nextDailyRefresh(morning), "2026-09-29T00:00:00.000Z");
  assert.equal(nextDailyRefresh(released), "2026-09-30T00:00:00.000Z");
  assert.equal(nextDailyRefresh(new Date("2026-12-31T09:00:00+09:00")), "2027-01-01T00:00:00.000Z");
});

test("일진 날짜는 실제 양력 날짜만 허용하고 같은 날짜에는 같은 간지를 만든다", () => {
  for (const invalid of ["2026-2-01", "2026-02-29", "2026-13-01", "2026-00-01", "2026-04-31", "1989-12-31", "2101-01-01", "2026-09-28T00:00:00Z"]) {
    assert.throws(() => buildDailyContext(invalid), /날짜/);
  }
  const first = buildDailyContext("2026-09-29");
  assert.deepEqual(buildDailyContext("2026-09-29"), first);
  assert.notEqual(buildDailyContext("2026-09-30").dayGanji, first.dayGanji);
  assert.match(first.dayGanji, /^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]$/);
});

test("같은 일진도 출생 사주에 따라 개인 풀이와 근거가 달라진다", () => {
  const base: SajuInput = { date: "1994-12-01", time: "08:37", calendar: "solar", topic: "general" };
  const other: SajuInput = { ...base, date: "1994-12-15" };
  const context = buildDailyContext("2026-09-29");
  const first = buildPersonalDailyFortune(calculate(base), calculateDaewoon(base, 0, 2026), context);
  const second = buildPersonalDailyFortune(calculate(other), calculateDaewoon(other, 0, 2026), context);
  assert.equal(first.date, context.date);
  assert.equal(second.dayGanji, context.dayGanji);
  assert.notEqual(first.opportunity, second.opportunity);
  assert.notEqual(first.action, second.action);
  assert.notDeepEqual(first.evidence, second.evidence);
  assert.ok(first.evidence.length > 0);
});

function routeHarness(route: "daily" | "cron/daily", at: string, secret?: string) {
  const filename = fileURLToPath(new URL(`../app/api/${route}/route.ts`, import.meta.url));
  const code = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const calls: string[] = [];
  const module = { exports: {} as { GET: (request: Request) => Promise<Response> } };
  const context = buildDailyContext(koreanClock(new Date(at)).date);
  class FixedDate extends Date {
    constructor() {
      super(at);
    }
  }
  vm.runInNewContext(code, {
    module, exports: module.exports, Date: FixedDate, Request, Response,
    process: { env: { CRON_SECRET: secret } },
    require(name: string) {
      if (name === "next/server") return { NextResponse: { json: (body: unknown, init?: ResponseInit) => Response.json(body, init) } };
      if (name.endsWith("daily-context-cache")) return { getCachedDailyContext: async (date: string) => { calls.push(date); return context; } };
      if (name.endsWith("daily-fortune")) return { koreanClock, nextDailyRefresh };
      throw new Error(`Unexpected import: ${name}`);
    },
  }, { filename });
  return { calls, get: (authorization?: string) => module.exports.GET(new Request(`http://localhost/api/${route}`, { headers: authorization ? { authorization } : undefined })) };
}

test("공개 API는 오전 9시 전에 풀이를 제공하지 않고 9시부터 제공한다", async () => {
  const early = routeHarness("daily", "2026-09-29T08:59:59+09:00");
  const pending = await early.get();
  assert.equal(pending.status, 200);
  assert.equal(pending.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(early.calls, []);
  assert.equal((await pending.json()).ready, false);
  const released = routeHarness("daily", "2026-09-29T09:00:00+09:00");
  const response = await released.get();
  assert.equal(response.status, 200);
  assert.deepEqual(released.calls, ["2026-09-29"]);
  const body = await response.json();
  assert.equal(body.ready, true);
  assert.equal(body.context.date, "2026-09-29");
  assert.equal(body.nextRefreshAt, "2026-09-30T00:00:00.000Z");
});

test("Cron API는 비밀값 누락·오류를 거부하고 정상 호출에만 자료를 준비한다", async () => {
  const missing = routeHarness("cron/daily", "2026-09-29T09:00:00+09:00");
  assert.equal((await missing.get()).status, 401);
  assert.deepEqual(missing.calls, []);
  const configured = routeHarness("cron/daily", "2026-09-29T09:00:00+09:00", "synthetic-test-secret");
  assert.equal((await configured.get()).status, 401);
  assert.equal((await configured.get("Bearer wrong-secret")).status, 401);
  assert.deepEqual(configured.calls, []);
  const accepted = await configured.get("Bearer synthetic-test-secret");
  assert.equal(accepted.status, 200);
  assert.equal(accepted.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(configured.calls, ["2026-09-29"]);
  const body = await accepted.json();
  assert.equal(body.date, "2026-09-29");
  assert.equal(body.dayGanji, buildDailyContext("2026-09-29").dayGanji);
  const early = routeHarness("cron/daily", "2026-09-29T08:59:59+09:00", "synthetic-test-secret");
  assert.equal((await early.get("Bearer synthetic-test-secret")).status, 425);
  assert.deepEqual(early.calls, []);
});

test("Vercel 예약 설정은 한국 시간 오전 9시에 보호된 경로를 호출한다", () => {
  const filename = fileURLToPath(new URL("../vercel.json", import.meta.url));
  const config = JSON.parse(readFileSync(filename, "utf8"));
  assert.deepEqual(config.crons, [{ path: "/api/cron/daily", schedule: "0 0 * * *" }]);
});
