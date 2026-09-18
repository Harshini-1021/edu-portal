import { Card } from "./ui";

/**
 * Charts are hand-drawn SVG rather than a charting library.
 *
 * Two reasons, both deliberate. A library like Recharts pulls roughly 100 kB of
 * JavaScript into the client bundle and forces these components to be client
 * components; these render on the server as static markup and ship no
 * JavaScript at all. And the charts this app needs are a line and a bar — the
 * cost of a dependency is not repaid by two shapes.
 */

type Point = { label: string; value: number };

/**
 * Attendance (or any percentage) over time. Shows the trajectory, which is the
 * thing a percentage alone hides: 70% climbing and 70% falling need different
 * responses.
 */
export function TrendChart({
  points,
  threshold = 75,
  caption,
}: {
  points: Point[];
  threshold?: number;
  caption?: string;
}) {
  if (points.length < 2) {
    return (
      <Card>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Attendance trend
        </p>
        <p className="mt-3 text-sm text-slate-500">
          Not enough sessions recorded yet to show a trend.
        </p>
      </Card>
    );
  }

  const W = 320;
  const H = 96;
  const PAD = 4;
  const stepX = (W - PAD * 2) / (points.length - 1);
  const y = (v: number) => H - PAD - (Math.max(0, Math.min(100, v)) / 100) * (H - PAD * 2);

  const coords = points.map((p, i) => [PAD + i * stepX, y(p.value)] as const);
  const line = coords.map(([x, yy], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${yy.toFixed(1)}`).join(" ");
  const area = `${line} L${coords[coords.length - 1][0].toFixed(1)},${H - PAD} L${PAD},${H - PAD} Z`;

  const last = points[points.length - 1].value;
  const first = points[0].value;
  const delta = Math.round((last - first) * 10) / 10;
  const below = last < threshold;

  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Attendance trend
        </p>
        <p
          className={`text-xs font-semibold tabular-nums ${
            delta > 0 ? "text-emerald-600" : delta < 0 ? "text-rose-600" : "text-slate-500"
          }`}
        >
          {delta > 0 ? "▲" : delta < 0 ? "▼" : "—"} {Math.abs(delta)} pts
        </p>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 h-24 w-full"
        role="img"
        aria-label={`Attendance moved from ${first}% to ${last}% across ${points.length} recorded sessions.`}
      >
        <line
          x1={PAD}
          x2={W - PAD}
          y1={y(threshold)}
          y2={y(threshold)}
          stroke="currentColor"
          className="text-amber-400"
          strokeDasharray="3 3"
          strokeWidth="1"
        />
        <path d={area} className={below ? "fill-rose-100" : "fill-emerald-100"} />
        <path
          d={line}
          fill="none"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={below ? "stroke-rose-500" : "stroke-emerald-600"}
        />
        {coords.map(([x, yy], i) => (
          <circle key={i} cx={x} cy={yy} r="2" className={below ? "fill-rose-600" : "fill-emerald-700"} />
        ))}
      </svg>

      <div className="flex justify-between text-[11px] text-slate-400">
        <span>{points[0].label}</span>
        <span className="text-amber-600">{threshold}% minimum</span>
        <span>{points[points.length - 1].label}</span>
      </div>
      {caption ? <p className="mt-2 text-xs text-slate-500">{caption}</p> : null}
    </Card>
  );
}

const BAR_TONES: Record<string, string> = {
  high: "bg-rose-500",
  medium: "bg-amber-500",
  low: "bg-emerald-500",
  unknown: "bg-slate-300",
};

/**
 * Horizontal distribution bar. Used for the institution-wide risk spread, where
 * the proportion matters more than the exact count.
 */
export function DistributionBar({
  title,
  hint,
  bars,
}: {
  title: string;
  hint?: string;
  bars: { key: string; label: string; count: number }[];
}) {
  const total = bars.reduce((n, b) => n + b.count, 0);

  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{title}</p>
        {hint ? <span className="text-xs text-slate-400">{hint}</span> : null}
      </div>

      {total === 0 ? (
        <p className="mt-3 text-sm text-slate-500">No students on record yet.</p>
      ) : (
        <>
          <div
            className="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-slate-100"
            role="img"
            aria-label={bars.map((b) => `${b.count} ${b.label}`).join(", ")}
          >
            {bars
              .filter((b) => b.count > 0)
              .map((b) => (
                <div
                  key={b.key}
                  className={BAR_TONES[b.key] ?? BAR_TONES.unknown}
                  style={{ width: `${(b.count / total) * 100}%` }}
                />
              ))}
          </div>

          <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
            {bars.map((b) => (
              <li key={b.key} className="flex items-center gap-1.5 text-xs">
                <span
                  className={`inline-block h-2 w-2 shrink-0 rounded-full ${BAR_TONES[b.key] ?? BAR_TONES.unknown}`}
                />
                <span className="text-slate-600">{b.label}</span>
                <span className="ml-auto font-semibold tabular-nums text-slate-900">{b.count}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}
