"use client";

// Court in cm: 640 wide x 975 long, front wall at the top
const W = 640;
const L = 975;
const SHORT_LINE = 544; // distance from front wall
const BOX = 160; // service box size
const FRONT_END = 325; // front zone depth
const MID_END = SHORT_LINE + BOX; // mid zone ends at back of service boxes

const LINE = "#5d5d64";
const GUIDE = "#34343a";

const ZONES = [
  { id: "FL", label: "Front L", col: 0, y0: 0, y1: FRONT_END },
  { id: "FR", label: "Front R", col: 1, y0: 0, y1: FRONT_END },
  { id: "ML", label: "Mid L", col: 0, y0: FRONT_END, y1: MID_END },
  { id: "MR", label: "Mid R", col: 1, y0: FRONT_END, y1: MID_END },
  { id: "BL", label: "Back L", col: 0, y0: MID_END, y1: L },
  { id: "BR", label: "Back R", col: 1, y0: MID_END, y1: L },
];

export default function CourtPicker({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string | null;
  onChange: (zone: string | null) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={`transition-opacity ${disabled ? "pointer-events-none opacity-30" : ""}`}
    >
      <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted">
        {label}
      </p>

      <div className="relative w-full" style={{ aspectRatio: `${W} / ${L}` }}>
        <svg
          viewBox={`0 0 ${W} ${L}`}
          className="absolute inset-0 h-full w-full"
          aria-hidden
        >
          {/* Floor + side/back walls */}
          <rect
            x="1"
            y="1"
            width={W - 2}
            height={L - 2}
            fill="#131315"
            stroke={LINE}
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />

          {/* Faint zone guides */}
          <g
            stroke={GUIDE}
            strokeWidth="1"
            strokeDasharray="4 4"
            vectorEffect="non-scaling-stroke"
          >
            <line
              x1="0"
              y1={FRONT_END}
              x2={W}
              y2={FRONT_END}
              vectorEffect="non-scaling-stroke"
            />
            <line
              x1={W / 2}
              y1="0"
              x2={W / 2}
              y2={SHORT_LINE}
              vectorEffect="non-scaling-stroke"
            />
            <line
              x1={BOX}
              y1={MID_END}
              x2={W - BOX}
              y2={MID_END}
              vectorEffect="non-scaling-stroke"
            />
          </g>

          {/* Court markings */}
          <g stroke={LINE} strokeWidth="1.5" fill="none">
            <line
              x1="0"
              y1={SHORT_LINE}
              x2={W}
              y2={SHORT_LINE}
              vectorEffect="non-scaling-stroke"
            />
            <line
              x1={W / 2}
              y1={SHORT_LINE}
              x2={W / 2}
              y2={L}
              vectorEffect="non-scaling-stroke"
            />
            <rect
              x="0"
              y={SHORT_LINE}
              width={BOX}
              height={BOX}
              vectorEffect="non-scaling-stroke"
            />
            <rect
              x={W - BOX}
              y={SHORT_LINE}
              width={BOX}
              height={BOX}
              vectorEffect="non-scaling-stroke"
            />
          </g>

          {/* Front wall */}
          <rect x="0" y="0" width={W} height="16" fill={LINE} />
        </svg>

        {/* Tap zones */}
        {ZONES.map((z) => {
          const selected = value === z.id;
          return (
            <button
              key={z.id}
              onClick={() => onChange(selected ? null : z.id)}
              className={`absolute flex items-center justify-center text-[10px] uppercase tracking-wider transition-colors ${
                selected
                  ? "bg-accent/20 text-accent ring-1 ring-inset ring-accent/50"
                  : "text-muted/50 active:bg-white/5"
              }`}
              style={{
                left: z.col === 0 ? "0%" : "50%",
                width: "50%",
                top: `${(z.y0 / L) * 100}%`,
                height: `${((z.y1 - z.y0) / L) * 100}%`,
              }}
            >
              {z.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
