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
import { CHAPTERS, type ConsultationChapter } from "../lib/saju/consultation";

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
  const responders: ((response: unknown) => void)[] = [];
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
    fetch: (url: string, options: { body: string }) => { requests.push({ url, body: JSON.parse(options.body) }); return new Promise(resolve => { respond = resolve; responders.push(resolve); }); },
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
      const request = nodes(tree).find(node => node.type === "button" && node.props.children === "나의 종합 해석 만들기")!.props.onClick();
      render();
      return { request };
    },
    respond(body: unknown, ok = true) { respond({ ok, json: async () => body }); },
    respondAt(index: number, body: unknown, ok = true) { responders[index]({ ok, json: async () => body }); },
    async startConsultation() {
      nodes(tree).find(node => node.props.id === "gemini-consent")!.props.onChange({ target: { checked: true } });
      render();
      const button = nodes(tree).find(node => node.type === "button" && ["쉬운 말로 8장 상담 시작하기", "쉬운 말로 8장 다시 작성하기", "남은 상담 이어서 작성하기"].includes(node.props.children))!;
      assert.ok(button && !button.props.disabled, "상담 작성 버튼이 활성화되어야 한다");
      const request = button.props.onClick();
      render();
      return { request };
    },
    pauseConsultation() { nodes(tree).find(node => node.type === "button" && node.props.children === "잠시 멈추기")!.props.onClick(); render(); },
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

function consultationChapter(index: number): ConsultationChapter {
  const def = CHAPTERS[index];
  return { id: def.id, title: def.title, summary: "다른 사람의 도움을 받을 때와 혼자 결정할 때의 차이를 살펴보고 자신에게 맞는 상황을 찾아보세요.", sections: Array.from({ length: 3 }, (_, i) => ({
    heading: `${i + 1}번째 상담 근거`, text: "도움을 받는다고 항상 일이 편해지지는 않습니다. 상대가 정한 기준을 따라야 하는 상황인지 확인해 보세요.\n\n" + `${i + 1}번째 절에서는 계절의 기운과 일간의 관계를 살피고 도움과 부담이 달라지는 조건을 실제 경험과 비교할 수 있도록 설명합니다. `.repeat(3) + "자신의 선택을 지지하면서 필요한 역할을 맡아주는 상황인지 확인해 보세요. 지원이 실제 결정에 어떤 차이를 만들었는지 비교하면 도움이 됩니다. ".repeat(2),
    evidenceIds: ["strength_season", "strength_ratio"],
    counterpoint: "반대 조건으로는 계절의 비중을 다르게 해석할 때 경계가 달라질 수 있다는 점을 확인해야 합니다.",
    example: "예를 들어 여러 사람이 함께 책임지는 상황이라면 자신의 권한이 어디까지인지 확인하는 장면을 생각해 볼 수 있습니다.",
    question: "도움을 받거나 역할을 나눌 때 실제로는 어떤 차이가 있었나요?",
    action: "이번 주에는 맡은 일과 결정 권한을 적고 부담이 반복되는 지점을 구체적인 사례로 비교해 보세요.",
  })) };
}
const turn = () => new Promise<void>(resolve => setImmediate(resolve));

test("계정에서 연 상담은 첫 장 뒤 오류가 나도 완성 장을 남기고 기기 저장 없이 다음 장부터 재개한다", async () => {
  const form = formHarness(); const value = payload();
  form.account().onLoad(value); form.render();
  const first = await form.startConsultation();
  assert.equal(form.requests.at(-1)!.body.chapterId, "natal");
  form.respond({ chapter: consultationChapter(0), readingStyleVersion: 3, analysisVersion: 1, year: 2026 });
  await turn(); form.render();
  assert.equal(form.requests.at(-1)!.body.chapterId, "strength");
  assert.equal(form.account().current.result.consultation.chapters.length, 1);
  form.respond({ error: { message: "가상 네트워크 오류" } }, false);
  await first.request; form.render();
  assert.equal(form.account().busy, false);
  assert.equal(form.writes, 0);
  const resumed = await form.startConsultation();
  assert.equal(form.requests.at(-1)!.body.chapterId, "strength");
  form.respond({ error: { message: "테스트 종료" } }, false);
  await resumed.request; form.render();
  assert.equal(form.account().current.result.consultation.chapters.length, 1);
  assert.equal(form.writes, 0);
});

test("상담 중 계정 전환 뒤 도착한 응답은 새 결과를 덮거나 다음 장 요청을 보내지 않는다", async () => {
  const form = formHarness(); const a = payload(); const b = payload("2001-03-05");
  form.account().onLoad(a); form.render();
  const { request } = await form.startConsultation();
  form.account().onClearCloud(); form.render();
  form.account().onLoad(b); form.render();
  form.respond({ chapter: consultationChapter(0), readingStyleVersion: 3, analysisVersion: 1, year: 2026 });
  await request; form.render();
  assert.equal(form.account().current.result.input.date, b.result.input.date);
  assert.equal(form.account().current.result.consultation, undefined);
  assert.equal(form.requests.length, 1);
  assert.equal(form.writes, 0);
});

test("상담 작성 중 멈추기를 누르면 늦은 응답을 버리고 남은 장을 요청하지 않는다", async () => {
  const form = formHarness(); form.account().onLoad(payload()); form.render();
  const { request } = await form.startConsultation();
  form.pauseConsultation();
  form.respond({ chapter: consultationChapter(0), readingStyleVersion: 3, analysisVersion: 1, year: 2026 });
  await request; form.render();
  assert.equal(form.account().busy, false);
  assert.equal(form.account().current.result.consultation, undefined);
  assert.equal(form.requests.length, 1);
  assert.equal(form.writes, 0);
});

function legacyPayload(): CloudPayload {
  const value = payload();
  value.result.consultation = { version: 1, analysisVersion: 1, year: 2026, chapters: CHAPTERS.map((_, index) => {
    const { summary: _summary, ...legacy } = consultationChapter(index);
    return { ...legacy, sections: legacy.sections.map(section => ({ ...section, text: section.text.slice(0, 180) })) };
  }) };
  return value;
}

function readableV2Payload(): CloudPayload {
  const value = payload();
  value.result.consultation = { version: 1, analysisVersion: 1, readingStyleVersion: 2, year: 2026, chapters: CHAPTERS.map((_, index) => consultationChapter(index)) };
  return value;
}

test("기존 쉬운 말 8장도 새 상담 첫 장 성공 전까지 그대로 남는다", async () => {
  const form = formHarness(), value = readableV2Payload();
  form.account().onLoad(value); form.render();
  const first = await form.startConsultation();
  assert.equal(form.requests.at(-1)!.body.chapterId, "natal");
  form.respond({ error: { message: "가상 재작성 실패" } }, false);
  await first.request; form.render();
  assert.deepEqual(form.account().current.result.consultation, value.result.consultation);
  const retry = await form.startConsultation();
  form.respond({ chapter: consultationChapter(0), readingStyleVersion: 3, analysisVersion: 1, year: 2026 });
  await turn(); form.render();
  const current = form.account().current.result.consultation;
  assert.equal(current.readingStyleVersion, 3);
  assert.equal(current.chapters.length, 1);
  assert.equal(current.chapters[0].id, "natal");
  form.respond({ error: { message: "테스트 종료" } }, false);
  await retry.request; form.render();
  assert.equal(form.writes, 0);
});

test("예전 8장 다시 작성이 첫 장부터 실패해도 기존 상담 8장을 보존한다", async () => {
  const form = formHarness(), value = legacyPayload();
  form.account().onLoad(value); form.render();
  const { request } = await form.startConsultation();
  assert.equal(form.requests.at(-1)!.body.chapterId, "natal");
  assert.equal(form.account().current.result.consultation.chapters.length, 8);
  form.respond({ error: { message: "가상 재작성 오류" } }, false);
  await request; form.render();
  assert.deepEqual(form.account().current.result.consultation, value.result.consultation);
  assert.equal(form.writes, 0);
});

test("다시 작성의 첫 성공 때 새 방식 장만 저장하고 예전 나머지 장을 섞지 않는다", async () => {
  const form = formHarness(); form.account().onLoad(legacyPayload()); form.render();
  const { request } = await form.startConsultation();
  form.respond({ chapter: consultationChapter(0), readingStyleVersion: 3, analysisVersion: 1, year: 2026 });
  await turn(); form.render();
  const current = form.account().current.result.consultation;
  assert.equal(current.readingStyleVersion, 3);
  assert.equal(current.chapters.length, 1);
  assert.equal(current.chapters[0].id, "natal");
  assert.ok(current.chapters[0].summary);
  assert.equal(form.requests.at(-1)!.body.chapterId, "strength");
  form.respond({ error: { message: "가상 중단" } }, false);
  await request; form.render();
  assert.equal(form.account().current.result.consultation.chapters.length, 1);
});

test("재작성 중 멈춘 첫 요청의 지연 응답은 이어서 시작한 새 요청의 결과를 덮지 않는다", async () => {
  const form = formHarness(), original = legacyPayload();
  form.account().onLoad(original); form.render();
  const first = await form.startConsultation();
  form.pauseConsultation();
  const second = await form.startConsultation();
  form.respondAt(0, { chapter: consultationChapter(0), readingStyleVersion: 3, analysisVersion: 1, year: 2026 });
  await first.request; form.render();
  assert.deepEqual(form.account().current.result.consultation, original.result.consultation);
  assert.equal(form.account().busy, true, "이전 요청의 finally가 현재 진행 상태를 해제하지 않는다");
  assert.equal(form.requests.length, 2);
  assert.equal(form.requests.at(-1)!.body.chapterId, "natal");
  form.respond({ chapter: { ...consultationChapter(0), summary: undefined }, readingStyleVersion: 3, analysisVersion: 1, year: 2026 });
  await second.request; form.render();
  assert.deepEqual(form.account().current.result.consultation, original.result.consultation);
  assert.equal(form.requests.length, 2);
});
