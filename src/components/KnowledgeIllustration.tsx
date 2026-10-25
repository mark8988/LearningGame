import { ArrowRight, Bird, Bug, Droplets, Fish, Leaf, Magnet, MoveHorizontal, MoveVertical, Snowflake, Sprout, Thermometer, Wind } from 'lucide-react';
const diagrams = {
  plant: [[Sprout, '根吸收水分'], [MoveVertical, '莖運送水分'], [Leaf, '葉製造養分']],
  animal: [[Bird, '鳥類・羽毛'], [Bug, '昆蟲・六隻腳'], [Fish, '魚・鰓與鰭']],
  weather: [[Thermometer, '氣溫・°C'], [Droplets, '降雨・毫米'], [Wind, '風向・來向']],
  magnet: [[Magnet, '同極相斥'], [MoveHorizontal, '推拉是施力'], [Magnet, '異極相吸']],
  water: [[Snowflake, '冰・固態'], [Droplets, '水・液態'], [Wind, '水蒸氣・氣態']],
} as const;
export function KnowledgeIllustration({ theme }: { theme: keyof typeof diagrams }) {
  return <div className={`knowledge-illustration ${theme}`} role="img" aria-label={diagrams[theme].map(([, label]) => label).join('，')}>{diagrams[theme].map(([Icon, label], index) => <div key={label}><span><Icon size={30} strokeWidth={1.4} /><b>{label}</b></span>{index < 2 && <ArrowRight size={15} />}</div>)}</div>;
}
