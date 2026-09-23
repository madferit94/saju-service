import { getCountries, findLocationsByCountryIso } from "@coroboros/location-timezone";
import koreanCityAliases from "../../../lib/saju/korean-city-aliases.json";

const koreanAliases: Record<string, string> = {
  서울: "Seoul", 부산: "Busan", 대구: "Daegu", 인천: "Incheon", 대전: "Daejeon",
  광주: "Gwangju", 울산: "Ulsan", 수원: "Suwon", 제주: "Jeju", 춘천: "Chuncheon",
  청주: "Cheongju", 전주: "Jeonju", 포항: "Pohang", 창원: "Changwon",
};

// The bundled city list omits Anyang. Use the city hall location as the
// representative birthplace coordinate for Anyang-si.
const curatedCities: Record<string, Array<{
  aliases: string[];
  countryCode: string;
  countryName: string;
  city: string;
  province: string;
  timezone: string;
  longitude: number;
}>> = {
  KR: [{
    aliases: ["안양", "anyang"],
    countryCode: "KR",
    countryName: "대한민국",
    city: "Anyang",
    province: "Gyeonggi-do",
    timezone: "Asia/Seoul",
    longitude: 126.95687,
  }],
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("countries") === "1") {
    const koreanNames = new Intl.DisplayNames(["ko"], { type: "region" });
    const countries = [...new Map(getCountries().filter((country) => /^[A-Z]{2}$/.test(country.iso2))
      .map((country) => [country.iso2, { code: country.iso2, name: koreanNames.of(country.iso2) ?? country.name }])).values()]
      .sort((a, b) => a.name.localeCompare(b.name, "ko"));
    return Response.json({ countries },
      { headers: { "Cache-Control": "no-store" } });
  }
  const code = (url.searchParams.get("country") ?? "").toUpperCase();
  const rawQuery = (url.searchParams.get("q") ?? "").trim();
  if (!/^[A-Z]{2}$/.test(code) || rawQuery.length < 2 || rawQuery.length > 50) {
    return Response.json({ cities: [] });
  }
  const normalized = rawQuery.toLocaleLowerCase();
  const countryAliases = (koreanCityAliases as Record<string, Record<string, string[]>>)[code] ?? {};
  const matchedLocations = new Set(
    Object.entries(countryAliases)
      .filter(([alias]) => alias.toLocaleLowerCase().includes(normalized))
      .flatMap(([, keys]) => keys),
  );
  const manualNames = new Set(code === "KR"
    ? Object.entries(koreanAliases).filter(([alias]) => alias.includes(rawQuery)).map(([, name]) => name)
    : []);
  const cities = findLocationsByCountryIso(code)
    .filter((location) =>
      location.city.toLocaleLowerCase().includes(normalized) ||
      location.cityAscii.toLocaleLowerCase().includes(normalized) ||
      manualNames.has(location.city) ||
      matchedLocations.has(`${location.city}|${location.province}|${location.longitude}`),
    )
    .slice(0, 20)
    .map((location) => ({
      countryCode: location.country.iso2,
      countryName: new Intl.DisplayNames(["ko"], { type: "region" }).of(location.country.iso2) ?? location.country.name,
      city: location.city,
      province: location.province,
      timezone: location.timezone,
      longitude: location.longitude,
    }));
  const curatedMatches = (curatedCities[code] ?? []).filter((location) =>
    location.aliases.some((alias) => alias.toLocaleLowerCase().includes(normalized) || normalized.includes(alias.toLocaleLowerCase())),
  );
  const uniqueCities = [...cities, ...curatedMatches
    .filter((curated) => !cities.some((city) => city.city.toLocaleLowerCase() === curated.city.toLocaleLowerCase()))
    .map((curated) => ({
      countryCode: curated.countryCode,
      countryName: curated.countryName,
      city: curated.city,
      province: curated.province,
      timezone: curated.timezone,
      longitude: curated.longitude,
    })),
  ].slice(0, 20);
  return Response.json({ cities: uniqueCities }, { headers: { "Cache-Control": "no-store" } });
}
