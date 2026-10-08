import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as jsxRuntime from "react/jsx-runtime";
import vm from "node:vm";
import ts from "typescript";
import DoryeongShareCard from "../app/doryeong-share-card";
import { reportPageFromUrl } from "../lib/report-pages";
import { calculate } from "../lib/saju/chart";
import { buildDoryeongOneLine } from "../lib/saju/doryeong-one-line";

function landingMarkup() {
  // Render the real Page composition while isolating the client form and Next's image transport.
  // The form's storage/navigation behaviors have their own regression tests.
  const source = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} as { default: () => ReturnType<typeof createElement> } };
  vm.runInNewContext(code, {
    module, exports: module.exports,
    require(name: string) {
      if (name === "react/jsx-runtime") return jsxRuntime;
      if (name === "./saju-form") return { __esModule: true, default: () => null };
      if (name === "next/image") return { __esModule: true, default: ({ priority, fill, src, ...props }: Record<string, unknown>) => createElement("img", { ...props, src: typeof src === "string" ? src : (src as { src: string }).src }) };
      if (name === "../public/images/lantern-journey.webp") return { __esModule: true, default: { src: "/images/lantern-journey.webp", width: 1536, height: 1024 } };
      throw new Error(`Unexpected landing import: ${name}`);
    },
  });
  return renderToStaticMarkup(createElement(module.exports.default));
}

test("첫 화면은 서버 렌더링된 제목·출생 입력 링크와 장식 이미지를 제공한다", () => {
  const html = landingMarkup();
  const headings = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g)];
  assert.equal(headings.length, 1);
  assert.equal(headings[0][1].replace(/<[^>]*>/g, "").replace(/\s+/g, ""), "나를알고,다음시간을그리다.");
  const links = [...html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)];
  const entry = links.find(link => link[1] === "?view=input#input-title");
  assert.ok(entry, "새로 열거나 키보드로 시작해도 출생 정보 화면으로 이동할 링크가 필요합니다");
  assert.match(entry[2], /내 사주 보기/);
  assert.equal(reportPageFromUrl(new URL(entry[1], "https://saju-service-steel.vercel.app/")), "input");
  const image = [...html.matchAll(/<img\b([^>]+)>/g)].find(match => match[1].includes("/images/lantern-journey.webp"));
  assert.ok(image, "승인된 등불 이미지를 사용해야 합니다");
  assert.match(image[1], /alt=""/);
  assert.doesNotMatch(html, /도령|별빛 도령/);
});

test("첫 화면 이미지 자산은 실제 WebP이며 웹 전송에 적합한 크기다", () => {
  const asset = readFileSync(new URL("../public/images/lantern-journey.webp", import.meta.url));
  assert.equal(asset.subarray(0, 4).toString(), "RIFF");
  assert.equal(asset.subarray(8, 12).toString(), "WEBP");
  assert.ok(asset.length > 1000, "비어 있는 이미지나 자리표시자는 사용할 수 없습니다");
  assert.ok(asset.length < 1_000_000, `첫 화면 이미지 전송 크기: ${asset.length} bytes`);
});

test("계산 결과 공유 카드의 SSR은 등불 안내를 사용하고 개인정보를 표시하지 않는다", () => {
  const chart = calculate({ date: "2005-12-23", time: "08:37", calendar: "solar", topic: "general" });
  const line = buildDoryeongOneLine(chart).line;
  const html = renderToStaticMarkup(createElement(DoryeongShareCard, { line }));
  assert.match(html, /aria-label="등불 한줄평 공유 카드"/);
  assert.match(html, /내 길을 비추는 한마디/);
  assert.ok(html.includes(line), "실제 원국으로 만든 문장을 표시해야 합니다");
  assert.match(html, /생년월일과 출생지는 포함되지 않습니다/);
  assert.doesNotMatch(html, /도령|2005-12-23|08:37/);
  assert.match(html, /<button\b[^>]*type="button"[^>]*>한줄평 공유하기<\/button>/);
  assert.match(html, /<button\b[^>]*type="button"[^>]*>카드 이미지 저장<\/button>/);
});

test("이미지 저장과 기기 공유는 같은 등불 PNG 파일명을 사용한다", () => {
  const source = readFileSync(new URL("../app/doryeong-share-card.tsx", import.meta.url), "utf8");
  assert.match(source, /link\.download = "등불의-사주-한줄평\.png"/);
  assert.match(source, /new File\(\[blob\], "등불의-사주-한줄평\.png"/);
  assert.doesNotMatch(source, /도령의 사주|별빛 도령|도령의-사주/);
});
