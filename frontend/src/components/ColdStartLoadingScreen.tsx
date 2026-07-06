"use client";

import { useEffect, useState } from "react";

type Step = { label: string; detail: string };

type Variant = "dashboard" | "trends";

const VARIANT_CONFIG: Record<
  Variant,
  { title: string; subtitle: string; steps: Step[] }
> = {
  dashboard: {
    title: "Loading executive overview",
    subtitle:
      "Fetching the latest synthesis, KPIs, and executive summary from the insights API.",
    steps: [
      {
        label: "Connecting to insights API",
        detail: "Establishing a link to the cloud backend",
      },
      {
        label: "Waking cloud backend",
        detail: "Free-tier hosting may sleep when idle — cold start can take 30–60 seconds",
      },
      {
        label: "Loading review corpus & KPIs",
        detail: "Aggregating live counts from the database",
      },
      {
        label: "Preparing executive summary",
        detail: "Pulling narrative, pain points, and question previews",
      },
    ],
  },
  trends: {
    title: "Loading review trends",
    subtitle: "Fetching sentiment and rating timelines from the insights API.",
    steps: [
      {
        label: "Connecting to insights API",
        detail: "Establishing a link to the cloud backend",
      },
      {
        label: "Waking cloud backend",
        detail: "Free-tier hosting may sleep when idle — cold start can take 30–60 seconds",
      },
      {
        label: "Building trend timeline",
        detail: "Bucketed sentiment and ratings from Jan 2026 onward",
      },
    ],
  },
};

/** Advance steps over time while the real fetch is in flight (cold start has no server signal). */
function activeStepForElapsed(elapsedMs: number, totalSteps: number): number {
  if (elapsedMs < 6_000) return 1;
  if (elapsedMs < 18_000) return Math.min(2, totalSteps);
  if (elapsedMs < 35_000) return Math.min(3, totalSteps);
  return totalSteps;
}

function formatElapsed(ms: number): string {
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}m ${sec % 60}s`;
}

function ProgressSpinner() {
  return (
    <svg className="w-20 h-20 mx-auto mb-6 animate-spin" viewBox="0 0 50 50" aria-hidden>
      <circle
        className="opacity-20"
        cx="25"
        cy="25"
        r="20"
        fill="none"
        stroke="#1DB954"
        strokeWidth="4"
      />
      <circle
        cx="25"
        cy="25"
        r="20"
        fill="none"
        stroke="#1DB954"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray="90, 150"
      />
    </svg>
  );
}

type Props = {
  variant?: Variant;
};

export function ColdStartLoadingScreen({ variant = "dashboard" }: Props) {
  const config = VARIANT_CONFIG[variant];
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    const started = Date.now();
    const id = setInterval(() => setElapsedMs(Date.now() - started), 1000);
    return () => clearInterval(id);
  }, []);

  const activeStep = activeStepForElapsed(elapsedMs, config.steps.length);
  const showHoldOn = elapsedMs >= 8_000;
  const showStillWorking = elapsedMs >= 28_000;

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4 md:p-10">
      <div className="glass-panel rounded-2xl p-8 md:p-10 max-w-lg w-full text-center relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-40 h-40 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <ProgressSpinner />
          <h1 className="text-2xl font-semibold mb-2 text-on-surface">{config.title}</h1>
          <p className="text-[15px] text-on-surface-variant mb-6">{config.subtitle}</p>

          <div
            className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-left"
            role="status"
          >
            <p className="text-[13px] font-medium text-amber-200/90 flex items-start gap-2">
              <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5">info</span>
              <span>
                The API runs on Render&apos;s free tier and sleeps when idle. After inactivity,
                the first load usually takes{" "}
                <strong className="font-semibold text-amber-100">30 seconds to 1 minute</strong>.
                Please hold on — your dashboard will appear automatically.
              </span>
            </p>
          </div>

          <div className="space-y-3 text-left mb-6">
            {config.steps.map((step, i) => {
              const stepNum = i + 1;
              const done = stepNum < activeStep;
              const current = stepNum === activeStep;
              return (
                <div
                  key={step.label}
                  className={`flex items-start gap-3 text-[14px] transition-colors duration-300 ${
                    done || current ? "text-primary" : "text-text-muted"
                  }`}
                >
                  <span
                    className={`material-symbols-outlined text-[20px] shrink-0 mt-0.5 ${
                      current ? "animate-spin" : ""
                    }`}
                  >
                    {done ? "check_circle" : current ? "sync" : "radio_button_unchecked"}
                  </span>
                  <div>
                    <p className="font-medium">{step.label}</p>
                    <p className="text-[12px] text-text-muted mt-0.5">{step.detail}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="space-y-2 text-[13px] text-text-muted">
            <p className="tabular-nums">Elapsed: {formatElapsed(elapsedMs)}</p>
            {showHoldOn && !showStillWorking && (
              <p className="text-primary/90 animate-pulse">Waking backend — thanks for waiting…</p>
            )}
            {showStillWorking && (
              <p className="text-primary/90">
                Still working — cold starts can take up to a minute. Almost there…
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
