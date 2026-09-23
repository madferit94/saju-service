import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";
import { calculate, type SajuInput } from "../lib/saju/chart";
import { calculateDaewoon } from "../lib/saju/daewoon";
import { buildFortuneReport } from "../lib/saju/fortune";

type Node = { type: unknown; props: Record<string, any> };
function nodes(value: unknown): Node[] {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value || typeof value !== "object" || !("props" in value)) return [];
  const node = value as Node;
  return [node, ...nodes(node.props.children)];
}
function harness(initialYear = 2026) {
  const filename = fileURLToPath(new URL("../app/flow-overview.tsx", import.meta.url));
  const actual = createRequire(filename);
  const module = { exports: {} as { default: (props: any) => Node } };
  const input: SajuInput = { date: "1998-06-15", time: "08:00", calendar: "solar", topic: "general" };
  const chart = calculate(input), timeline = calculateDaewoon(input, 0, 2026);
  let year = initialYear, cursor = 0, tree: Node;
  const slots: unknown[] = [], changes: number[] = [];
  const code = ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, Date,
    require(name: string) {
      if (name === "react") return {
        useState(initial: unknown) { const index = cursor++; if (!(index in slots)) slots[index] = initial; return [slots[index], (value: unknown) => { slots[index] = value; }]; },
        useMemo(fn: () => unknown) { return fn(); },
      };
      if (name === "react/jsx-runtime") return { jsx: (type: unknown, props: unknown) => ({ type, props }), jsxs: (type: unknown, props: unknown) => ({ type, props }) };
      return actual(name);
    },
  }, { filename });
  function render(disabled = false) {
    cursor = 0;
    tree = module.exports.default({ chart, timeline, report: buildFortuneReport(chart, timeline, year), disabled, onYear: (value: number) => { changes.push(value); year = value; } });
  }
  render();
  const byLabel = (label: string) => nodes(tree).find(n => n.props["aria-label"] === label)!;
  return {
    render, changes,
    chooseMonth(month: number) { const strip = byLabel("월운 시간표"); nodes(strip).filter(n => n.type === "button")[month - 1].props.onClick(); render(); },
    button: byLabel,
    get year() { return year; },
    currentMonth() { return nodes(byLabel("월운 시간표")).filter(n => n.type === "button").findIndex(n => n.props["aria-pressed"]) + 1; },
    yearCards() { return nodes(byLabel("연운 시간표")).filter(n => n.type === "button"); },
  };
}

test("달력의 12월 다음 달과 1월 이전 달은 선택 연도와 월을 함께 갱신한다", () => {
  const ui = harness();
  ui.chooseMonth(12); ui.button("다음 달").props.onClick(); ui.render();
  assert.equal(ui.year, 2027); assert.equal(ui.currentMonth(), 1);
  ui.button("이전 달").props.onClick(); ui.render();
  assert.equal(ui.year, 2026); assert.equal(ui.currentMonth(), 12);
  assert.deepEqual(ui.changes, [2027, 2026]);
});

test("지원 범위 밖으로 달력 이동을 막고 상담 생성 중 연도 변경을 막는다", () => {
  const first = harness(1990); first.chooseMonth(1);
  assert.equal(first.button("이전 달").props.disabled, true);
  const last = harness(2100); last.chooseMonth(12);
  assert.equal(last.button("다음 달").props.disabled, true);
  const busy = harness(); busy.render(true);
  assert.equal(busy.button("이전 달").props.disabled, true);
  assert.equal(busy.button("다음 달").props.disabled, true);
  assert.ok(busy.yearCards().every(n => n.props.disabled));
});
