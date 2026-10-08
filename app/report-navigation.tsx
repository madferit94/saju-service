"use client";

import type { MouseEvent } from "react";
import { reportPages, type ReportPage } from "../lib/report-pages";

export default function ReportNavigation({ activePage, onNavigate }: {
  activePage: ReportPage;
  onNavigate: (page: ReportPage) => void;
}) {
  function follow(event: MouseEvent<HTMLAnchorElement>, page: ReportPage) {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onNavigate(page);
  }

  return <nav className="result-page-nav" aria-label="사주 결과 항목">
    <div className="result-page-nav-heading"><strong><span className="journey-lantern-mark" aria-hidden="true">✦</span> 내 사주 읽기</strong><a href="?view=input" onClick={(event) => follow(event, "input")} aria-current={activePage === "input" ? "page" : undefined}>출생 정보·보관함</a></div>
    <div className="result-page-nav-list">
      {reportPages.map((page) => <a key={page.id} href={`?view=${page.id}`} onClick={(event) => follow(event, page.id)} aria-current={activePage === page.id ? "page" : undefined}>{page.label}</a>)}
    </div>
  </nav>;
}
