import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";

type ElementNode = { type: unknown; props: Record<string, unknown> };

function descendants(value: unknown): ElementNode[] {
  if (Array.isArray(value)) return value.flatMap(descendants);
  if (!value || typeof value !== "object" || !("props" in value)) return [];
  const node = value as ElementNode;
  return [node, ...descendants(node.props.children)];
}

function dailyPanel() {
  const filename = fileURLToPath(new URL("../app/daily-fortune-panel.tsx", import.meta.url));
  const code = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const slots: unknown[] = [];
  let cursor = 0;
  const hooks = {
    useState(initial: unknown) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [slots[index], (next: unknown) => { slots[index] = typeof next === "function" ? next(slots[index]) : next; }];
    },
    useRef(initial: unknown) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { current: initial };
      return slots[index];
    },
    useCallback(callback: unknown) { return callback; },
    useMemo(calculate: () => unknown) { return calculate(); },
    useEffect() {},
  };
  const jsx = (type: unknown, props: Record<string, unknown>): ElementNode => ({ type, props });
  const module = { exports: {} as { default: (props: { chart: unknown; timeline: unknown }) => ElementNode } };
  vm.runInNewContext(code, {
    module, exports: module.exports,
    require(name: string) {
      if (name === "react") return hooks;
      if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
      if (name === "../lib/saju/daily-fortune") return { buildPersonalDailyFortune: () => null };
      throw new Error(`Unexpected import: ${name}`);
    },
  }, { filename });
  const render = () => {
    cursor = 0;
    const tree = module.exports.default({ chart: {}, timeline: {} });
    const items = descendants(tree);
    return {
      toggle: items.find(node => node.type === "button" && node.props["aria-controls"] === "daily-fortune-content")!,
      content: items.find(node => node.props.id === "daily-fortune-content")!,
    };
  };
  return { render };
}

test("오늘의 운세는 처음 접혀 있고 제목 버튼을 누를 때마다 펼침 상태가 바뀐다", () => {
  const panel = dailyPanel();
  const initial = panel.render();
  assert.equal(initial.toggle.props["aria-expanded"], false);
  assert.equal(initial.content.props.hidden, true);
  assert.equal(initial.toggle.props["aria-controls"], initial.content.props.id);

  (initial.toggle.props.onClick as () => void)();
  const opened = panel.render();
  assert.equal(opened.toggle.props["aria-expanded"], true);
  assert.equal(opened.content.props.hidden, false);

  (opened.toggle.props.onClick as () => void)();
  const closed = panel.render();
  assert.equal(closed.toggle.props["aria-expanded"], false);
  assert.equal(closed.content.props.hidden, true);
});
