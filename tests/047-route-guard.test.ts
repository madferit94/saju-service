import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";

// 기존 tests/035-reading-api-retry.test.ts·consultation-api.test.ts와 같은 방식:
// 라우트 파일을 테스트마다 새로 실행하므로 모듈 안의 요청 수 제한기도 매번 새로 만들어진다.
// Gemini는 가짜 클래스로 바꿔 호출 수만 센다(외부 네트워크 없음).

const birthplace = { countryCode: "KR", countryName: "대한민국", city: "서울", province: "서울특별시", timezone: "Asia/Seoul", longitude: 126.978 };
const input = { date: "1994-12-01", time: "08:37", calendar: "solar", topic: "general", birthplace };
const readingBody = { consent: true, input, yunGender: 0, fortuneYear: 2026, stage: "summary" };
const consultationBody = { consent: true, input, yunGender: 0, fortuneYear: 2026, chapterId: "natal" };

function routeHarness(route: "reading" | "consultation", env: Record<string, string | undefined> = { GEMINI_API_KEY: "synthetic-unit-test-key" }) {
  const filename = fileURLToPath(new URL(`../app/api/${route}/route.ts`, import.meta.url));
  const requireActual = createRequire(filename);
  const calls: unknown[] = [];
  const module = { exports: {} as { POST: (request: Request) => Promise<Response> } };
  const code = ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  vm.runInNewContext(code, {
    module, exports: module.exports,
    require(name: string) {
      if (name === "@google/genai") return { GoogleGenAI: class {
        models = { generateContent: async (options: unknown) => { calls.push(options); return { text: "{}" }; } };
      } };
      return requireActual(name);
    },
    process: { env },
    console: { ...console, warn() {} }, Request, Response, AbortController, Error, TypeError, Date,
  }, { filename });
  const post = (body: unknown, headers: Record<string, string> = {}, raw?: string) => module.exports.POST(new Request(`http://localhost/api/${route}`, {
    method: "POST", headers: { "content-type": "application/json", ...headers }, body: raw ?? JSON.stringify(body),
  }));
  return { calls, post };
}

async function json(response: Response) { return await response.json() as { error?: { code?: string; message?: string; retryAfterSeconds?: number } }; }

for (const route of ["reading", "consultation"] as const) {
  const body = route === "reading" ? readingBody : consultationBody;

  test(`${route}: 다른 사이트의 브라우저 요청은 본문을 읽기 전에 403 forbidden_origin, Gemini 0회`, async () => {
    const api = routeHarness(route);
    for (const headers of [{ origin: "https://evil.example" }, { origin: "null" }, { "sec-fetch-site": "cross-site" }, { "sec-fetch-site": "same-site" }] as Record<string, string>[]) {
      const response = await api.post(body, headers);
      assert.equal(response.status, 403, JSON.stringify(headers));
      assert.equal(response.headers.get("cache-control"), "no-store");
      const data = await json(response);
      assert.equal(data.error?.code, "forbidden_origin");
    }
    // 본문이 망가져 있어도 출처 확인이 먼저다(본문을 읽지 않음).
    const broken = await api.post(null, { origin: "https://evil.example", "content-type": "text/plain" }, "{");
    assert.equal(broken.status, 403);
    assert.equal(api.calls.length, 0);
    // 다른 사이트 요청은 요청 수에도 들어가지 않는다.
    const limit = route === "reading" ? 6 : 3;
    for (let i = 0; i < limit; i++) assert.notEqual((await api.post(body)).status, 429, `${i + 1}번째 정상 요청`);
  });

  test(`${route}: 같은 사이트(자기 주소 Origin·same-origin)와 헤더 없는 스크립트 요청은 통과한다`, async () => {
    const api = routeHarness(route);
    const cases: Record<string, string>[] = [{ origin: "http://localhost" }, { "sec-fetch-site": "same-origin" }, { "sec-fetch-site": "none" }, {}];
    for (const [index, headers] of cases.entries()) {
      const response = await api.post(body, { ...headers, "x-forwarded-for": `203.0.113.${index + 1}` });
      assert.notEqual(response.status, 403, JSON.stringify(headers));
      assert.notEqual(response.status, 429);
    }
    assert.ok(api.calls.length >= 4, "보호 장치를 통과한 요청은 Gemini까지 간다");
  });
}

test("reading: IP당 6건까지 Gemini를 부르고 7번째는 Gemini 0회·429 too_many_requests·Retry-After", async () => {
  const api = routeHarness("reading");
  for (let i = 0; i < 6; i++) {
    const response = await api.post(readingBody, { "x-forwarded-for": "198.51.100.7" });
    assert.equal(response.status, 502, "가짜 Gemini가 빈 요약을 돌려 invalid_response");
    assert.equal(api.calls.length, i + 1);
  }
  const blocked = await api.post(readingBody, { "x-forwarded-for": "198.51.100.7" });
  assert.equal(blocked.status, 429);
  assert.equal(api.calls.length, 6, "7번째는 Gemini를 부르지 않는다");
  const retryAfter = Number(blocked.headers.get("retry-after"));
  assert.ok(retryAfter > 595 && retryAfter <= 600, String(retryAfter));
  assert.equal(blocked.headers.get("cache-control"), "no-store");
  const data = await json(blocked);
  assert.equal(data.error?.code, "too_many_requests");
  assert.equal(data.error?.retryAfterSeconds, retryAfter);
  assert.equal(data.error?.message, "요청이 많아 잠시 쉬어 갑니다. 10분 뒤에 다시 시도해 주세요.");
  // 다른 IP는 따로 센다. 요약·상세 단계는 같은 한도를 쓴다.
  assert.equal((await api.post({ ...readingBody, stage: "full" }, { "x-forwarded-for": "198.51.100.8" })).status, 502);
  assert.equal((await api.post({ ...readingBody, stage: "full" }, { "x-forwarded-for": "198.51.100.7" })).status, 429);
});

test("reading: 입력 형식 오류는 세지 않고 한도에 걸린 뒤에도 원래 400을 돌려준다", async () => {
  const api = routeHarness("reading");
  const bad: [unknown, string | undefined, string][] = [
    [null, "{", "invalid_json"],
    [null, "x".repeat(24_001), "request_too_large"],
    [{ ...readingBody, consent: false }, undefined, "consent_required"],
    [{ ...readingBody, yunGender: 2 }, undefined, "invalid_input"],
    [{ ...readingBody, input: "1994-12-01" }, undefined, "invalid_input"],
    [{ ...readingBody, stage: "draft" }, undefined, "invalid_input"],
    [{ ...readingBody, fortuneYear: 1989 }, undefined, "invalid_input"],
  ];
  for (let round = 0; round < 3; round++) {
    for (const [value, raw, code] of bad) {
      const response = await api.post(value, {}, raw);
      assert.ok([400, 413].includes(response.status), code);
      assert.equal((await json(response)).error?.code, code);
    }
  }
  for (let i = 0; i < 6; i++) assert.equal((await api.post(readingBody)).status, 502, `오류 21건 뒤에도 ${i + 1}번째 정상 요청은 통과`);
  assert.equal((await api.post(readingBody)).status, 429);
  assert.equal((await json(await api.post(null, {}, "{"))).error?.code, "invalid_json", "한도에 걸린 뒤에도 입력 오류는 400");
  assert.equal(api.calls.length, 6);
});

test("reading: API 키가 없어도 요청 수 제한은 먼저 적용된다(6번 503 뒤 429)", async () => {
  const api = routeHarness("reading", {});
  for (let i = 0; i < 6; i++) {
    const response = await api.post(readingBody);
    assert.equal(response.status, 503);
    assert.equal((await json(response)).error?.code, "missing_api_key");
  }
  const blocked = await api.post(readingBody);
  assert.equal(blocked.status, 429);
  assert.equal((await json(blocked)).error?.code, "too_many_requests");
  assert.equal(api.calls.length, 0);
});

test("reading: 환경변수로 한도·창을 바꾸면 IP별·전체 한도에 반영된다", async () => {
  const api = routeHarness("reading", { GEMINI_API_KEY: "k", READING_RATE_LIMIT_PER_IP: "2", READING_RATE_LIMIT_GLOBAL: "3", AI_RATE_LIMIT_WINDOW_SECONDS: "120" });
  const ip = (n: number) => ({ "x-forwarded-for": `192.0.2.${n}` });
  assert.equal((await api.post(readingBody, ip(1))).status, 502);
  assert.equal((await api.post(readingBody, ip(1))).status, 502);
  const perIp = await api.post(readingBody, ip(1));
  assert.equal(perIp.status, 429);
  assert.ok(Number(perIp.headers.get("retry-after")) <= 120);
  assert.equal((await api.post(readingBody, ip(2))).status, 502);
  assert.equal((await api.post(readingBody, ip(3))).status, 429, "전체 한도 3");
  assert.equal(api.calls.length, 3);
});

test("consultation: IP당 3건 뒤 4번째는 Gemini 0회·429, 기존 응답 형식(code 없음)은 그대로", async () => {
  const api = routeHarness("consultation");
  for (let i = 0; i < 3; i++) {
    const response = await api.post(consultationBody);
    assert.equal(response.status, 502, "가짜 Gemini 응답이 검증을 통과하지 못함(기존 동작)");
    const data = await json(response);
    assert.deepEqual(Object.keys(data.error ?? {}), ["message"], "기존 오류 형식 {error:{message}}");
    assert.equal(api.calls.length, (i + 1) * 2, "기존처럼 한 요청에 최대 2번 호출");
  }
  const blocked = await api.post(consultationBody);
  assert.equal(blocked.status, 429);
  assert.equal(api.calls.length, 6);
  const data = await json(blocked);
  assert.equal(data.error?.code, "too_many_requests");
  assert.ok(Number(blocked.headers.get("retry-after")) > 0);
  // 기존 입력 오류 형식도 그대로이며 세지 않는다.
  const fresh = routeHarness("consultation", {});
  for (let i = 0; i < 5; i++) {
    const invalid = await fresh.post({ ...consultationBody, chapterId: "unknown" });
    assert.equal(invalid.status, 400);
    assert.deepEqual(await invalid.json(), { error: { message: "상담 주제·계산 기준·연도를 확인해 주세요." } });
    const noPlace = await fresh.post({ ...consultationBody, input: { ...input, birthplace: undefined } });
    assert.equal(noPlace.status, 400, "출생지 없음은 세기 전에 400");
  }
  for (let i = 0; i < 3; i++) {
    const response = await fresh.post(consultationBody);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: { message: "Gemini API 키가 설정되지 않았습니다. 서버 설정을 확인해 주세요." } });
  }
  assert.equal((await fresh.post(consultationBody)).status, 429);
});

test("라우트 모듈마다 제한기가 따로 만들어진다(다시 불러오면 초기화)", async () => {
  const first = routeHarness("reading", {});
  for (let i = 0; i < 6; i++) await first.post(readingBody);
  assert.equal((await first.post(readingBody)).status, 429);
  const second = routeHarness("reading", {});
  assert.equal((await second.post(readingBody)).status, 503);
  const consultation = routeHarness("consultation", {});
  assert.equal((await consultation.post(consultationBody)).status, 503, "reading 한도는 consultation에 영향 없음");
});
