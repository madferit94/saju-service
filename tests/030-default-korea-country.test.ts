import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import SajuForm from "../app/saju-form";
import { GET as getLocations } from "../app/api/locations/route";

test("국가 목록을 불러오기 전에도 출생 국가에 대한민국이 기본 표시된다", () => {
  const html = renderToStaticMarkup(createElement(SajuForm));
  const countrySelect = html.match(/<select\b[^>]*id="country"[^>]*>[\s\S]*?<\/select>/)?.[0];

  assert.ok(countrySelect, "출생 국가 선택칸이 있어야 합니다");
  assert.match(countrySelect, /<option\b[^>]*value="KR"[^>]*selected[^>]*>대한민국<\/option>/);
  assert.equal((countrySelect.match(/value="KR"/g) ?? []).length, 1, "목록을 불러오기 전 대한민국은 한 번만 보여야 합니다");
});

test("전체 국가 목록은 대한민국과 변경 가능한 다른 국가를 중복 없이 제공한다", async () => {
  const response = await getLocations(new Request("http://localhost/api/locations?countries=1"));
  assert.equal(response.status, 200);
  const body = await response.json() as { countries: { code: string; name: string }[] };
  const codes = body.countries.map((country) => country.code);

  assert.equal(body.countries.filter((country) => country.code === "KR").length, 1);
  assert.ok(body.countries.some((country) => country.code === "US"), "다른 나라로 변경할 수 있어야 합니다");
  assert.equal(new Set(codes).size, codes.length, "국가 선택 목록에 중복이 없어야 합니다");
});
