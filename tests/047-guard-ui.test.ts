import test from "node:test";
import assert from "node:assert/strict";
import type { Birthplace } from "../lib/saju/birth-moment";
import { sajuFormHarness, textOf } from "./helpers/saju-form-harness";

// 실제 app/saju-form.tsx에서 /api/reading이 보호 장치(403·429)로 막혔을 때의 화면 흐름 (Spec 047).
// 응답은 하네스가 가짜로 돌려주며 실제 서버·Gemini는 부르지 않는다.

const seoul: Birthplace = { countryCode: "KR", countryName: "대한민국", city: "서울", province: "서울특별시", timezone: "Asia/Seoul", longitude: 126.978 };
const WAIT = (text: string) => `요청이 많아 잠시 쉬어 갑니다. ${text} 뒤에 다시 시도해 주세요.`;
const FORBIDDEN = "이 화면에서 보낸 요청으로 확인되지 않아 처리하지 않았습니다. 사주 서비스 주소에서 페이지를 새로 고친 뒤 다시 시도해 주세요.";

function response(status: number, body: unknown, headers: Record<string, string> = {}) {
  const lower = Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
  return {
    ok: status >= 200 && status < 300, status,
    headers: { get: (name: string) => lower[name.toLowerCase()] ?? null },
    json: async () => { if (body instanceof Error) throw body; return body; },
  };
}
const notJson = () => new SyntaxError("Unexpected token '<', \"<html>\" is not valid JSON");

async function submitted() {
  const form = sajuFormHarness({ cities: [seoul] });
  await form.searchCity("서울");
  form.all((node) => node.type === "button" && textOf(node).startsWith("서울"))[0].props.onClick(); form.render();
  form.find((node) => node.type === "form")!.props.onSubmit({ preventDefault() {}, currentTarget: { values: { date: "2000-02-04", time: "08:37", yunGender: "0" } } });
  form.render();
  const readingRequests = () => form.requests.filter((request) => request.url === "/api/reading");
  assert.equal(readingRequests().length, 1);
  assert.equal(readingRequests()[0].body?.stage, "summary");
  return { form, readingRequests };
}

function errorBox(form: ReturnType<typeof sajuFormHarness>) {
  const box = form.find((node) => node.props.className === "reading-generation-error");
  return box ? { role: box.props.role, text: textOf(box), retry: form.find((node) => node.type === "button" && node.props.children === "Gemini 해석 다시 시도") } : null;
}

function assertNoFakeReading(form: ReturnType<typeof sajuFormHarness>) {
  assert.equal(form.account().current.result.reading, null, "가짜 풀이를 저장하지 않는다");
  assert.equal(form.find((node) => node.props["aria-label"] === "먼저 보는 핵심 풀이"), undefined, "가짜 요약을 보여 주지 않는다");
  assert.equal(form.find((node) => node.props.id === "reading-title"), undefined);
  assert.ok(form.find((node) => node.props.id === "result-title"), "계산된 사주표는 그대로 보인다");
}

test("요약이 요청 수 제한(429 too_many_requests)에 막히면 상세 요청 없이 N분 안내와 다시 시도 버튼을 보여 준다", async () => {
  const { form, readingRequests } = await submitted();
  await form.respondNext(response(429, { error: { code: "too_many_requests", message: "서버 문구", retryAfterSeconds: 61 } }, { "Retry-After": "61" }));
  assert.equal(readingRequests().length, 1, "상세 요청을 보내지 않는다");
  assert.equal(form.pendingCount, 0);
  const box = errorBox(form);
  assert.ok(box, "오류 안내가 보여야 합니다");
  assert.equal(box.role, "alert");
  assert.ok(box.text.startsWith(WAIT("2분")), box.text);
  assert.ok(box.retry, "다시 시도 버튼");
  assert.equal(box.retry.props.disabled, false, "생성 중이 아니므로 누를 수 있다");
  assertNoFakeReading(form);
  assert.equal(form.writes.at(-1)?.reading, null, "브라우저 저장본에도 풀이 없음");
  // 다시 시도하면 요약부터 다시 요청한다.
  box.retry.props.onClick(); form.render();
  assert.equal(readingRequests().length, 2);
  assert.equal(readingRequests()[1].body?.stage, "summary");
  await form.respondAll({ error: { message: "정리" } }, false);
});

test("요약이 같은 사이트 확인(403 forbidden_origin)에 막히면 상세 요청 없이 새로 고침 안내를 보여 준다", async () => {
  const { form, readingRequests } = await submitted();
  await form.respondNext(response(403, { error: { code: "forbidden_origin", message: "다른 사이트에서 보낸 요청은 처리하지 않습니다." } }));
  assert.equal(readingRequests().length, 1);
  assert.ok(errorBox(form)?.text.startsWith(FORBIDDEN));
  assert.ok(errorBox(form)?.retry);
  assertNoFakeReading(form);
});

test("JSON이 아닌 요약 429·403(플랫폼 차단)도 상세 요청 없이 같은 안내를 쓴다", async () => {
  for (const [res, expected] of [
    [response(429, notJson(), { "Retry-After": "30" }), WAIT("1분")],
    [response(429, notJson()), WAIT("잠시")],
    [response(403, notJson()), FORBIDDEN],
  ] as const) {
    const { form, readingRequests } = await submitted();
    await form.respondNext(res);
    assert.equal(readingRequests().length, 1);
    assert.ok(errorBox(form)?.text.startsWith(expected), errorBox(form)?.text ?? "안내 없음");
    assertNoFakeReading(form);
  }
});

test("Gemini 쪽 요약 실패(429 rate_limited, 502, 503, 네트워크 오류)는 기존처럼 상세 요청을 이어 간다", async () => {
  const cases: [string, (form: ReturnType<typeof sajuFormHarness>) => Promise<void>][] = [
    ["rate_limited", (form) => form.respondNext(response(429, { error: { code: "rate_limited", message: "Gemini 요청이 잠시 몰렸습니다. 조금 뒤 다시 시도해 주세요." } }))],
    ["invalid_response", (form) => form.respondNext(response(502, { error: { code: "invalid_response", message: "핵심 풀이를 확인하지 못했습니다." } }))],
    ["missing_api_key", (form) => form.respondNext(response(503, { error: { code: "missing_api_key", message: "키 없음" } }))],
    ["invalid_api_key(403 아님, 503)", (form) => form.respondNext(response(503, { error: { code: "invalid_api_key", message: "키 확인" } }))],
    ["network", (form) => form.rejectNext(new TypeError("Failed to fetch"))],
  ];
  for (const [name, fail] of cases) {
    const { form, readingRequests } = await submitted();
    await fail(form);
    assert.equal(readingRequests().length, 2, `${name}: 상세 요청을 보낸다`);
    assert.equal(readingRequests()[1].body?.stage, "full");
    await form.respondNext(response(429, { error: { code: "rate_limited", message: "Gemini 요청이 잠시 몰렸습니다. 조금 뒤 다시 시도해 주세요." } }));
    assert.ok(errorBox(form)?.text.startsWith("Gemini 요청이 잠시 몰렸습니다."), `${name}: 상세의 Gemini 429는 서버 안내 그대로`);
    assertNoFakeReading(form);
  }
});

test("상세 요청이 보호 장치에 막히면 N분·새로 고침 안내를 보여 주고 서버 문구·기본 문구보다 우선한다", async () => {
  for (const [res, expected] of [
    [response(429, { error: { code: "too_many_requests", message: "서버 문구", retryAfterSeconds: 600 } }, { "Retry-After": "600" }), WAIT("10분")],
    [response(429, { error: { code: "too_many_requests", message: "서버 문구" } }, { "Retry-After": "125" }), WAIT("3분")],
    [response(429, notJson(), { "Retry-After": "59" }), WAIT("1분")],
    [response(429, notJson()), WAIT("잠시")],
    [response(403, { error: { code: "forbidden_origin", message: "서버 문구" } }), FORBIDDEN],
    [response(403, notJson()), FORBIDDEN],
    [response(502, notJson()), "Gemini 해석을 만들지 못했습니다. 다시 시도해 주세요."],
    [response(503, { error: { code: "missing_api_key", message: "Gemini API 키가 설정되지 않았습니다. 서버 설정을 확인해 주세요." } }), "Gemini API 키가 설정되지 않았습니다. 서버 설정을 확인해 주세요."],
  ] as const) {
    const { form, readingRequests } = await submitted();
    await form.respondNext(response(502, { error: { code: "invalid_response", message: "요약 실패" } }));
    assert.equal(readingRequests().length, 2);
    await form.respondNext(res);
    const box = errorBox(form);
    assert.ok(box?.text.startsWith(expected), `${res.status}: ${box?.text}`);
    assert.ok(box?.retry);
    assertNoFakeReading(form);
  }
});

test("상태·헤더가 없는 예전 mock 응답도 그대로 동작한다", async () => {
  const { form, readingRequests } = await submitted();
  await form.respondNext({ ok: false, json: async () => ({ error: { message: "요약 가상 오류" } }) });
  assert.equal(readingRequests().length, 2, "상태가 없으면 보호 장치로 보지 않고 상세를 진행");
  await form.respondNext({ ok: false, json: async () => ({ error: { message: "가상 오류" } }) });
  assert.ok(errorBox(form)?.text.startsWith("가상 오류"));
  // 코드가 too_many_requests이면 상태가 없어도 안내로 바꾼다.
  const second = await submitted();
  await second.form.respondNext({ ok: false, json: async () => ({ error: { code: "too_many_requests", retryAfterSeconds: 300 } }) });
  assert.equal(second.readingRequests().length, 1);
  assert.ok(errorBox(second.form)?.text.startsWith(WAIT("5분")));
});

test("성공한 요약 응답이 JSON이 아니어도 기존처럼 상세 요청을 이어 간다", async () => {
  const { form, readingRequests } = await submitted();
  await form.respondNext(response(200, notJson()));
  assert.equal(readingRequests().length, 2);
  assert.equal(errorBox(form), null, "아직 오류 안내 없음");
  await form.respondAll({ error: { message: "정리" } }, false);
});
