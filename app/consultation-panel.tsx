import { CHAPTERS, CHAPTER_LABELS, type Consultation } from "../lib/saju/consultation";

export default function ConsultationPanel({consultation,facts}:{consultation:Consultation;facts:{id:string;text:string}[]}) {
  return <section className="consultation-panel" aria-labelledby="consultation-title">
    <p className="result-label">어려운 사주를 내 생활의 말로</p><h2 id="consultation-title">차근차근 읽는 나의 이야기</h2>
    <p>{consultation.year}년 기준 · {consultation.chapters.length}/8장 작성됨. 처음부터 읽거나 궁금한 장을 펼쳐 보세요.</p>
    <nav className="consultation-toc" aria-label="상담 목차">{CHAPTERS.map((c,i)=><a key={c.id} href={`#consultation-${c.id}`} aria-disabled={!consultation.chapters.some(ch=>ch.id===c.id)} onClick={e=>{if(!consultation.chapters.some(ch=>ch.id===c.id)) { e.preventDefault(); return; } const target=document.getElementById(`consultation-${c.id}`); if(target instanceof HTMLDetailsElement) target.open=true;}}><span className="chapter-number">{String(i+1).padStart(2,"0")}</span>{CHAPTER_LABELS[c.id]}{!consultation.chapters.some(ch=>ch.id===c.id)?" · 작성 전":""}</a>)}</nav>
    {consultation.chapters.map((chapter,i)=><details className="consultation-chapter" id={`consultation-${chapter.id}`} key={chapter.id} open={i===0}>
      <summary>{String(CHAPTERS.findIndex(c=>c.id===chapter.id)+1).padStart(2,"0")} · {CHAPTER_LABELS[chapter.id]}</summary>
      {chapter.summary && <div className="chapter-summary"><strong>이 장에서 기억할 이야기</strong><p>{chapter.summary}</p></div>}
      {chapter.sections.map((section,j)=><article key={j}><p className="section-number">이야기 {j+1}</p><h3>{section.heading}</h3><div className="consultation-prose">{section.text.split(/\n+/).filter(Boolean).map((paragraph,i)=><p key={i}>{paragraph}</p>)}</div>
        <div className="consultation-example"><strong>생활에서는 이렇게 볼 수 있어요</strong><p>{section.example}</p></div>
        <div className="consultation-question"><p><strong>지금 해볼 일</strong>{section.action}</p><p><strong>내 경험에 비춰보기</strong>{section.question}</p></div>
        <details className="fortune-evidence"><summary>왜 이렇게 읽었나요? · 사주 근거와 다른 가능성</summary><p><strong>이런 경우에는 다르게 볼 수 있어요</strong></p><p>{section.counterpoint}</p><ul>{section.evidenceIds.map(id=><li key={id}>{facts.find(f=>f.id===id)?.text ?? "이전 계산 근거입니다. 최신 결과에서 다시 확인해 주세요."}</li>)}</ul></details>
      </article>)}
    </details>)}
  </section>;
}
