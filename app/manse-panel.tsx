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
export default function MansePanel({chart,benefactors,mode="all"}:{chart:SajuChart;benefactors:Benefactor[];mode?:"all"|"chart"|"elements"}) {
  const model=buildManse(chart);
  return <>
    {mode!=="elements" && <>
    <div className="manse-table-wrap" role="region" aria-label="나의 사주 네 기둥" tabIndex={0}><table className="manse-table"><caption>태어난 시·일·월·년으로 보는 네 기둥</caption><thead><tr><th scope="col">구분</th>{model.pillars.map(p=><th scope="col" className={p.label==="일주"?"my-pillar":""} key={p.label}>{p.label}<small>{({시주:"태어난 시",일주:"태어난 날 · 나",월주:"태어난 달",년주:"태어난 해"})[p.label]}</small></th>)}</tr></thead>
      <tbody>{["천간","천간 십성","지지","지지 십성","지장간","12운성","귀인"].map(row=><tr key={row}><th scope="row">{row}</th>{model.pillars.map(p=><td key={p.label} className={p.label==="일주"?"my-pillar":""}>
        {row==="천간"||row==="지지" ? <div className="manse-character" style={{"--ink":`var(--ink-${row==="천간"?p.stemElement:p.branchElement})`} as CSSProperties}><strong>{row==="천간"?p.korean[0]:p.korean[1]}<span>{row==="천간"?p.stem:p.branch}</span></strong><small>{row==="천간"?p.stemElement:p.branchElement} · {ELEMENT_NAMES[row==="천간"?p.stemElement:p.branchElement]}</small></div>
        : row==="천간 십성" ? <span title={GOD_MEANINGS[p.stemGod]}>{p.label==="일주"?"비견 · 나":p.stemGod}</span>
        : row==="지지 십성" ? <span title={GOD_MEANINGS[p.branchGod]}>{p.branchGod}</span>
        : row==="지장간" ? p.hiddenStems.map(s=><span className="hidden-stem" key={s.stem}>{s.korean}({s.stem})</span>)
        : row==="12운성" ? p.stage
        : <span className="manse-stars">{benefactors.filter(b=>b.matchedPillars.includes(p.label)).map(b=>b.name).join(" · ")||"—"}</span>}
      </td>)}</tr>)}</tbody></table></div>
    <section className="manse-benefactors"><h3>나를 돕는 인연의 단서 <small>귀인</small></h3><p>네 기둥에서 나타난 귀인을 살펴보세요.</p><div className="star-chips">{benefactors.map(b=><div className="star-chip" key={b.name}><strong>{b.name}</strong><span>{b.matchedPillars.length?b.matchedPillars.join(" · "):"해당 없음"}</span></div>)}</div></section>
    </>}
    {mode!=="chart" && <section id="manse-elements" className="manse-elements"><p className="result-label">나를 이루는 다섯 가지 성질</p>{mode==="elements"?<h2>오행과 십성을 한눈에</h2>:<h3>오행과 십성을 한눈에</h3>}<p>오행은 나무·불·흙·금속·물, 십성은 나와 주변의 관계를 읽는 이름입니다.</p><div className="distribution-grid"><article><h4>오행 비율</h4><Distribution items={model.elements} kind="element" center={`${chart.dayMaster.korean}${chart.dayMaster.element}`}/></article><article><h4>십성 비율</h4><Distribution items={model.gods} kind="god" center="나와의 관계"/></article></div><p className="method-help">네 기둥의 대표 여덟 글자를 센 비율입니다.</p></section>}
  </>;
}
