export const reportPages = [
  { id: "chart", label: "사주표" },
  { id: "daily", label: "오늘의 운세" },
  { id: "elements", label: "오행·십성" },
  { id: "balance", label: "균형·도움" },
  { id: "graph", label: "인생 그래프" },
  { id: "seasons", label: "인생 4계절" },
  { id: "flow", label: "운의 흐름" },
  { id: "domains", label: "생활 운" },
] as const;

export type ReportPage = "input" | (typeof reportPages)[number]["id"];

const oldHashes: Record<string, ReportPage> = {
  "result-title": "chart",
  "pillar-reading-title": "chart",
  "reading-title": "chart",
  "daily-fortune": "daily",
  "manse-elements": "elements",
  "deep-analysis-title": "balance",
  "life-graph": "graph",
  "life-seasons": "seasons",
  "flow-overview": "flow",
  "fortune-lifetime": "flow",
  "fortune-annual": "flow",
  "fortune-domains": "domains",
};

export function reportPageFromUrl(url: URL): ReportPage {
  const view = url.searchParams.get("view");
  if (view === "input" || reportPages.some((page) => page.id === view)) return view as ReportPage;
  let hash = url.hash.slice(1);
  try { hash = decodeURIComponent(hash); } catch { /* Treat malformed fragments as unknown. */ }
  if (hash.startsWith("fortune-domain-")) return "domains";
  return oldHashes[hash] ?? "chart";
}

export function reportPageUrl(current: URL, page: ReportPage): string {
  const url = new URL(current);
  url.searchParams.set("view", page);
  url.hash = "";
  return `${url.pathname}${url.search}`;
}
