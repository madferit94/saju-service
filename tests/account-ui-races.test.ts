import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";
import { calculate, type SajuInput } from "../lib/saju/chart";
import { calculateDaewoon } from "../lib/saju/daewoon";
import { calculateBenefactors } from "../lib/saju/benefactors";
import type { CloudPayload } from "../lib/account/results";

type Node = { type: unknown; props: Record<string, any> };
const accountType = Symbol("AccountPanel");
function nodes(root: unknown): Node[] {
  if (Array.isArray(root)) return root.flatMap(nodes);
  if (!root || typeof root !== "object" || !("props" in root)) return [];
  const node = root as Node;
  return [node, ...nodes(node.props.children)];
}

// Run the real component with queued renders and controlled network completion.
// No browser, OAuth account, external network, or real localStorage is touched.
function formHarness(savedResult: CloudPayload["result"] | null = null) {
  const filename = fileURLToPath(new URL("../app/saju-form.tsx", import.meta.url));
  const requireActual = createRequire(filename);
  const slots: unknown[] = [];
  const effects: (() => void | (() => void))[] = [];
  let cursor = 0, writes = 0;
  const requests: { url: string; body: Record<string, unknown>; signal?: AbortSignal }[] = [];
  let respond: (response: unknown) => void = () => { throw new Error("No pending request"); };
  const birthplace = { countryCode: "KR", countryName: "대한민국", city: "서울", province: "서울특별시", timezone: "Asia/Seoul", longitude: 126.978 };
  const hooks = {
    useState(initial: unknown) { const index = cursor++; if (!(index in slots)) slots[index] = initial; return [slots[index], (next: unknown) => { slots[index] = typeof next === "function" ? next(slots[index]) : next; }]; },
    useRef(initial: unknown) { const index = cursor++; if (!(index in slots)) slots[index] = { current: initial }; return slots[index]; },
    useMemo(calculate: () => unknown) { return calculate(); },
    useEffect(effect: () => void | (() => void)) { effects.push(effect); },
  };
  const jsx = (type: unknown, props: Record<string, unknown>) => ({ type, props });
  const module = { exports: {} as { default: () => Node } };
  const code = ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  vm.runInNewContext(code, {
    module, exports: module.exports,
    require(name: string) {
      if (name === "react") return hooks;
      if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
      if (name === "./account-panel") return { default: accountType, __esModule: true };
      if (name === "./fortune-panel") return { default: Symbol("FortunePanel"), __esModule: true };
      if (["./deep-analysis-panel", "./consultation-panel", "./manse-panel", "./flow-overview", "./life-seasons-panel"].includes(name)) return { default: Symbol(name), __esModule: true };
      if (name === "../lib/saju/persistence") return { readSavedSajuResult: () => savedResult, clearSavedSajuResult: () => true, writeSavedSajuResult: () => { writes++; return true; } };
      return requireActual(name);
    },
    fetch: (url: string, options: { body: string; signal?: AbortSignal }) => { requests.push({ url, body: JSON.parse(options.body), signal: options.signal }); return new Promise(resolve => { respond = resolve; }); },
    console, Date, URL, AbortController,
    FormData: class { constructor(private form: { values: Record<string, string> }) {} get(name: string) { return this.form.values[name] ?? null; } },
    window: { location: { href: "http://localhost:3000/?view=input" }, history: { pushState() {} }, scrollTo() {}, addEventListener() {}, removeEventListener() {} },
  }, { filename });
  let tree: Node;
  const render = () => { cursor = 0; tree = module.exports.default(); return tree; };
  render();
  return {
    render,
    account: () => nodes(tree).find(node => node.type === accountType)!.props,
    get writes() { return writes; },
    get requests() { return requests; },
    restoreSaved() { effects[1](); render(); },
    setCalendar(value: "solar" | "lunar") { nodes(tree).find(node => node.props.id === "calendar")!.props.onChange({ target: { value } }); render(); },
    setLeap(value: "regular" | "leap" | "unknown") { nodes(tree).find(node => node.props.id === "leapMonth")!.props.onChange({ target: { value } }); render(); },
    errors: () => nodes(tree).filter(node => node.props.className === "error").map(node => node.props.children),
    submit(values: Record<string, string> = { date: "2000-02-04", time: "08:37", yunGender: "0" }) {
      // The city is selected from the location picker before submitting.
      slots[16] = birthplace;
      render();
      const form = nodes(tree).find(node => node.type === "form")!;
      const submitButtons = nodes(form).filter(node => node.type === "button" && node.props.type === "submit");
      assert.deepEqual(submitButtons.map(button => button.props.children), ["내 사주 보기"]);
      form.props.onSubmit({ preventDefault() {}, currentTarget: { values } });
      render();
    },
    choose(index: number) {
      const choices = nodes(tree).filter(node => node.type === "button" && String(node.props.children).includes("으로 전체 결과 보기"));
      assert.ok(choices.length > index);
      choices[index].props.onClick();
      render();
    },
    retry() {
      const request = nodes(tree).find(node => node.type === "button" && node.props.children === "Gemini 해석 다시 시도")!.props.onClick();
      render();
      return request;
    },
    startReadingOnCloud() {
      const request = nodes(tree).find(node => node.type === "button" && node.props.children === "선택한 연도로 Gemini 해석 만들기")!.props.onClick();
      render();
      return request;
    },
    respondOne(body: unknown, ok = true) { respond({ ok, json: async () => body }); },
    async respond(body: unknown, ok = true) {
      if (requests.at(-1)?.body.stage === "summary") {
        respond({ ok: false, json: async () => ({ error: { message: "summary fixture skipped" } }) });
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      respond({ ok, json: async () => body });
    },
    text() { return JSON.stringify(tree); },
    changeYear(year: number) {
      const nav = nodes(tree).find(n => typeof n.type === "function" && n.props.onNavigate);
      nav!.props.onNavigate("flow"); render();
      nodes(tree).find(n => n.props.id === "fortune-year")!.props.onChange({ target: { value: String(year) } }); render();
    },
  };
}

function payload(date = "2000-02-04"): CloudPayload {
  const input: SajuInput = { date, time: "08:37", calendar: "solar", topic: "general" };
  const chart = calculate(input);
  return { version: 1, fortuneYear: 2026, result: { version: 1, savedAt: "2026-09-23T05:00:00.000Z", input, yunGender: 0, chart, timeline: calculateDaewoon(input, 0, 2026), benefactors: calculateBenefactors(chart), reading: null } };
}
function readingResponse(p: CloudPayload) {
  const text = "개인의 원국과 대운을 종합해 현실적인 선택의 기준을 설명합니다.";
  return { ...p.result, reading: {
    readingVersion: 2, fortuneYear: 2026, synthesis: text, lifetime: text, annual: text,
    monthly: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, reading: text })),
    overview: text, elements: text, benefactors: text, career: text, relationships: text, money: text, caution: text,
    periodReadings: p.result.timeline.periods.map(period => ({ index: period.index, theme: text, strengths: text, cautions: text, advice: text, reflection: text })),
  } };
}

test("계정 결과를 연 직후 렌더 전에 계정이 바뀌어도 이전 결과를 제거한다", () => {
  const form = formHarness();
  const callbacks = form.account();
  callbacks.onLoad(payload());
  callbacks.onClearCloud();
  form.render();
  assert.equal(form.account().current, null);
  assert.equal(form.writes, 0);
});

test("저장된 계정 결과를 여는 것만으로 Gemini를 자동 요청하지 않는다", () => {
  const form = formHarness(); form.account().onLoad(payload()); form.render();
  assert.equal(form.requests.length, 0);
  form.render(); form.render();
  assert.equal(form.requests.length, 0);
  assert.ok(!nodes(form.render()).some(node => node.type === "button" && String(node.props.children).includes("8장 상담")));
});

test("내 사주 보기 한 번으로 기본 결과를 먼저 열고 Gemini 종합 해석을 한 번 요청한다", async () => {
  const form = formHarness();
  form.submit();
  assert.deepEqual(form.errors(), []);
  assert.ok(form.account().current.result.chart);
  assert.equal(form.account().current.result.reading, null);
  assert.ok(form.writes > 0);
  assert.equal(form.requests.length, 1);
  assert.equal(form.requests[0].url, "/api/reading");
  assert.equal(form.requests[0].body.consent, true);
  assert.ok(!form.requests.some(item => item.url === "/api/consultation"));
  await form.respond({ error: { message: "가상 오류" } }, false);
  await new Promise(resolve => setTimeout(resolve, 0)); form.render();
});

test("윤달 후보가 둘이면 선택 전에는 호출하지 않고 고른 후보만 한 번 전송한다", async () => {
  const form = formHarness();
  form.setCalendar("lunar");
  form.submit({ lunarYear: "2020", lunarMonth: "4", lunarDay: "1", time: "12:00", yunGender: "0" });
  assert.deepEqual(form.errors(), []);
  assert.equal(form.requests.length, 0);
  form.choose(1);
  assert.equal(form.requests.length, 1);
  assert.equal(form.requests[0].body.consent, true);
  assert.equal((form.requests[0].body.input as SajuInput).leapMonth, "leap");
  await form.respond({ error: { message: "가상 오류" } }, false);
  await new Promise(resolve => setTimeout(resolve, 0));
});

test("명시적으로 윤달을 선택해 제출하면 윤달 결과로 한 번만 생성한다", async () => {
  const form = formHarness();
  form.setCalendar("lunar");
  form.setLeap("leap");
  form.submit({ lunarYear: "2020", lunarMonth: "4", lunarDay: "1", time: "12:00", yunGender: "0" });
  assert.deepEqual(form.errors(), []);
  assert.equal(form.requests.length, 1);
  assert.equal(form.requests[0].body.consent, true);
  assert.equal((form.requests[0].body.input as SajuInput).leapMonth, "leap");
  await form.respond({ error: { message: "가상 오류" } }, false);
  await new Promise(resolve => setTimeout(resolve, 0));
});

test("저장본 복원과 화면 렌더는 Gemini를 호출하지 않는다", () => {
  const form = formHarness(payload().result);
  form.restoreSaved();
  form.render(); form.render();
  assert.equal(form.requests.length, 0);
  assert.equal(form.writes, 0);
  assert.equal(form.account().current.result.input.date, payload().result.input.date);
});

test("Gemini 실패 후 로컬 결과를 유지하고 재시도 때 한 번 더 요청한다", async () => {
  const form = formHarness();
  form.submit();
  assert.equal(form.requests.length, 1);
  await form.respond({ error: { message: "가상 오류" } }, false);
  await new Promise(resolve => setTimeout(resolve, 0)); form.render();
  assert.ok(form.account().current.result.chart);
  assert.equal(form.account().current.result.reading, null);
  form.retry();
  assert.equal(form.requests.length, 3);
  assert.equal(form.requests[2].body.consent, true);
  await form.respond({ error: { message: "가상 오류" } }, false);
  await new Promise(resolve => setTimeout(resolve, 0));
});

test("계정에서 연 결과의 AI 성공·실패는 브라우저 저장본을 덮어쓰지 않는다", async () => {
  for (const success of [true, false]) {
    const form = formHarness(); const value = payload();
    value.result.reading = { readingVersion: 2, fortuneYear: 2025 } as CloudPayload["result"]["reading"];
    form.account().onLoad(value); form.render();
    const request = form.startReadingOnCloud();
    await form.respond(success ? readingResponse(value) : { error: { message: "가상 오류" } }, success);
    await request; await new Promise(resolve => setTimeout(resolve, 0)); form.render();
    assert.equal(form.writes, 0);
    assert.equal(form.account().current.result.input.date, value.result.input.date);
    assert.equal(form.account().busy, false);
  }
});

test("계정 변경 후 늦게 완료한 AI 응답이 이전 개인 결과를 되살리지 않는다", async () => {
  const form = formHarness(); const a = payload(); const b = payload("2001-03-05");
  a.result.reading = { readingVersion: 2, fortuneYear: 2025 } as CloudPayload["result"]["reading"];
  form.account().onLoad(a); form.render();
  const request = form.startReadingOnCloud();
  form.account().onClearCloud(); form.render();
  form.account().onLoad(b); form.render();
  await form.respond(readingResponse(a)); await request; form.render();
  assert.equal(form.account().current.result.input.date, b.result.input.date);
  assert.equal(form.account().current.result.reading, null);
  assert.equal(form.writes, 0);
});

test("기존에 저장된 긴 상담 데이터는 화면에서 숨겨도 계정 결과에 보존한다", () => {
  const form = formHarness(), value = payload();
  value.result.consultation = { version: 1, analysisVersion: 1, readingStyleVersion: 3, year: 2026, chapters: [] };
  form.account().onLoad(value); form.render();
  assert.deepEqual(form.account().current.result.consultation, value.result.consultation);
  assert.equal(form.requests.length, 0);
  assert.ok(!nodes(form.render()).some(node => typeof node.type === "symbol" && node.type.description === "./consultation-panel"));
});

const earlySummary = { synthesis: "익힌 것을 작은 결과물로 만들어 확인하는 흐름입니다.", current: "맡은 일과 준비할 시간을 함께 정하면 방향을 잡기 좋습니다.", action: "지금 할 활동 하나와 도움받을 사람을 함께 정해 보세요.", evidenceIds: ["strength_ratio", "annual_flow_balance"] };
const flush = () => new Promise(resolve => setTimeout(resolve, 0));

test("핵심 요약을 전체 완료 전에 표시하며 전체 실패와 재시도 때 성공한 요약을 유지한다", async () => {
  const form = formHarness(); form.submit();
  assert.equal(form.requests[0].body.stage, "summary");
  form.respondOne({ summary: earlySummary }); await flush(); form.render();
  assert.match(form.text(), /먼저 보는 핵심 풀이/);
  assert.ok(form.text().includes(earlySummary.synthesis));
  assert.equal(form.account().current.result.reading, null, "요약은 전체 저장본이 아니다");
  assert.equal(form.requests[1].body.stage, "full");
  form.respondOne({ error: { message: "상세 실패" } }, false); await flush(); form.render();
  assert.ok(form.text().includes(earlySummary.synthesis));
  const retry = form.retry();
  assert.equal(form.requests.length, 3);
  assert.equal(form.requests[2].body.stage, "full", "성공한 summary를 다시 요청하면 안 된다");
  form.respondOne(readingResponse(form.account().current)); await retry; await flush(); form.render();
  assert.ok(form.account().current.result.reading);
});

test("요약 실패 후에도 전체 성공을 표시하고 같은 입력은 세션의 성공 응답을 재사용한다", async () => {
  const form = formHarness(); form.submit();
  form.respondOne({ error: { message: "요약 실패" } }, false); await flush();
  assert.equal(form.requests[1].body.stage, "full");
  form.respondOne(readingResponse(form.account().current)); await flush(); form.render();
  assert.ok(form.account().current.result.reading);
  form.submit(); await flush(); form.render();
  assert.equal(form.requests.length, 2, "이미 성공한 전체 응답은 다시 생성하지 않는다");
  assert.ok(form.account().current.result.reading);
});

test("새 출생 입력과 저장본 열기는 요약 요청을 취소하고 늦은 요약을 버린다", async () => {
  for (const replace of ["new-input", "saved"] as const) {
    const form = formHarness(); form.submit();
    const signal = form.requests[0].signal!;
    if (replace === "new-input") {
      // Start a new invalid input; it must still invalidate the old generation.
      form.submit({ date: "", time: "08:37", yunGender: "0" });
    } else {
      form.account().onLoad(payload("2001-03-05")); form.render();
    }
    assert.equal(signal.aborted, true);
    form.respondOne({ summary: earlySummary }); await flush(); form.render();
    assert.ok(!form.text().includes(earlySummary.synthesis));
    assert.equal(form.requests.length, 1, "취소된 요약 뒤에 전체 요청을 시작하지 않는다");
  }
});

test("로그아웃은 생성 취소와 세션 요약 삭제를 함께 수행한다", async () => {
  const form = formHarness(); form.submit();
  form.respondOne({ summary: earlySummary }); await flush(); form.render();
  const fullSignal = form.requests[1].signal!;
  form.account().onClearCloud(); form.render();
  assert.equal(fullSignal.aborted, true);
  form.respondOne(readingResponse(payload())); await flush(); form.render();
  assert.ok(!form.text().includes(earlySummary.synthesis));
  form.submit();
  assert.equal(form.requests.at(-1)!.body.stage, "summary", "다시 제출하면 이전 세션 요약이 없어야 한다");
  await form.respond({ error: { message: "정리" } }, false); await flush();
});

test("연도 변경은 생성 중 신호를 취소하고 늦은 이전 연도 응답을 표시하지 않는다", async () => {
  const form = formHarness(); form.submit();
  const signal = form.requests[0].signal!;
  form.changeYear(2027);
  assert.equal(signal.aborted, true);
  assert.equal(form.account().current.fortuneYear, 2027);
  form.respondOne({ summary: earlySummary }); await flush(); form.render();
  assert.equal(form.requests.length, 1);
  assert.ok(!form.text().includes(earlySummary.synthesis));
});
