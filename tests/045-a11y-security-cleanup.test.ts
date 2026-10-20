import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import nextConfig from "../next.config";
import { calculate, type SajuInput } from "../lib/saju/chart";
import { calculateDaewoon } from "../lib/saju/daewoon";
import { calculateBenefactors } from "../lib/saju/benefactors";
import type { CloudPayload } from "../lib/account/results";
import type { Birthplace } from "../lib/saju/birth-moment";
import { nodes, sajuFormHarness, textOf } from "./helpers/saju-form-harness";

const root = path.dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const cities: Birthplace[] = [
  { countryCode: "KR", countryName: "대한민국", city: "서울", province: "서울특별시", timezone: "Asia/Seoul", longitude: 126.978 },
  { countryCode: "KR", countryName: "대한민국", city: "부산", province: "부산광역시", timezone: "Asia/Seoul", longitude: 129.075 },
];

function payload(): CloudPayload {
  const input: SajuInput = { date: "2000-02-04", time: "08:37", calendar: "solar", topic: "general", birthplace: cities[0] };
  const chart = calculate(input);
  return { version: 1, fortuneYear: 2026, result: { version: 1, savedAt: "2026-09-23T05:00:00.000Z", input, yunGender: 0, chart, timeline: calculateDaewoon(input, 0, 2026), benefactors: calculateBenefactors(chart), reading: null } };
}

// ── 접근성: 도시 검색 결과 ──────────────────────────────────────────────

test("도시 검색 결과는 이름 붙은 ul > li > button(type=button) 목록이며 listbox/option/aria-selected를 쓰지 않는다", async () => {
  const form = sajuFormHarness({ cities });
  await form.searchCity("서울");
  assert.ok(form.requests.some((request) => request.url.startsWith("/api/locations?country=KR&q=")), "도시 검색 API를 호출해야 합니다");
  const list = form.find((node) => node.props.className === "city-matches");
  assert.ok(list, "검색 결과 목록이 보여야 합니다");
  assert.equal(list.type, "ul");
  assert.equal(list.props["aria-label"], "도시 검색 결과");
  assert.equal(list.props.role, undefined);
  const items = nodes(list.props.children);
  const lis = items.filter((node) => node.type === "li");
  const buttons = items.filter((node) => node.type === "button");
  assert.equal(lis.length, cities.length);
  assert.equal(buttons.length, cities.length);
  for (const li of lis) {
    const children = nodes(li.props.children).filter((node) => node !== li);
    assert.equal(children[0].type, "button", "각 li 안에 버튼이 있어야 합니다");
  }
  for (const button of buttons) {
    assert.equal(button.props.type, "button", "목록 버튼이 양식을 제출하면 안 됩니다");
    assert.equal(button.props.role, undefined);
    assert.equal(button.props["aria-selected"], undefined);
  }
  assert.deepEqual(buttons.map((button) => textOf(button)), ["서울, 서울특별시 · Asia/Seoul", "부산, 부산광역시 · Asia/Seoul"]);
  // 화면 전체에 listbox/option 역할과 aria-selected가 남아 있지 않다.
  assert.ok(!form.all(() => true).some((node) => ["listbox", "option"].includes(node.props.role) || "aria-selected" in node.props));
  const source = readFileSync(path.join(root, "app/saju-form.tsx"), "utf8");
  assert.doesNotMatch(source, /role="(?:listbox|option)"|aria-selected/u);
});

test("도시 목록의 버튼을 누르면 출생지가 선택되고 목록이 닫힌다", async () => {
  const form = sajuFormHarness({ cities });
  await form.searchCity("부산");
  const busan = form.all((node) => node.type === "button" && textOf(node).startsWith("부산"))[0];
  busan.props.onClick();
  form.render();
  assert.equal(form.find((node) => node.props.className === "city-matches"), undefined, "선택 후 목록이 사라져야 합니다");
  assert.equal(form.find((node) => node.props.id === "city")!.props.value, "부산, 부산광역시");
  assert.equal(textOf(form.find((node) => node.props.className === "selected-city")), "선택: 대한민국 · 부산 · Asia/Seoul");
});

test("선택한 도시는 제출에 쓰여 출생지 오류 없이 사주를 계산한다", async () => {
  const form = sajuFormHarness({ cities });
  await form.searchCity("서울");
  form.all((node) => node.type === "button" && textOf(node).startsWith("서울"))[0].props.onClick();
  form.render();
  form.find((node) => node.type === "form")!.props.onSubmit({ preventDefault() {}, currentTarget: { values: { date: "2000-02-04", time: "08:37", yunGender: "0" } } });
  form.render();
  assert.deepEqual(form.all((node) => node.props.className === "error").map(textOf), []);
  assert.equal(form.account().current.result.input.birthplace.city, "서울");
  await form.respondAll({ error: { message: "가상 오류" } }, false);
});

// ── 접근성: 한마디 영역과 제목 ──────────────────────────────────────────

test("한마디 영역은 role=group과 이름을 함께 가지고, 두 제목은 tabIndex=-1이다", () => {
  const form = sajuFormHarness();
  assert.equal(form.find((node) => node.props.id === "input-title")!.props.tabIndex, -1);
  form.account().onLoad(payload()); form.render();
  const oneLine = form.find((node) => node.props.className === "doryeong-one-line");
  assert.ok(oneLine);
  assert.equal(oneLine.type, "div");
  assert.equal(oneLine.props.role, "group");
  assert.equal(oneLine.props["aria-label"], "내 길을 비추는 한마디");
  const title = form.find((node) => node.props.id === "result-title")!;
  assert.equal(title.type, "h2");
  assert.equal(title.props.tabIndex, -1);
});

// ── 접근성: 화면 전환 후 초점 ────────────────────────────────────────────

test("처음 화면을 열 때와 브라우저 저장본을 복원할 때는 초점을 옮기지 않는다", () => {
  const form = sajuFormHarness();
  form.mount();
  form.commitFocus();
  assert.deepEqual(form.focusLog, []);

  const value = payload();
  const restored = sajuFormHarness({ saved: value.result });
  restored.mount(); // 저장본 복원 효과 실행
  assert.ok(restored.find((node) => node.props.id === "result-title"), "저장된 결과가 보여야 합니다");
  restored.commitFocus();
  assert.deepEqual(restored.focusLog, [], "자동 복원은 이용자의 화면 전환이 아니므로 초점을 빼앗지 않는다");
});

test("결과 메뉴로 화면을 바꾸면 그 화면의 제목으로 초점을 옮긴다", () => {
  const form = sajuFormHarness();
  form.account().onLoad(payload()); form.render();
  form.commitFocus();
  assert.deepEqual(form.focusLog.map((entry) => entry.id), ["result-title"], "계정 결과를 열면 사주표 제목으로 이동");

  const expected: [string, { id?: string; text: string }][] = [
    ["daily", { id: "daily-fortune-title", text: "오늘의 운세" }],
    ["elements", { text: "오행과 십성을 한눈에" }],
    ["balance", { id: "deep-analysis-title", text: "사주의 균형과 도움이 되는 방향" }],
    ["graph", { id: "life-graph-heading", text: "나의 인생 그래프" }],
    ["seasons", { id: "life-seasons-title", text: "나의 인생 4계절" }],
    ["flow", { id: "flow-overview-title", text: "시간에 따라 달라지는 운" }],
    ["domains", { id: "fortune-domains-title", text: "생활 주제별 운" }],
    ["chart", { id: "result-title", text: "" }],
    ["input", { id: "input-title", text: "언제 태어나셨나요?" }],
  ];
  for (const [page, heading] of expected) {
    const before = form.focusLog.length;
    form.navigate(page);
    assert.ok(form.href.endsWith(`?view=${page}`), `${page}: 주소가 바뀌어야 합니다`);
    form.commitFocus();
    const moved = form.focusLog.slice(before);
    assert.equal(moved.length, 1, `${page}: 초점은 한 번만 옮긴다`);
    assert.equal(moved[0].tag, "h2", `${page}: 제목(h2)으로 이동`);
    assert.equal(moved[0].id, heading.id, `${page}: 초점 대상`);
    if (heading.text) assert.equal(moved[0].text, heading.text);
    assert.equal(moved[0].tabindex, "-1", `${page}: 제목은 프로그램 초점만 받는다(tabindex=-1)`);
    assert.equal(moved[0].options?.preventScroll, true, `${page}: 초점 이동 때 화면을 다시 스크롤하지 않는다`);
  }
});

test("다른 화면에서는 숨겨진 입력 영역(보관함·입력 제목)의 h2로 초점을 보내지 않는다", () => {
  const form = sajuFormHarness();
  form.account().onLoad(payload()); form.render();
  form.navigate("seasons");
  const dom = form.commitFocus();
  // 같은 DOM 안에 입력 영역의 h2가 먼저 있지만 그 h2는 건너뛰어야 한다.
  const h2s = dom.querySelectorAll("h2");
  assert.deepEqual(h2s.slice(0, 2).map((h2) => h2.attrs.id), ["account-title", "input-title"]);
  assert.ok(h2s[0].closest(".input-entry"));
  assert.equal(form.focusLog.at(-1)!.id, "life-seasons-title");
});

test("초점 효과는 화면 전환 요청 번호와 화면 이름이 바뀔 때만 실행되고 요청 전에는 아무것도 하지 않는다", () => {
  // 하네스는 React의 의존성 비교를 흉내 내지 않으므로 소스에서 의존성 목록을 확인한다.
  const source = readFileSync(path.join(root, "app/saju-form.tsx"), "utf8");
  assert.match(source, /heading\.focus\(\{ preventScroll: true \}\);\s*\}, \[pageFocusRequest, activePage\]\);/u);
  assert.match(source, /if \(pageFocusRequest === 0\) return;/u);
  assert.equal((source.match(/setPageFocusRequest\(/gu) ?? []).length, 1, "초점 요청은 navigateTo 한 곳에서만 만든다");
});

// ── 화면 전환 후 제목이 화면 밖이면 보이게 맞춘 뒤 초점 (32429b1 후속 수정) ─────────

const allPages = ["daily", "elements", "balance", "graph", "seasons", "flow", "domains", "chart", "input"] as const;

test("초점 제목이 화면 아래 밖이면 scrollIntoView(block start, behavior auto)를 정확히 한 번 부른 뒤 초점을 옮긴다", () => {
  // 실제 브라우저에서 잰 것처럼 scrollY 0에서 제목이 900px 아래(화면 높이 720px 밖)에 있다고 둔다.
  const form = sajuFormHarness({ viewportHeight: 720, rectFor: (element) => element.tag === "h2" ? { top: 900, bottom: 940 } : { top: 0, bottom: 10 } });
  form.account().onLoad(payload()); form.render();
  form.commitFocus();
  for (const page of allPages) {
    const before = form.domEvents.length;
    const scrollsBefore = form.scrollTo.length;
    form.navigate(page);
    assert.equal(form.scrollTo.length, scrollsBefore + 1, `${page}: navigateTo는 먼저 맨 위로 올린다`);
    form.commitFocus();
    const events = form.domEvents.slice(before);
    assert.deepEqual(events.map((event) => event.kind), ["scrollIntoView", "focus"], `${page}: 스크롤 한 번 뒤 초점`);
    assert.equal(events[0].id, events[1].id, `${page}: 같은 제목을 스크롤하고 초점을 준다`);
    assert.equal(events[0].text, events[1].text);
    assert.deepEqual({ ...events[0].options }, { block: "start", behavior: "auto" }, `${page}: scrollIntoView 옵션`);
    assert.deepEqual({ ...events[1].options }, { preventScroll: true }, `${page}: 초점 때 다시 스크롤하지 않는다`);
  }
});

test("초점 제목이 화면 위로 벗어나 있어도 한 번 맞추고, 화면 안이면 스크롤하지 않는다", () => {
  for (const [rect, expected] of [
    [{ top: -30, bottom: 10 }, ["scrollIntoView", "focus"]],
    [{ top: 700, bottom: 721 }, ["scrollIntoView", "focus"]], // 아래 끝이 1px만 넘어도 화면 밖
    [{ top: 0, bottom: 720 }, ["focus"]], // 화면 경계에 딱 맞으면 화면 안
    [{ top: 24, bottom: 64 }, ["focus"]],
    [{ top: 680, bottom: 720 }, ["focus"]],
  ] as const) {
    const form = sajuFormHarness({ viewportHeight: 720, rectFor: (element) => element.tag === "h2" ? rect : { top: 0, bottom: 10 } });
    form.account().onLoad(payload()); form.render();
    form.navigate("seasons");
    const before = form.domEvents.length;
    form.commitFocus();
    assert.deepEqual(form.domEvents.slice(before).map((event) => event.kind), [...expected], JSON.stringify(rect));
    assert.equal(form.focusLog.at(-1)!.id, "life-seasons-title");
  }
});

test("첫 화면과 브라우저 저장본 자동 복원 때는 제목이 화면 밖이어도 스크롤·초점이 모두 없다", () => {
  const offscreen = { viewportHeight: 720, rectFor: () => ({ top: 900, bottom: 940 }) };
  const first = sajuFormHarness(offscreen);
  first.mount(); first.commitFocus();
  assert.deepEqual(first.domEvents, []);
  assert.deepEqual(first.scrollTo, []);
  const restored = sajuFormHarness({ ...offscreen, saved: payload().result });
  restored.mount();
  assert.ok(restored.find((node) => node.props.id === "result-title"));
  restored.commitFocus(); restored.render(); restored.commitFocus();
  assert.deepEqual(restored.domEvents, [], "자동 복원은 스크롤도 초점도 바꾸지 않는다");
  assert.deepEqual(restored.scrollTo, []);
});

// ── 기본 보안 헤더 ───────────────────────────────────────────────────

test("next.config의 headers()는 모든 경로에 기본 보안 헤더 네 가지만 붙이고 CSP는 넣지 않는다", async () => {
  assert.equal(typeof nextConfig.headers, "function");
  const rules = await nextConfig.headers!();
  assert.equal(rules.length, 1);
  assert.equal(rules[0].source, "/:path*");
  assert.deepEqual(rules[0].headers, [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  ]);
  const keys = rules.flatMap((rule) => rule.headers.map((header) => header.key.toLowerCase()));
  assert.ok(!keys.some((key) => key.startsWith("content-security-policy")), "CSP는 이번 범위가 아니다");
  // 기존 설정은 그대로 유지한다.
  assert.equal(nextConfig.agentRules, false);
  assert.deepEqual(nextConfig.experimental, { cpus: 2 });
});

// ── 쓰이지 않는 코드 제거 ──────────────────────────────────────────────

test("tsc --noEmit --noUnusedLocals와 같은 검사에서 오류가 없다", () => {
  const configPath = path.join(root, "tsconfig.json");
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  assert.equal(config.error, undefined);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
  const program = ts.createProgram({
    rootNames: parsed.fileNames,
    options: { ...parsed.options, noEmit: true, noUnusedLocals: true, incremental: false, tsBuildInfoFile: undefined },
  });
  const diagnostics = ts.getPreEmitDiagnostics(program).map((diagnostic) => {
    const where = diagnostic.file && diagnostic.start !== undefined
      ? `${path.relative(root, diagnostic.file.fileName)}:${diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start).line + 1}`
      : "";
    return `${where} ${ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")}`;
  });
  assert.deepEqual(diagnostics, []);
});

test("제거 대상 코드가 다시 들어오지 않았다", () => {
  const manse = readFileSync(path.join(root, "lib/saju/manse.ts"), "utf8");
  const reading = readFileSync(path.join(root, "lib/saju/reading.ts"), "utf8");
  assert.doesNotMatch(manse, /import \{[^}]*\btenGod\b[^}]*\} from "\.\/fortune"/u);
  assert.doesNotMatch(reading, /periodContext|stemElements|branchElements/u);
});
