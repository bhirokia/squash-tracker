// Same court geometry as CourtPicker (cm, front wall at the top)
const W = 640;
const L = 975;
const SHORT_LINE = 544;
const BOX = 160;
const FRONT_END = 325;
const MID_END = SHORT_LINE + BOX;

const LINE = "#5d5d64";
const GUIDE = "#34343a";

const ZONES = [
  { id: "FL", col: 0, y0: 0, y1: FRONT_END },
  { id: "FR", col: 1, y0: 0, y1: FRONT_END },
  { id: "ML", col: 0, y0: FRONT_END, y1: MID_END },
  { id: "MR", col: 1, y0: FRONT_END, y1: MID_END },
  { id: "BL", col: 0, y0: MID_END, y1: L },
  { id: "BR", col: 1, y0: MID_END, y1: L },
];

export default function CourtHeatmap({
  title,
  counts,
  total,
  tone = "accent",
}: {
  title: string;
  counts: Record<string, number>;
  total: number;
  tone?: "accent" | "red";
}) {
  const max = Math.max(1, ...Object.values(counts));
  const rgb = tone === "red" ? "248, 113, 113" : "139, 167, 199"; // red-400 / accent

  return (
    <div>
      <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted">{title}</p>
      <div className="relative w-full" style={{ aspectRatio: `${W} / ${L}` }}>
        <svg viewBox={`0 0 ${W} ${L}`} className="absolute inset-0 h-full w-full" aria-hidden>
          <rect x="1" y="1" width={W - 2} height={L - 2} fill="#131315" />

          {/* Zone fills: stronger colour = bigger share */}
          {ZONES.map((z) => {
            const c = counts[z.id] ?? 0;
            const strength = total ? c / max : 0;
            return (
              <rect
                key={z.id}
                x={z.col === 0 ? 0 : W / 2}
                y={z.y0}
                width={W / 2}
                height={z.y1 - z.y0}
                fill={`rgba(${rgb}, ${c ? 0.08 + strength * 0.5 : 0})`}
              />
            );
          })}

          <g stroke={GUIDE} strokeWidth="1" strokeDasharray="4 4">
            <line x1="0" y1={FRONT_END} x2={W} y2={FRONT_END} vectorEffect="non-scaling-stroke" />
            <line x1={W / 2} y1="0" x2={W / 2} y2={SHORT_LINE} vectorEffect="non-scaling-stroke" />
            <line x1={BOX} y1={MID_END} x2={W - BOX} y2={MID_END} vectorEffect="non-scaling-stroke" />
          </g>

          <g stroke={LINE} strokeWidth="1.5" fill="none">
            <rect x="1" y="1" width={W - 2} height={L - 2} strokeWidth="2" vectorEffect="non-scaling-stroke" />
            <line x1="0" y1={SHORT_LINE} x2={W} y2={SHORT_LINE} vectorEffect="non-scaling-stroke" />
            <line x1={W / 2} y1={SHORT_LINE} x2={W / 2} y2={L} vectorEffect="non-scaling-stroke" />
            <rect x="0" y={SHORT_LINE} width={BOX} height={BOX} vectorEffect="non-scaling-stroke" />
            <rect x={W - BOX} y={SHORT_LINE} width={BOX} height={BOX} vectorEffect="non-scaling-stroke" />
          </g>

          <rect x="0" y="0" width={W} height="16" fill={LINE} />
        </svg>

        {/* Percentage labels */}
        {ZONES.map((z) => {
          const c = counts[z.id] ?? 0;
          return (
            <div
              key={z.id}
              className="absolute flex flex-col items-center justify-center"
              style={{
                left: z.col === 0 ? "0%" : "50%",
                width: "50%",
                top: `${(z.y0 / L) * 100}%`,
                height: `${((z.y1 - z.y0) / L) * 100}%`,
              }}
            >
              <span className={`text-base font-semibold tabular-nums ${c ? "text-fg" : "text-muted/40"}`}>
                {total ? `${Math.round((c / total) * 100)}%` : "–"}
              </span>
              {c > 0 && <span className="text-[10px] tabular-nums text-muted">{c}</span>}
            </div>
          );
        })}
      </div>
      <p className="mt-1 text-[11px] text-muted">
        {total ? `${total} with a zone recorded` : "No zones recorded yet"}
      </p>
    </div>
  );
}
