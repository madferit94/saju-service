import { CHAPTERS, type Consultation } from "../lib/saju/consultation";

export default function ConsultationPanel({consultation,facts}:{consultation:Consultation;facts:{id:string;text:string}[]}) {
  return <section className="consultation-panel" aria-labelledby="consultation-title">
    <p className="result-label">근거부터 삶의 선택까지</p><h2 id="consultation-title">나를 깊이 읽는 사주 상담</h2>
    <p>{consultation.year}년 기준 · {consultation.chapters.length}/8장 작성됨. 처음부터 읽거나 궁금한 장을 펼쳐 보세요.</p>
    <nav className="consultation-toc" aria-label="상담 목차">{CHAPTERS.map((c,i)=><a key={c.id} href={`#consultation-${c.id}`} aria-disabled={!consultation.chapters.some(ch=>ch.id===c.id)} onClick={e=>{if(!consultation.chapters.some(ch=>ch.id===c.id)) { e.preventDefault(); return; } const target=document.getElementById(`consultation-${c.id}`); if(target instanceof HTMLDetailsElement) target.open=true;}}>{i+1}. {c.title}{!consultation.chapters.some(ch=>ch.id===c.id)?" · 작성 전":""}</a>)}</nav>
    {consultation.chapters.map((chapter,i)=><details className="consultation-chapter" id={`consultation-${chapter.id}`} key={chapter.id} open={i===0}>
      <summary>{CHAPTERS.findIndex(c=>c.id===chapter.id)+1}. {chapter.title}</summary>
      {chapter.sections.map((section,j)=><article key={j}><h3>{section.heading}</h3><p className="consultation-prose">{section.text}</p>
        <details className="fortune-evidence"><summary>이 풀이가 출발한 사주 근거</summary><ul>{section.evidenceIds.map(id=><li key={id}>{facts.find(f=>f.id===id)?.text ?? "이전 계산 근거입니다. 최신 결과에서 다시 확인해 주세요."}</li>)}</ul></details>
        <div className="consultation-aside"><p><strong>반대로 볼 조건</strong>{section.counterpoint}</p><p><strong>생활 속 가정 예시</strong>{section.example}</p></div>
        <div className="consultation-question"><p><strong>경험과 비교할 질문</strong>{section.question}</p><p><strong>내 선택에 적용하기</strong>{section.action}</p></div>
      </article>)}
    </details>)}
  </section>;
}
