import { readFileSync, writeFileSync } from "node:fs";
import { getLocations } from "@coroboros/location-timezone";

const inputPath = process.argv[2];
if (!inputPath) throw new Error("GeoNames cities5000.txt 경로를 인수로 전달하세요.");

const locationKey = (place) => `${place.city}|${place.province}|${place.longitude}`;
const nameKey = (country, name) => `${country}|${name.toLocaleLowerCase()}`;
const bucketKey = (country, lat, lon) => `${country}|${Math.floor(lat * 10)}|${Math.floor(lon * 10)}`;
const names = new Map();
const buckets = new Map();

for (const place of getLocations()) {
  const country = place.country.iso2;
  for (const name of [place.city, place.cityAscii]) {
    const key = nameKey(country, name);
    if (!names.has(key)) names.set(key, []);
    names.get(key).push(place);
  }
  const key = bucketKey(country, place.latitude, place.longitude);
  if (!buckets.has(key)) buckets.set(key, []);
  buckets.get(key).push(place);
}

const aliases = {};
let matchedCities = 0;
for (const row of readFileSync(inputPath, "utf8").split(/\r?\n/)) {
  if (!row) continue;
  const parts = row.split("\t");
  const country = parts[8];
  const korean = [...new Set(parts[3].split(",").map((name) => name.trim()).filter((name) =>
    name.length >= 2 && /^[가-힣\s·ㆍ'-]+$/.test(name),
  ))];
  if (!korean.length || !country) continue;

  const lat = Number(parts[4]);
  const lon = Number(parts[5]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

  const direct = [
    ...(names.get(nameKey(country, parts[1])) ?? []),
    ...(names.get(nameKey(country, parts[2])) ?? []),
  ];
  const near = [];
  for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) {
    near.push(...(buckets.get(`${country}|${Math.floor(lat * 10) + y}|${Math.floor(lon * 10) + x}`) ?? []));
  }
  const candidates = direct.length ? direct : near;
  const ranked = candidates
    .map((place) => ({ place, distance: Math.hypot(place.latitude - lat, place.longitude - lon) }))
    .sort((a, b) => a.distance - b.distance);
  const best = ranked[0];
  if (!best || best.distance > (direct.length ? 0.5 : 0.08)) continue;

  matchedCities++;
  aliases[country] ??= {};
  for (const alias of korean) {
    aliases[country][alias] ??= [];
    const key = locationKey(best.place);
    if (!aliases[country][alias].includes(key)) aliases[country][alias].push(key);
  }
}

const outputPath = new URL("../lib/saju/korean-city-aliases.json", import.meta.url);
writeFileSync(outputPath, JSON.stringify(aliases));
const counts = Object.values(aliases).reduce((sum, country) => sum + Object.keys(country).length, 0);
console.log(`Matched ${matchedCities} cities; wrote ${counts} country-specific Korean aliases.`);
