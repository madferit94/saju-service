// Spec 045·046 화면 테스트용 하네스.
// tests/account-ui-races.test.ts와 같은 방식으로 실제 app/saju-form.tsx를 변환해 vm에서 실행한다.
// 브라우저·OAuth·외부 네트워크·실제 localStorage·Gemini는 쓰지 않는다.
// 훅 순서 번호에 기대지 않도록 효과(effect)는 함수 본문 문자열로 찾고, 출생지는 실제 도시 검색 목록을 눌러 고른다.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";
import type { Birthplace } from "../../lib/saju/birth-moment";
import type { SavedSajuResult } from "../../lib/saju/persistence";

export type VNode = { type: unknown; props: Record<string, any> };

export function nodes(root: unknown): VNode[] {
  if (Array.isArray(root)) return root.flatMap(nodes);
  if (!root || typeof root !== "object" || !("props" in root)) return [];
  const node = root as VNode;
  return [node, ...nodes(node.props.children)];
}

export function textOf(root: unknown): string {
  if (root === null || root === undefined || typeof root === "boolean") return "";
  if (typeof root === "string" || typeof root === "number") return String(root);
  if (Array.isArray(root)) return root.map(textOf).join("");
  if (typeof root === "object" && "props" in root) return textOf((root as VNode).props.children);
  return "";
}

// 실제 패널 컴포넌트는 기호(Symbol)로 바꿔 props만 확인한다. 아래 제목은 실제 컴포넌트 소스의 h2와 같게 맞췄다.
const mocked = [
  "./account-panel", "./fortune-panel", "./deep-analysis-panel", "./consultation-panel", "./manse-panel",
  "./flow-overview", "./life-seasons-panel", "./daily-fortune-panel", "./life-graph-panel", "./doryeong-share-card",
] as const;
const symbols = Object.fromEntries(mocked.map((name) => [name, Symbol(name)])) as Record<(typeof mocked)[number], symbol>;

function panelHeadings(type: symbol, props: Record<string, any>): { id?: string; text: string }[] {
  switch (type.description) {
    case "./account-panel": return [{ id: "account-title", text: "내 사주 보관함" }];
    case "./daily-fortune-panel": return [{ id: "daily-fortune-title", text: "오늘의 운세" }];
    case "./manse-panel": return props.mode === "elements" ? [{ text: "오행과 십성을 한눈에" }] : [];
    case "./deep-analysis-panel": return [{ id: "deep-analysis-title", text: "사주의 균형과 도움이 되는 방향" }];
    case "./life-graph-panel": return [{ id: "life-graph-heading", text: "나의 인생 그래프" }];
    case "./life-seasons-panel": return [{ id: "life-seasons-title", text: "나의 인생 4계절" }];
    case "./flow-overview": return [{ id: "flow-overview-title", text: "시간에 따라 달라지는 운" }];
    case "./fortune-panel": return props.mode === "domains"
      ? [{ id: "fortune-domains-title", text: "생활 주제별 운" }]
      : [{ id: "fortune-title", text: "나의 평생 운과 지금의 흐름" }];
    default: return [];
  }
}

// 초점 이동 효과가 쓰는 만큼만 흉내 낸 아주 작은 DOM.
export class FakeElement {
  children: FakeElement[] = [];
  parent: FakeElement | null = null;
  constructor(public tag: string, public attrs: Record<string, string>, public text: string, private log: FocusLog[]) {}
  private walk(): FakeElement[] { return this.children.flatMap((child) => [child, ...child.walk()]); }
  querySelector(selector: string) {
    if (!selector.startsWith("#")) throw new Error(`지원하지 않는 선택자: ${selector}`);
    return this.walk().find((element) => element.attrs.id === selector.slice(1)) ?? null;
  }
  querySelectorAll(selector: string) {
    if (!/^[a-z0-9]+$/.test(selector)) throw new Error(`지원하지 않는 선택자: ${selector}`);
    return this.walk().filter((element) => element.tag === selector);
  }
  matches(selector: string) {
    return selector.split(",").map((part) => part.trim()).some((part) => part.startsWith(".")
      ? (this.attrs.class ?? "").split(/\s+/).includes(part.slice(1))
      : this.tag === part);
  }
  closest(selector: string): FakeElement | null {
    for (let element: FakeElement | null = this; element; element = element.parent) if (element.matches(selector)) return element;
    return null;
  }
  hasAttribute(name: string) { return name in this.attrs; }
  getAttribute(name: string) { return this.attrs[name] ?? null; }
  setAttribute(name: string, value: string) { this.attrs[name] = String(value); }
  focus(options?: { preventScroll?: boolean }) { this.log.push({ tag: this.tag, id: this.attrs.id, text: this.text, tabindex: this.attrs.tabindex, options }); }
}

export type FocusLog = { tag: string; id?: string; text: string; tabindex?: string; options?: { preventScroll?: boolean } };

function buildDom(root: unknown, log: FocusLog[]): FakeElement {
  const attach = (parent: FakeElement, value: unknown) => {
    if (Array.isArray(value)) { value.forEach((item) => attach(parent, item)); return; }
    if (!value || typeof value !== "object" || !("props" in value)) return;
    const node = value as VNode;
    if (typeof node.type === "string") {
      const attrs: Record<string, string> = {};
      for (const [key, prop] of Object.entries(node.props)) {
        if (key === "children" || typeof prop === "function" || typeof prop === "object" || prop === false || prop === undefined || prop === null) continue;
        attrs[key === "className" ? "class" : key === "tabIndex" ? "tabindex" : key] = String(prop);
      }
      const element = new FakeElement(node.type, attrs, textOf(node.props.children), log);
      element.parent = parent; parent.children.push(element);
      attach(element, node.props.children);
    } else if (typeof node.type === "symbol") {
      const holder = new FakeElement("div", { "data-component": String(node.type.description) }, "", log);
      holder.parent = parent; parent.children.push(holder);
      for (const heading of panelHeadings(node.type, node.props)) {
        const h2 = new FakeElement("h2", heading.id ? { id: heading.id } : {}, heading.text, log);
        h2.parent = holder; holder.children.push(h2);
      }
    } else if (typeof node.type === "function") {
      // ReportNavigation처럼 훅이 없는 실제 컴포넌트는 펼친다.
      attach(parent, (node.type as (props: unknown) => unknown)(node.props));
    }
  };
  const top = new FakeElement("#root", {}, "", log);
  attach(top, root);
  return top.children[0];
}

export type HarnessOptions = {
  saved?: SavedSajuResult | null;
  /** 컴포넌트 안의 `new Date()`가 돌려줄 고정 시각. 생략하면 실제 시계를 쓴다. */
  now?: string;
  cities?: Birthplace[];
};

export function sajuFormHarness(options: HarnessOptions = {}) {
  const filename = fileURLToPath(new URL("../../app/saju-form.tsx", import.meta.url));
  const requireActual = createRequire(filename);
  const slots: unknown[] = [];
  let effects: { effect: () => void | (() => void); source: string }[] = [];
  let cursor = 0;
  const writes: SavedSajuResult[] = [];
  const focusLog: FocusLog[] = [];
  const timers: (() => void)[] = [];
  const requests: { url: string; body: Record<string, unknown> | null; signal?: AbortSignal }[] = [];
  const pending: ((response: unknown) => void)[] = [];
  const window = {
    location: { href: "http://localhost:3000/" },
    history: { pushState(_state: unknown, _title: string, url: string) { window.location.href = new URL(url, window.location.href).href; } },
    scrollTo() {}, addEventListener() {}, removeEventListener() {},
  };
  const hooks = {
    useState(initial: unknown) { const index = cursor++; if (!(index in slots)) slots[index] = initial; return [slots[index], (next: unknown) => { slots[index] = typeof next === "function" ? (next as (value: unknown) => unknown)(slots[index]) : next; }]; },
    useRef(initial: unknown) { const index = cursor++; if (!(index in slots)) slots[index] = { current: initial }; return slots[index]; },
    useMemo(calculate: () => unknown) { return calculate(); },
    useEffect(effect: () => void | (() => void)) { effects.push({ effect, source: String(effect) }); },
  };
  const jsx = (type: unknown, props: Record<string, unknown>) => ({ type, props });
  const RealDate = Date;
  const fixed = options.now ? RealDate.parse(options.now) : null;
  const ClockDate = fixed === null ? RealDate : class extends RealDate {
    constructor(...args: unknown[]) { if (args.length === 0) super(fixed as number); else super(...(args as [string])); }
    static now() { return fixed!; }
  };
  const module = { exports: {} as { default: () => VNode } };
  const code = ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  vm.runInNewContext(code, {
    module, exports: module.exports,
    require(name: string) {
      if (name === "react") return hooks;
      if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
      if (name in symbols) return { default: symbols[name as keyof typeof symbols], __esModule: true };
      if (name === "../lib/saju/persistence") return {
        readSavedSajuResult: () => options.saved ?? null,
        clearSavedSajuResult: () => true,
        writeSavedSajuResult: (value: SavedSajuResult) => { writes.push(value); return true; },
      };
      return requireActual(name);
    },
    fetch: (url: string, init: { body?: string; signal?: AbortSignal } = {}) => {
      requests.push({ url, body: init.body ? JSON.parse(init.body) : null, signal: init.signal });
      if (url.startsWith("/api/locations?countries=1")) return Promise.resolve({ ok: true, json: async () => ({ countries: [] }) });
      if (url.startsWith("/api/locations?country=")) return Promise.resolve({ ok: true, json: async () => ({ cities: options.cities ?? [] }) });
      return new Promise((resolve) => { pending.push(resolve); });
    },
    setTimeout: (callback: () => void) => { timers.push(callback); return timers.length; },
    clearTimeout() {},
    console, Date: ClockDate, URL, AbortController,
    FormData: class { constructor(private form: { values: Record<string, string> }) {} get(name: string) { return this.form.values[name] ?? null; } },
    window,
  }, { filename });
  let tree: VNode;
  const render = () => { cursor = 0; effects = []; tree = module.exports.default(); return tree; };
  const find = (predicate: (node: VNode) => boolean) => nodes(tree).find(predicate);
  const all = (predicate: (node: VNode) => boolean) => nodes(tree).filter(predicate);
  const runEffect = (marker: string) => {
    const found = effects.filter((item) => item.source.includes(marker));
    if (found.length !== 1) throw new Error(`효과를 하나로 찾지 못했습니다: ${marker} (${found.length})`);
    found[0].effect();
  };
  render();
  return {
    render,
    get tree() { return tree; },
    find, all,
    writes, requests, focusLog,
    get href() { return window.location.href; },
    text: () => textOf(tree),
    /** 처음 화면이 뜰 때 React가 실행하는 효과를 모두 실행한다(저장본 복원·국가 목록·초점 효과 포함). */
    mount() {
      const mountEffects = [...effects];
      mountEffects.forEach((item) => item.effect());
      render();
    },
    /** 화면을 그린 뒤 실제 DOM처럼 ref를 연결하고 초점 효과를 실행한다. */
    commitFocus() {
      const root = buildDom(tree, focusLog);
      const ref = tree.props.ref as { current: unknown } | undefined;
      if (!ref || !("current" in ref)) throw new Error("최상위 section에 ref가 없습니다");
      ref.current = root;
      runEffect("pageFocusRequest");
      return root;
    },
    account: () => find((node) => typeof node.type === "symbol" && node.type.description === "./account-panel")!.props,
    panel: (name: (typeof mocked)[number]) => find((node) => node.type === symbols[name])?.props,
    navigate(page: string) {
      const nav = find((node) => typeof node.type === "function" && typeof node.props.onNavigate === "function");
      if (!nav) throw new Error("결과 메뉴가 없습니다");
      nav.props.onNavigate(page); render();
    },
    async searchCity(query: string) {
      find((node) => node.props.id === "city")!.props.onChange({ target: { value: query } }); render();
      runEffect("/api/locations?country=");
      while (timers.length) timers.shift()!();
      await new Promise((resolve) => setImmediate(resolve));
      render();
    },
    async respondAll(body: unknown, ok: boolean) {
      for (let guard = 0; guard < 5 && pending.length; guard++) {
        pending.shift()!({ ok, json: async () => body });
        await new Promise((resolve) => setImmediate(resolve));
      }
      render();
    },
  };
}
