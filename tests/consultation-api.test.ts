import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";
import { CHAPTERS } from "../lib/saju/consultation";

const input = { date: "1994-12-01", time: "08:37", calendar: "solar", topic: "general", birthplace: { countryCode: "KR", countryName: "대한민국", city: "개인도시", timezone: "Asia/Seoul", longitude: 126.978 } };
const body = { consent: true, input, yunGender: 0, fortuneYear: 2026, chapterId: "natal" };
const valid = () => ({ id: "natal", title: CHAPTERS[0].title, sections: Array.from({ length: 3 }, (_, i) => ({
  heading: `${i}번째 구체적 근거`, text: `${i}번째 절은 개인 원국의 근거들을 함께 살펴보며 도움을 받는 조건과 부담이 생기는 조건을 현실의 경험과 연결해서 설명합니다. `.repeat(4),
  evidenceIds: ["strength_season", "strength_ratio"],
  counterpoint: "반대 조건으로는 월지의 가중치가 달라질 때 해석의 경계가 달라진다는 점을 함께 검토해야 합니다.",
  example: "예를 들어 다른 사람과 함께 역할을 나누는 상황이라면 결정 권한의 범위를 확인하는 장면으로 살펴볼 수 있습니다.",
  question: "혼자 맡을 때와 도움을 받을 때 본인의 실제 경험은 어떻게 달랐나요?",
  action: "이번 주에 맡은 일과 결정할 수 있는 범위를 적고 반복되는 부담의 조건을 함께 비교해 보세요.",
})) });

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
  assert.equal(result.year, 2026);
  assert.equal(result.chapter.id, "natal");
  assert.equal(api.calls[0].model, "gemini-3.5-flash-lite");
  for (const secret of [input.date, input.time, input.birthplace.city, input.birthplace.timezone, "전송하면 안 되는 사용자 근거"]) assert.ok(!api.calls[0].contents.includes(secret), secret);
});

test("부실한 상담 응답은 정확히 한 번 수정 재시도하고 성공 시에만 표시한다", async () => {
  const api = apiHarness([{ ...valid(), sections: [] }, valid()]);
  const response = await api.request(body);
  assert.equal(response.status, 200);
  assert.equal(api.calls.length, 2);
  assert.match(api.calls[1].contents, /직전 응답 검증 오류/);
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
