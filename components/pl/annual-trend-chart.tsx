type TrendPoint = {
  label: string;
  primaryValue: number;
  secondaryValue?: number;
};

type Props = {
  title: string;
  subtitle: string;
  primaryLabel: string;
  secondaryLabel?: string;
  points: TrendPoint[];
  primaryColor?: string;
  secondaryColor?: string;
};

function buildPath(values: number[], width: number, height: number) {
  if (values.length === 0) return "";
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  return values
    .map((value, index) => {
      const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

export function AnnualTrendChart({
  title,
  subtitle,
  primaryLabel,
  secondaryLabel,
  points,
  primaryColor = "#0f766e",
  secondaryColor = "#94a3b8",
}: Props) {
  const width = 520;
  const height = 180;
  const primaryPath = buildPath(points.map((point) => point.primaryValue), width, height);
  const secondaryValues = points.map((point) => point.secondaryValue).filter((value): value is number => value !== undefined);
  const secondaryPath = secondaryValues.length === points.length ? buildPath(points.map((point) => point.secondaryValue ?? 0), width, height) : "";

  return (
    <article className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-950">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-slate-500">
          <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: primaryColor }} />{primaryLabel}</span>
          {secondaryLabel ? <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: secondaryColor }} />{secondaryLabel}</span> : null}
        </div>
      </div>
      <div className="mt-5 overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height + 32}`} className="h-56 w-full min-w-[520px]">
          <g transform="translate(0 8)">
            <line x1="0" y1={height} x2={width} y2={height} stroke="#cbd5e1" strokeWidth="1" />
            {primaryPath ? <path d={primaryPath} fill="none" stroke={primaryColor} strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" /> : null}
            {secondaryPath ? <path d={secondaryPath} fill="none" stroke={secondaryColor} strokeWidth="3" strokeDasharray="8 6" strokeLinejoin="round" strokeLinecap="round" /> : null}
            {points.map((point, index) => {
              const x = points.length === 1 ? width / 2 : (index / (points.length - 1)) * width;
              return (
                <g key={point.label} transform={`translate(${x}, 0)`}>
                  <text y={height + 24} textAnchor="middle" className="fill-slate-500 text-[11px]">{point.label}</text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>
    </article>
  );
}
