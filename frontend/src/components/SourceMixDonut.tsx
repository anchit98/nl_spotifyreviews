"use client";

import { SOURCE_LABELS } from "@/lib/types";
import { formatNumber } from "@/lib/utils";

const SEGMENT_COLORS = [
  "var(--color-primary-container)",
  "var(--color-secondary-container)",
  "var(--color-surface-high)",
  "var(--color-text-muted)",
  "var(--color-status-warning)",
];

const LEGEND_SWATCH = [
  "bg-primary-container",
  "bg-secondary-container",
  "bg-surface-high border border-border-subtle",
  "bg-text-muted",
  "bg-status-warning",
];

function buildConicGradient(
  entries: [string, number][],
  total: number,
): string {
  if (total <= 0) {
    return "conic-gradient(var(--color-surface-container-highest) 0% 100%)";
  }

  let acc = 0;
  const stops = entries.map(([, count], i) => {
    const start = acc;
    acc += (count / total) * 100;
    return `${SEGMENT_COLORS[i % SEGMENT_COLORS.length]} ${start}% ${acc}%`;
  });
  return `conic-gradient(${stops.join(", ")})`;
}

type SourceMixDonutProps = {
  bySource: Record<string, number>;
  total?: number;
  title?: string;
  onSourceClick?: (source: string) => void;
  activeSource?: string | null;
};

export function SourceMixDonut({
  bySource,
  total: totalOverride,
  title = "Mentions by source",
  onSourceClick,
  activeSource = null,
}: SourceMixDonutProps) {
  const entries = Object.entries(bySource).sort(([, a], [, b]) => b - a);
  const total =
    totalOverride ?? entries.reduce((sum, [, count]) => sum + count, 0);

  return (
    <div className="flex flex-col h-full min-h-0">
      {title ? (
        <h3 className="text-[13px] text-text-muted mb-3 shrink-0">{title}</h3>
      ) : null}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 flex items-center justify-center min-h-[140px] py-1">
          <div className="relative aspect-square h-full max-h-[220px] w-full max-w-[220px]">
            <div
              className="w-full h-full rounded-full"
              style={{ background: buildConicGradient(entries, total) }}
            />
            <div className="absolute inset-[14%] bg-surface-low rounded-full flex flex-col items-center justify-center border border-border-subtle shadow-inner">
              <span className="text-[11px] sm:text-[13px] text-text-muted">Total</span>
              <span className="text-[18px] sm:text-[22px] font-semibold text-on-surface leading-none">
                {total >= 1000 ? `${(total / 1000).toFixed(1)}k` : formatNumber(total)}
              </span>
            </div>
          </div>
        </div>
        <div className="w-full shrink-0 space-y-2 pt-3 border-t border-border-subtle/60">
          {entries.map(([source, count], i) => {
            const pct = total ? Math.round((count / total) * 100) : 0;
            const active = activeSource === source;
            const label = SOURCE_LABELS[source] ?? source;

            const row = (
              <>
                <div className="flex items-center gap-2 min-w-0">
                  <div className={`w-3 h-3 rounded-sm shrink-0 ${LEGEND_SWATCH[i % LEGEND_SWATCH.length]}`} />
                  <span
                    className={`text-[13px] sm:text-[14px] truncate ${
                      active ? "text-primary font-medium" : "text-on-surface"
                    } ${onSourceClick ? "group-hover:text-primary-container transition-colors" : ""}`}
                    title={label}
                  >
                    {label}
                  </span>
                </div>
                <span className="text-[12px] sm:text-[13px] text-text-muted shrink-0 ml-2">
                  {pct}% ({formatNumber(count)})
                </span>
              </>
            );

            if (onSourceClick) {
              return (
                <button
                  key={source}
                  type="button"
                  onClick={() => onSourceClick(source)}
                  className={`w-full flex items-center justify-between text-left group rounded-md px-1 -mx-1 transition-colors ${
                    active ? "bg-primary/5" : "hover:bg-surface-high"
                  }`}
                >
                  {row}
                </button>
              );
            }

            return (
              <div key={source} className="flex items-center justify-between">
                {row}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
