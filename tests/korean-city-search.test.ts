import test from "node:test";
import assert from "node:assert/strict";
import { GET as getLocations } from "../app/api/locations/route";

type City = {
  countryCode: string;
  city: string;
  province: string;
  timezone: string;
  longitude: number;
};

async function search(country: string, query: string): Promise<City[]> {
  const url = new URL("http://localhost/api/locations");
  url.searchParams.set("country", country);
  url.searchParams.set("q", query);
  const response = await getLocations(new Request(url));
  assert.equal(response.status, 200);
  const body = await response.json() as { cities: City[] };
  assert.ok(Array.isArray(body.cities));
  return body.cities;
}

test("도시 검색 응답은 이전 빈 결과가 브라우저에 남지 않도록 저장하지 않는다", async () => {
  const response = await getLocations(new Request("http://localhost/api/locations?country=KR&q=안양"));
  assert.equal(response.headers.get("Cache-Control"), "no-store");
});

test("한국과 주요 해외 도시를 한글로 검색하면 출생지 계산에 필요한 장소가 나온다", async () => {
  const examples = [
    { country: "KR", korean: "서울", city: /^Seoul$/i, timezone: "Asia/Seoul", longitude: [126, 128] },
    { country: "US", korean: "뉴욕", city: /^New York$/i, timezone: "America/New_York", longitude: [-75, -73] },
    { country: "JP", korean: "도쿄", city: /^(Tokyo|Tōkyō)$/i, timezone: "Asia/Tokyo", longitude: [139, 140] },
    { country: "FR", korean: "파리", city: /^Paris$/i, timezone: "Europe/Paris", longitude: [2, 3] },
    { country: "GB", korean: "런던", city: /^London$/i, timezone: "Europe/London", longitude: [-1, 1] },
    { country: "AU", korean: "시드니", city: /^Sydney$/i, timezone: "Australia/Sydney", longitude: [150, 152] },
  ];

  for (const example of examples) {
    const cities = await search(example.country, example.korean);
    const match = cities.find((city) => example.city.test(city.city));
    assert.ok(match, `${example.country} ${example.korean}: 기대 도시가 검색되지 않았습니다`);
    assert.equal(match.countryCode, example.country);
    assert.equal(match.timezone, example.timezone);
    assert.ok(Number.isFinite(match.longitude));
    assert.ok(match.longitude >= example.longitude[0] && match.longitude <= example.longitude[1]);
    assert.equal(typeof match.province, "string");
  }
});

test("영문 도시 검색도 유지하고 검색 국가 밖의 도시는 반환하지 않는다", async () => {
  const english = await search("US", "New York");
  assert.ok(english.some((city) => city.city === "New York" && city.timezone === "America/New_York"));

  const paris = await search("FR", "파리");
  assert.ok(paris.length > 0);
  assert.ok(paris.every((city) => city.countryCode === "FR"));

  const tokyo = await search("JP", "도쿄");
  assert.ok(tokyo.length > 0);
  assert.ok(tokyo.every((city) => city.countryCode === "JP"));
});

test("한글 이름의 일부를 입력해도 해당 도시를 찾는다", async () => {
  const cities = await search("AU", "시드");
  assert.ok(cities.some((city) => city.city === "Sydney" && city.timezone === "Australia/Sydney"));
});

test("기본 도시 자료에 없는 안양도 한글과 영문으로 검색된다", async () => {
  for (const query of ["안양", "anyang"]) {
    const cities = await search("KR", query);
    const anyang = cities.find((city) => city.city === "Anyang");
    assert.ok(anyang, `${query}: 안양이 검색되지 않았습니다`);
    assert.equal(anyang.countryCode, "KR");
    assert.equal(anyang.province, "Gyeonggi-do");
    assert.equal(anyang.timezone, "Asia/Seoul");
    assert.ok(Math.abs(anyang.longitude - 126.95687) < 0.001);
  }
});
