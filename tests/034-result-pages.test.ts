import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";
import { reportPages, reportPageFromUrl, reportPageUrl, type ReportPage } from "../lib/report-pages";

type ElementNode = { type: unknown; props: Record<string, any> };
function descendants(value: unknown): ElementNode[] {
  if (Array.isArray(value)) return value.flatMap(descendants);
  if (!value || typeof value !== "object" || !("props" in value)) return [];
  const node = value as ElementNode;
  return [node, ...descendants(node.props.children)];
}

function navigation(activePage: ReportPage, onNavigate: (page: ReportPage) => void) {
  const filename = fileURLToPath(new URL("../app/report-navigation.tsx", import.meta.url));
  const code = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} as { default: (props: { activePage: ReportPage; onNavigate: typeof onNavigate }) => ElementNode } };
  const jsx = (type: unknown, props: Record<string, unknown>): ElementNode => ({ type, props });
  vm.runInNewContext(code, {
    module, exports: module.exports,
    require(name: string) {
      if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
      if (name === "../lib/report-pages") return { reportPages };
      throw new Error(`Unexpected import: ${name}`);
    },
  }, { filename });
  return descendants(module.exports.default({ activePage, onNavigate }));
}

test("결과 메뉴 8개의 이름과 주소가 각각 하나의 화면에 대응한다", () => {
  const expected = [
    ["chart", "사주표"], ["daily", "오늘의 운세"], ["elements", "오행·십성"],
    ["balance", "균형·도움"], ["graph", "인생 그래프"], ["seasons", "인생 4계절"],
    ["flow", "운의 흐름"], ["domains", "생활 운"],
  ];
  assert.deepEqual(reportPages.map(({ id, label }) => [id, label]), expected);
  for (const [id] of expected) {
    const url = reportPageUrl(new URL("http://localhost:3000/?campaign=friend#life-graph"), id as ReportPage);
    assert.equal(url, `/?campaign=friend&view=${id}`);
    assert.equal(reportPageFromUrl(new URL(url, "http://localhost:3000")), id);
  }
  assert.equal(reportPageUrl(new URL("http://localhost:3000/?view=flow#fortune-domains"), "input"), "/?view=input");
});

test("예전 북마크의 # 주소와 알 수 없는 주소를 안전하게 해석한다", () => {
  const oldLinks: Record<string, ReportPage> = {
    "result-title": "chart", "daily-fortune": "daily", "manse-elements": "elements",
    "deep-analysis-title": "balance", "life-graph": "graph", "life-seasons": "seasons",
    "flow-overview": "flow", "fortune-lifetime": "flow", "fortune-domains": "domains",
    "fortune-domain-career": "domains",
  };
  for (const [hash, page] of Object.entries(oldLinks)) {
    assert.equal(reportPageFromUrl(new URL(`http://localhost:3000/#${hash}`)), page, hash);
  }
  assert.equal(reportPageFromUrl(new URL("http://localhost:3000/?view=made-up")), "chart");
  assert.equal(reportPageFromUrl(new URL("http://localhost:3000/?view=daily#fortune-domains")), "daily", "새 주소가 예전 # 주소보다 우선합니다");
  assert.equal(reportPageFromUrl(new URL("http://localhost:3000/#%E0%A4%A")), "chart", "잘못된 # 주소가 화면을 깨뜨리지 않습니다");
});

test("메뉴는 현재 화면을 표시하고 일반 클릭만 화면 전환으로 처리한다", () => {
  const changes: ReportPage[] = [];
  const nodes = navigation("flow", page => changes.push(page));
  const menu = nodes.find(node => node.type === "nav")!;
  assert.equal(menu.props["aria-label"], "사주 결과 항목");
  const links = nodes.filter(node => node.type === "a");
  assert.equal(links.length, 9, "결과 항목 8개와 출생 정보 화면 1개가 있어야 합니다");
  assert.deepEqual(links.map(node => node.props.href), ["?view=input", ...reportPages.map(page => `?view=${page.id}`)]);
  assert.deepEqual(links.filter(node => node.props["aria-current"] === "page").map(node => node.props.href), ["?view=flow"]);

  let prevented = false;
  links[2].props.onClick({ button: 0, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.deepEqual(changes, ["daily"]);

  prevented = false;
  links[2].props.onClick({ button: 0, ctrlKey: true, metaKey: false, shiftKey: false, altKey: false, preventDefault() { prevented = true; } });
  assert.equal(prevented, false, "새 탭으로 여는 조합 키는 브라우저가 처리해야 합니다");
  assert.deepEqual(changes, ["daily"]);
  const inputLinks = navigation("input", () => undefined).filter(node => node.type === "a" && node.props["aria-current"] === "page");
  assert.deepEqual(inputLinks.map(node => node.props.href), ["?view=input"]);
});

test("결과 화면은 선택한 본문만 렌더링하고 계정과 입력은 전환 중 유지한다", () => {
  const source = readFileSync(new URL("../app/saju-form.tsx", import.meta.url), "utf8");
  assert.match(source, /<div className="input-entry" hidden=\{Boolean\(chart && activePage !== "input"\)\}>/u);
  assert.match(source, /<ReportNavigation activePage=\{activePage\} onNavigate=\{navigateTo\}/u);
  assert.match(source, /window\.history\.pushState\(null, "", nextUrl\)/u);
  assert.match(source, /addEventListener\("popstate"/u);
  for (const page of ["chart", "elements", "daily", "graph", "seasons", "balance", "flow"]) {
    assert.ok(source.includes(`activePage === "${page}"`), `${page} 화면의 단독 표시 조건이 필요합니다`);
  }
  assert.match(source, /activePage === "flow" \|\| activePage === "domains"/u);
  assert.match(source, /mode=\{activePage === "domains" \? "domains" : "flow"\}/u);
  assert.match(source, /setChart\(saved\.chart\)/u);
  assert.match(source, /setChart\(payload\.result\.chart\)/u);
});
