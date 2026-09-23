import type { CSSProperties } from "react";
import type { SajuChart } from "../lib/saju/chart";
import type { Benefactor } from "../lib/saju/benefactors";
import { buildManse, ELEMENT_NAMES, GOD_MEANINGS } from "../lib/saju/manse";

function Distribution({items,kind,center}:{items:{name:string;count:number;percent:number}[];kind:"element"|"god";center:string}) {
  let end=0;
  const colors=new Map(items.filter(i=>i.count).map((item,index)=>[item.name,kind==="element"?`var(--element-${item.name})`:`var(--god-${index%5})`]));
  const gradient=items.filter(i=>i.count).map(item=>{
    const start=end; end+=item.percent;
    return `${colors.get(item.name)} ${start}% ${end}%`;
  }).join(",");
  return <div className="distribution"><div className="distribution-ring" style={{background:`conic-gradient(${gradient})`}} aria-hidden="true"><span>{center}</span></div>
    <dl className="distribution-list">{items.map(item=><div key={item.name}><dt><i aria-hidden="true" style={{background:colors.get(item.name)??"var(--border)"}}/>{item.name}{kind==="element"?` · ${ELEMENT_NAMES[item.name]}`:<small>{GOD_MEANINGS[item.name]}</small>}</dt><dd>{item.percent.toFixed(1)}<small>% · {item.count}자</small></dd></div>)}</dl>
  </div>;
}
export default function MansePanel({chart,benefactors}:{chart:SajuChart;benefactors:Benefactor[]}) {
  const model=buildManse(chart);
  return <>
    <nav className="report-nav" aria-label="결과 바로가기"><a href="#result-title">사주표</a><a href="#manse-elements">오행·십성</a><a href="#deep-analysis-title">균형·도움</a><a href="#life-graph">인생 그래프</a><a href="#life-seasons">인생 4계절</a><a href="#flow-overview">운의 흐름</a><a href="#consultation-start">깊은 풀이</a></nav>
    <div className="manse-table-wrap" role="region" aria-label="나의 사주 네 기둥" tabIndex={0}><table className="manse-table"><caption>태어난 시·일·월·년으로 보는 네 기둥</caption><thead><tr><th scope="col">구분</th>{model.pillars.map(p=><th scope="col" className={p.label==="일주"?"my-pillar":""} key={p.label}>{p.label}<small>{({시주:"태어난 시",일주:"태어난 날 · 나",월주:"태어난 달",년주:"태어난 해"})[p.label]}</small></th>)}</tr></thead>
      <tbody>{["천간","천간 십성","지지","지지 십성","지장간","12운성","귀인"].map(row=><tr key={row}><th scope="row">{row}</th>{model.pillars.map(p=><td key={p.label} className={p.label==="일주"?"my-pillar":""}>
        {row==="천간"||row==="지지" ? <div className="manse-character" style={{"--ink":`var(--ink-${row==="천간"?p.stemElement:p.branchElement})`} as CSSProperties}><strong>{row==="천간"?p.korean[0]:p.korean[1]}<span>{row==="천간"?p.stem:p.branch}</span></strong><small>{row==="천간"?p.stemElement:p.branchElement} · {ELEMENT_NAMES[row==="천간"?p.stemElement:p.branchElement]}</small></div>
        : row==="천간 십성" ? <span title={GOD_MEANINGS[p.stemGod]}>{p.label==="일주"?"비견 · 나":p.stemGod}</span>
        : row==="지지 십성" ? <span title={GOD_MEANINGS[p.branchGod]}>{p.branchGod}</span>
        : row==="지장간" ? p.hiddenStems.map(s=><span className="hidden-stem" key={s.stem}>{s.korean}({s.stem})</span>)
        : row==="12운성" ? p.stage
        : <span className="manse-stars">{benefactors.filter(b=>b.matchedPillars.includes(p.label)).map(b=>b.name).join(" · ")||"—"}</span>}
      </td>)}</tr>)}</tbody></table></div>
    <details className="fortune-evidence"><summary>표의 용어와 계산 기준 알아보기</summary><p>천간은 위쪽 글자, 지지는 아래쪽 글자입니다. 십성은 나를 나타내는 글자와 다른 글자의 관계를 10가지로 나눈 이름입니다. 지장간은 아래쪽 글자 속에 담긴 천간이며, 지지 십성은 그중 중심 글자를 기준으로 봅니다.</p><p>12운성은 전통 명리에서 관계의 단계를 나눈 이름입니다. ‘병·사’ 같은 이름이 실제 질병이나 죽음을 뜻하지는 않습니다.</p><p>{chart.method}</p></details>
    <section className="manse-benefactors"><h3>나를 돕는 인연의 단서 <small>귀인</small></h3><p>현재 계산하는 귀인 4종을 함께 살펴보세요.</p><div className="star-chips">{benefactors.map(b=><details key={b.name}><summary>{b.name}<span>{b.matchedPillars.length?b.matchedPillars.join(" · "):"해당 없음"}</span></summary><p>{b.description}</p><p className="method-help">{b.basis}</p></details>)}</div><p className="method-help">귀인이 있다고 반드시 도움을 받거나, 없다고 도움받지 못하는 것은 아닙니다. 참고 자료와 계산 범위·유파가 다를 수 있습니다.</p></section>
    <section id="manse-elements" className="manse-elements"><p className="result-label">나를 이루는 다섯 가지 성질</p><h3>오행과 십성을 한눈에</h3><p>오행은 나무·불·흙·금속·물, 십성은 나와 주변의 관계를 읽는 이름입니다.</p><div className="distribution-grid"><article><h4>오행 비율</h4><Distribution items={model.elements} kind="element" center={`${chart.dayMaster.korean}${chart.dayMaster.element}`}/></article><article><h4>십성 비율</h4><Distribution items={model.gods} kind="god" center="나와의 관계"/></article></div><p className="method-help">네 기둥의 대표 8글자를 센 비율입니다. 십성은 일간을 비견으로, 지지는 본기로 셉니다. 계절·지장간 가중치나 합에 따른 변화는 이 비율에 적용하지 않으며, 아래 강약 분석과는 다른 값입니다.</p></section>
  </>;
}
