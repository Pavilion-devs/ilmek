/**
 * A woven panel drawn as a 2/2 twill: each vertical warp thread passes over two weft threads, then
 * under two, shifting by one per row. That gives the diagonal rib of denim and twill fabric.
 * Ilmek means "stitch" or "loop" in Turkish, so the brand's picture is cloth itself.
 */

// Warp stripes: [colour, number of threads]. Mostly natural tones with madder and forest stripes.
const STRIPES: [string, number][] = [
  ["#efe5d3", 7],
  ["#c55838", 3],
  ["#e6d6ba", 5],
  ["#17392b", 2],
  ["#f3ecdf", 6],
  ["#d98a62", 2],
  ["#e6d6ba", 4],
  ["#2f5a45", 3],
];
const WEFT = ["#e9dcc4", "#f2e9d9"];

export function Weave({ cols = 72, rows = 26, className = "" }: { cols?: number; rows?: number; className?: string }) {
  const W = 1200;
  const H = 520;
  const w = W / cols;
  const h = H / rows;
  const warp: string[] = [];
  while (warp.length < cols) for (const [c, n] of STRIPES) for (let k = 0; k < n && warp.length < cols; k++) warp.push(c);

  const shapes: JSX.Element[] = [];
  for (let j = 0; j < rows; j++) {
    shapes.push(<rect key={`h${j}`} x={0} y={j * h + 0.6} width={W} height={h - 1.2} fill={WEFT[j % 2]} />);
  }
  for (let i = 0; i < cols; i++) {
    // Over-runs start where (i + j) % 4 === 0 and cover two rows.
    for (let j = -((i % 4) || 4); j < rows; j++) {
      if ((((i + j) % 4) + 4) % 4 !== 0) continue;
      shapes.push(<rect key={`v${i}-${j}`} x={i * w + 0.8} y={j * h + 0.8} width={w - 1.6} height={2 * h - 1.6} rx={w * 0.38} fill={warp[i]} />);
    }
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="weave-light" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.32" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#0b1a13" stopOpacity="0.22" />
        </linearGradient>
        <linearGradient id="weave-thread" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#000" stopOpacity="0.10" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.10" />
          <stop offset="1" stopColor="#000" stopOpacity="0.10" />
        </linearGradient>
        <pattern id="weave-shade" width={w} height={H} patternUnits="userSpaceOnUse">
          <rect width={w} height={H} fill="url(#weave-thread)" />
        </pattern>
      </defs>
      <rect width={W} height={H} fill="#d9c9ab" />
      {shapes}
      <rect width={W} height={H} fill="url(#weave-shade)" />
      <rect width={W} height={H} fill="url(#weave-light)" />
    </svg>
  );
}
