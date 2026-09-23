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
function formHarness() {
  const filename = fileURLToPath(new URL("../app/saju-form.tsx", import.meta.url));
  const requireActual = createRequire(filename);
  const slots: unknown[] = [];
  let cursor = 0, writes = 0;
  const requests: { url: string; body: Record<string, unknown> }[] = [];
  let respond: (response: unknown) => void = () => { throw new Error("No pending request"); };
  const hooks = {
    useState(initial: unknown) { const index = cursor++; if (!(index in slots)) slots[index] = initial; return [slots[index], (next: unknown) => { slots[index] = typeof next === "function" ? next(slots[index]) : next; }]; },
    useRef(initial: unknown) { const index = cursor++; if (!(index in slots)) slots[index] = { current: initial }; return slots[index]; },
    useMemo(calculate: () => unknown) { return calculate(); },
    useEffect() {},
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
      if (name === "../lib/saju/persistence") return { readSavedSajuResult: () => null, clearSavedSajuResult: () => true, writeSavedSajuResult: () => { writes++; return true; } };
      return requireActual(name);
    },
    fetch: (url: string, options: { body: string }) => { requests.push({ url, body: JSON.parse(options.body) }); return new Promise(resolve => { respond = resolve; }); },
    console, Date, FormData, AbortController,
  }, { filename });
  let tree: Node;
  const render = () => { cursor = 0; tree = module.exports.default(); return tree; };
  render();
  return {
    render,
    account: () => nodes(tree).find(node => node.type === accountType)!.props,
    get writes() { return writes; },
    get requests() { return requests; },
    async startReading() {
      nodes(tree).find(node => node.props.id === "gemini-consent")!.props.onChange({ target: { checked: true } });
      render();
      const request = nodes(tree).find(node => node.type === "button" && String(node.props.children).includes("해석 만들기"))!.props.onClick();
      render();
      return { request };
    },
    respond(body: unknown, ok = true) { respond({ ok, json: async () => body }); },
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

test("Gemini 동의만으로 긴 상담이나 종합 해석을 자동 요청하지 않는다", () => {
  const form = formHarness(); form.account().onLoad(payload()); form.render();
  assert.equal(form.requests.length, 0);
  nodes(form.render()).find(node => node.props.id === "gemini-consent")!.props.onChange({ target: { checked: true } });
  form.render(); form.render();
  assert.equal(form.requests.length, 0);
  assert.ok(!nodes(form.render()).some(node => node.type === "button" && String(node.props.children).includes("8장 상담")));
});

test("명시적으로 종합 해석 만들기를 누른 경우에만 짧은 Gemini 해석을 요청한다", async () => {
  const form = formHarness(); form.account().onLoad(payload()); form.render();
  const { request } = await form.startReading();
  assert.equal(form.requests.length, 1);
  assert.equal(form.requests[0].url, "/api/reading");
  assert.ok(!form.requests.some(item => item.url === "/api/consultation"));
  form.respond({ error: { message: "가상 오류" } }, false);
  await request; form.render();
});

test("계정에서 연 결과의 AI 성공·실패는 브라우저 저장본을 덮어쓰지 않는다", async () => {
  for (const success of [true, false]) {
    const form = formHarness(); const value = payload();
    form.account().onLoad(value); form.render();
    const { request } = await form.startReading();
    form.respond(success ? readingResponse(value) : { error: { message: "가상 오류" } }, success);
    await request; form.render();
    assert.equal(form.writes, 0);
    assert.equal(form.account().current.result.input.date, value.result.input.date);
    assert.equal(form.account().busy, false);
  }
});

test("계정 변경 후 늦게 완료한 AI 응답이 이전 개인 결과를 되살리지 않는다", async () => {
  const form = formHarness(); const a = payload(); const b = payload("2001-03-05");
  form.account().onLoad(a); form.render();
  const { request } = await form.startReading();
  form.account().onClearCloud(); form.render();
  form.account().onLoad(b); form.render();
  form.respond(readingResponse(a)); await request; form.render();
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
