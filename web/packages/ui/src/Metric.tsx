import { variants } from "./theme/variants";
export function Metric({ label, value, unit }: { label: string; value: string; unit: string }) { return <div className={variants.metric.row}><dt className={variants.metric.term}>{label}</dt><dd className={variants.metric.definition}><span className={variants.metric.value}>{value}</span><i className={variants.metric.unit}>{unit}</i></dd></div>; }
