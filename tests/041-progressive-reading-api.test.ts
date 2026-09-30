import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";

const body = { consent: true, stage: "summary", yunGender: 0, fortuneYear: 2026,
  input: { date: "1994-12-01", time: "08:37", calendar: "solar", topic: "general",
    birthplace: { countryCode: "KR", countryName: "대한민국", city: "서울", province: "서울특별시", timezone: "Asia/Seoul", longitude: 126.978 } } };

function harness(reply: unknown, error?: Error) {
  const filename = fileURLToPath(new URL("../app/api/reading/route.ts", import.meta.url));
  const actual = createRequire(filename);
  const calls: Record<string, any>[] = [];
  const module = { exports: {} as { POST: (request: Request) => Promise<Response> } };
  const code = ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports,
    require(name: string) {
      if (name === "@google/genai") return { GoogleGenAI: class {
        models = { generateContent: async (options: Record<string, unknown>) => { calls.push(options); if (error) throw error; return { text: typeof reply === "string" ? reply : JSON.stringify(reply) }; } };
      } };
      return actual(name);
    },
    process: { env: { GEMINI_API_KEY: "synthetic-key" } }, console, Request, Response, AbortController, AbortSignal, Error, TypeError, Date, setTimeout, clearTimeout,
  }, { filename });
  return { calls, request: (patch: Record<string, unknown> = {}, signal?: AbortSignal) => module.exports.POST(new Request("http://localhost/api/reading", { method: "POST", body: JSON.stringify({ ...body, ...patch }), signal })) };
}

test("짧은 요약도 전송 동의 없이 Gemini를 호출하지 않는다", async () => {
  const api = harness({});
  const response = await api.request({ consent: false });
  assert.equal(response.status, 400);
  assert.equal(api.calls.length, 0);
  assert.equal((await response.json()).error.code, "consent_required");
});

test("요약의 잘못된 JSON·누락 필드·없는 근거 ID는 가짜 성공으로 바꾸지 않는다", async () => {
  for (const invalid of ["not-json", {}, { synthesis: "생활을 돌아보는 설명입니다.", current: "현재 흐름을 살펴봅니다.", action: "작은 활동을 시작해 보세요.", evidenceIds: ["invented-event"] }]) {
    const api = harness(invalid);
    const response = await api.request();
    assert.equal(response.status, 502);
    const result = await response.json();
    assert.equal(result.error.code, "invalid_response");
    assert.equal(result.summary, undefined);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
  }
});

test("요약 호출에서 시간 초과가 발생하면 재시도 가능한 오류를 반환한다", async () => {
  const error = new Error("test timeout"); error.name = "TimeoutError";
  const api = harness(null, error);
  const response = await api.request();
  assert.equal(response.status, 504);
  assert.equal((await response.json()).error.code, "timeout");
});

test("요약 성공은 전체 해석과 구분되며 계산 근거를 검증하고 취소 신호를 전달한다", async () => {
  const summary = { synthesis: "익힌 것을 실제로 활용할 때 방향을 잡기 쉬울 수 있습니다.", current: "이번에는 맡은 일과 준비할 시간을 함께 정해 보세요.", action: "오늘 할 활동 하나와 도움받을 사람을 함께 정해 보세요.", evidenceIds: ["strength_ratio", "annual_flow_balance"] };
  const api = harness(summary);
  const controller = new AbortController();
  const response = await api.request({}, controller.signal);
  assert.equal(response.status, 200);
  const value = await response.json();
  assert.deepEqual(value.summary, summary);
  assert.equal(value.reading, undefined, "요약을 저장 가능한 전체 해석처럼 반환하지 않는다");
  assert.equal(api.calls.length, 1);
  assert.ok(api.calls[0].config.httpOptions.timeout <= 30_000);
  const signal = api.calls[0].config.abortSignal;
  assert.equal(signal.aborted, false);
  controller.abort();
  assert.equal(signal.aborted, true);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
});

test("알 수 없는 AI 단계를 기본 전체 요청으로 바꾸지 않는다", async () => {
  const api = harness({});
  const response = await api.request({ stage: "unexpected" });
  assert.equal(response.status, 400);
  assert.equal(api.calls.length, 0);
});
