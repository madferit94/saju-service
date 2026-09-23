import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";
import { CHAPTERS } from "../lib/saju/consultation";
import { calculate, type SajuInput } from "../lib/saju/chart";
import { calculateDaewoon } from "../lib/saju/daewoon";
import { buildLifeSeasons } from "../lib/saju/life-seasons";

const input = { date: "1994-12-01", time: "08:37", calendar: "solar", topic: "general", birthplace: { countryCode: "KR", countryName: "대한민국", city: "개인도시", timezone: "Asia/Seoul", longitude: 126.978 } };
const body = { consent: true, input, yunGender: 0, fortuneYear: 2026, chapterId: "natal" };
const valid = () => ({ id: "natal", title: CHAPTERS[0].title, summary: "도움받을 일과 혼자 결정할 일을 나누고 실제로 편했던 상황과 어려웠던 상황을 비교해 보세요.", sections: Array.from({ length: 3 }, (_, i) => ({
  heading: `${i}번째 구체적 근거`, text: `${i}번째 절은 개인 원국의 근거들을 함께 살펴보며 도움을 받는 조건과 부담이 생기는 조건을 현실의 경험과 연결해서 설명합니다. `.repeat(3) + "\n\n" + "어떤 상황에서 이러한 차이가 생겼는지 실제 기억을 확인해 보세요. 맡은 일을 나누어도 결정할 권한이 충분했는지, 도움을 받으면서 상대의 기대를 따라야 했는지에 따라 선택 기준이 달라질 수 있습니다. ".repeat(2),
  evidenceIds: ["strength_season", "strength_ratio"],
  counterpoint: "반대 조건으로는 월지의 가중치가 달라질 때 해석의 경계가 달라진다는 점을 함께 검토해야 합니다.",
  example: "예를 들어 다른 사람과 함께 역할을 나누는 상황이라면 결정 권한의 범위를 확인하는 장면으로 살펴볼 수 있습니다.",
  question: "혼자 맡을 때와 도움을 받을 때 본인의 실제 경험은 어떻게 달랐나요?",
  action: "이번 주에 맡은 일과 결정할 수 있는 범위를 적고 반복되는 부담의 조건을 함께 비교해 보세요.",
})) });

function lifetimeDraft(includeCurrentSeason: boolean) {
  const report = buildLifeSeasons(calculate(input as SajuInput), calculateDaewoon(input as SajuInput, 0, 2026));
  const active = report.periods.find(period => period.index === report.current!.periodIndex)!;
  const activePosition = report.periods.findIndex(period => period.index === active.index);
  const other = report.periods.slice(Math.max(0, activePosition - 1), activePosition + 2).find(period => period.seasonLabel !== active.seasonLabel);
  const draft = valid();
  return {
    ...draft, id: "lifetime", title: CHAPTERS.find(chapter => chapter.id === "lifetime")!.title,
    summary: includeCurrentSeason ? `${active.startYear}년부터 ${active.endYear}년까지 ${active.seasonLabel}의 주제가 앞에 옵니다. 이때의 배움과 역할을 실제 환경에 맞춰 선택해 보세요.` : draft.summary,
    sections: draft.sections.map((section, index) => includeCurrentSeason && index === 0 ? {
      ...section,
      text: section.text + `\n\n현재 2026년은 ${active.startYear}~${active.endYear}년 ${active.korean} 대운에 있습니다. 이 시기의 계절은 ${active.seasonLabel}이며, ${other ? `가까운 ${other.seasonLabel} 대운의 주제와` : "이전 경험과"} 비교해 보세요.`,
      evidenceIds: [...section.evidenceIds, `period_${active.index}`],
    } : section),
  };
}

function apiHarness(replies: (unknown | Error)[], configured = true) {
  const filename = fileURLToPath(new URL("../app/api/consultation/route.ts", import.meta.url));
  const requireActual = createRequire(filename);
  const calls: Record<string, any>[] = [];
  const module = { exports: {} as { POST: (request: Request) => Promise<Response> } };
  const code = ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  vm.runInNewContext(code, {
    module, exports: module.exports,
    require(name: string) {
      if (name === "@google/genai") return { GoogleGenAI: class {
        models = { generateContent: async (options: Record<string, unknown>) => {
          calls.push(options);
          assert.ok(replies.length, "unexpected external request");
          const next = replies.shift(); if (next instanceof Error) throw next;
          return { text: typeof next === "string" ? next : JSON.stringify(next) };
        } };
      } };
      return requireActual(name);
    },
    process: { env: { GEMINI_API_KEY: configured ? "synthetic-unit-test-key" : undefined } },
    console, Request, Response, AbortController, Error, TypeError, Date,
  }, { filename });
  return { calls, request: (payload: unknown) => module.exports.POST(new Request("http://localhost/api/consultation", { method: "POST", body: typeof payload === "string" ? payload : JSON.stringify(payload) })) };
}

test("상담 API는 동의·장·입력·연도 오류와 키 미설정을 외부 요청 전에 차단한다", async () => {
  const api = apiHarness([]);
  for (const invalid of ["{", { ...body, consent: false }, { ...body, chapterId: "unknown" }, { ...body, fortuneYear: 2026.5 }, { ...body, yunGender: 2 }, { ...body, input: null }, { ...body, input: { ...input, birthplace: undefined } }]) {
    const response = await api.request(invalid);
    assert.equal(response.status, 400);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
  }
  assert.equal((await api.request("x".repeat(24001))).status, 413);
  assert.equal(api.calls.length, 0);
  const missing = apiHarness([], false);
  assert.equal((await missing.request(body)).status, 503);
  assert.equal(missing.calls.length, 0);
});

test("상담 API는 계산을 서버에서 다시 만들고 원래 출생 입력이나 임의 근거를 Gemini에 보내지 않는다", async () => {
  const api = apiHarness([valid()]);
  const response = await api.request({ ...body, context: { fake: "전송하면 안 되는 사용자 근거" } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  const result = await response.json();
  assert.equal(result.analysisVersion, 1);
  assert.equal(result.readingStyleVersion, 3);
  assert.equal(result.year, 2026);
  assert.equal(result.chapter.id, "natal");
  assert.equal(api.calls[0].model, "gemini-3.5-flash-lite");
  for (const secret of [input.date, input.time, input.birthplace.city, input.birthplace.timezone, "전송하면 안 되는 사용자 근거"]) assert.ok(!api.calls[0].contents.includes(secret), secret);
});

test("새 상담 API는 요약 없는 예전 형식의 모델 응답을 그대로 성공 처리하지 않는다", async () => {
  const { summary: _summary, ...legacy } = valid();
  const recovered = apiHarness([legacy, valid()]);
  const response = await recovered.request(body);
  assert.equal(response.status, 200);
  assert.equal(recovered.calls.length, 2);
  assert.ok((await response.json()).chapter.summary.length >= 30);
  const rejected = apiHarness([legacy, legacy]);
  assert.equal((await rejected.request(body)).status, 502);
  assert.equal(rejected.calls.length, 2);
});

test("평생 상담 API는 누락된 현재 계절을 서버의 계산 자료로 보충한다", async () => {
  const lifetimeBody = { ...body, chapterId: "lifetime" };
  const missing = lifetimeDraft(false);
  const report = buildLifeSeasons(calculate(input as SajuInput), calculateDaewoon(input as SajuInput, 0, 2026));
  const active = report.periods.find(period => period.index === report.current!.periodIndex)!;
  const api = apiHarness([missing]);
  const response = await api.request(lifetimeBody);
  assert.equal(response.status, 200);
  assert.equal(api.calls.length, 1);
  const chapter = (await response.json()).chapter;
  assert.ok(chapter.sections[0].text.includes(`${report.current!.currentYear}년`));
  assert.ok(chapter.sections[0].text.includes(active.seasonLabel));
  assert.ok(chapter.sections[0].text.includes(active.startYear.toString()));
  assert.ok(!JSON.stringify(chapter).includes(input.date));
  assert.ok(!JSON.stringify(chapter).includes(input.birthplace.city));
  const complete = lifetimeDraft(true);
  const alreadyGrounded = apiHarness([complete]);
  const second = await alreadyGrounded.request(lifetimeBody);
  assert.equal(second.status, 200);
  assert.equal(alreadyGrounded.calls.length, 1);
  assert.equal((await second.json()).chapter.sections[0].text, complete.sections[0].text, "이미 현재 계절을 설명한 본문은 중복 보충하지 않는다");
});

test("현재 계절을 명시적으로 잘못 말한 상담은 보충으로 모순을 숨기지 않고 재시도한다", async () => {
  const report = buildLifeSeasons(calculate(input as SajuInput), calculateDaewoon(input as SajuInput, 0, 2026));
  const wrongSeason = ["봄", "여름", "가을", "겨울"].find(label => label !== report.current!.seasonLabel)!;
  const draft = lifetimeDraft(false);
  draft.sections[0].text += `\n\n현재 계절은 ${wrongSeason}.`;
  const api = apiHarness([draft, lifetimeDraft(true)]);
  const response = await api.request({ ...body, chapterId: "lifetime" });
  assert.equal(response.status, 200);
  assert.equal(api.calls.length, 2);
  assert.match(api.calls[1].contents, /계절.*다르게|다르게.*계절/);
  assert.equal((await response.json()).chapter.summary, lifetimeDraft(true).summary);
});

test("부실한 상담 응답은 정확히 한 번 수정 재시도하고 성공 시에만 표시한다", async () => {
  const draft = { ...valid(), sections: [] };
  const api = apiHarness([draft, valid()]);
  const response = await api.request(body);
  assert.equal(response.status, 200);
  assert.equal(api.calls.length, 2);
  assert.match(api.calls[1].contents, /직전 응답 검증 오류/);
  assert.ok(api.calls[1].contents.includes(JSON.stringify(draft)), "편집 요청에 고칠 초안이 포함된다");
  assert.ok(api.calls[1].contents.includes("strength_ratio"), "편집 때도 계산으로 확인된 근거를 제공한다");
  assert.ok(!api.calls[1].contents.includes(api.calls[0].contents), "긴 최초 작성 프롬프트를 그대로 반복하지 않는다");
  for (const secret of [input.date, input.time, input.birthplace.city, input.birthplace.timezone]) assert.ok(!api.calls[1].contents.includes(secret), secret);
  const failed = apiHarness([{}, {}]);
  const rejected = await failed.request(body);
  assert.equal(rejected.status, 502);
  assert.equal(failed.calls.length, 2);
  assert.equal((await rejected.json()).chapter, undefined);
});

test("상담 API의 크레딧·요청한도·시간초과 오류는 성공으로 위장하지 않는다", async () => {
  for (const [error, expected] of [[Object.assign(new Error("quota"), { status: 402 }), 402], [Object.assign(new Error("rate"), { status: 429 }), 429], [Object.assign(new Error("timeout"), { name: "TimeoutError" }), 504]] as const) {
    const api = apiHarness([error]);
    const response = await api.request(body);
    assert.equal(response.status, expected);
    assert.equal(api.calls.length, 1);
    const result = await response.json();
    assert.ok(result.error.message);
    assert.equal(result.chapter, undefined);
  }
});
