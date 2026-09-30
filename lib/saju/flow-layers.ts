import type { SajuChart } from "./chart";
import { combineFlow } from "./flow-combination";

export function describeFlowLayers(chart: SajuChart, target: string, extra: {label:string;ganji:string}[], label = "이번 시기") {
  const layers = [...extra, {label,ganji:target}].map(layer => {
    const {rule} = combineFlow(chart, layer.ganji);
    return {...layer, group:rule.group, theme:rule.theme, ruleId:rule.id};
  });
  const current = layers[layers.length-1];
  const parent = layers.at(-2);
  const relation = !parent ? "standalone" : current.group === parent.group ? "reinforcing" : "shifting";
  const narrative = !parent ? `${label}에는 ${current.theme}의 주제를 원래의 생활 방식과 비교해 보세요.`
    : layers.map((p,i) => `${i === layers.length-1 ? "지금 살필 " : "배경이 되는 "}${p.label}에서는 ${p.theme}`).join(", ") +
      (relation === "reinforcing" ? "의 주제가 이어집니다. 새 일을 더하기보다 이어오던 일의 완성도를 높일 조건을 살펴보세요." : "의 주제가 겹칩니다. 긴 흐름의 일을 유지하면서 이번 시기에 필요한 역할을 따로 배치해 보세요.");
  return { layers, relation, narrative };
}
