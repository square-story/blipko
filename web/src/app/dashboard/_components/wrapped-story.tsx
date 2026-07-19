"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { X, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { Confetti } from "@/components/ui/confetti";
import { AnimatedNumber } from "@/components/animated-number";
import { formatMoney, BUCKET_META } from "@/lib/budget";
import { useWarpDialogContext } from "@/components/ui/warp-dialog";
import type { WrappedStats } from "@/lib/actions/wrapped";
import { cn } from "@/lib/utils";

// One restrained ink surface for every slide + a single saffron accent. Fixed
// hex (not oklch tokens) so the exported PNG is identical everywhere.
const INK = "#0E0E12";
const SAFFRON = "#E9A23C";
const SAFFRON_RGB = "233,162,60";
// Subtle shared background: near-black + one faint saffron glow. Not 7 gradients.
const CARD_BG = `radial-gradient(115% 75% at 18% 0%, rgba(${SAFFRON_RGB},0.14), transparent 55%), ${INK}`;

// Bucket bars stay one accent, three tints — minimal but distinguishable.
const BUCKET_ALPHA: Record<string, number> = {
  NEEDS: 1,
  WANTS: 0.6,
  SAVINGS: 0.32,
};

const slideVariants = {
  enter: (dir: number) => ({ x: dir >= 0 ? 40 : -40, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir >= 0 ? -40 : 40, opacity: 0 }),
};

type Slide = { key: string; content: React.ReactNode };

const Label = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/45">
    {children}
  </p>
);

const Hero = ({ children }: { children: React.ReactNode }) => (
  <div
    className="text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl"
    style={{ color: SAFFRON }}
  >
    {children}
  </div>
);

const Wordmark = () => (
  <div className="flex items-center gap-2 text-white/70">
    <span
      className="h-1.5 w-1.5 rounded-full"
      style={{ backgroundColor: SAFFRON }}
    />
    <span className="text-sm font-semibold tracking-tight text-white/90">
      blipko
    </span>
    <span className="text-xs text-white/45">Wrapped</span>
  </div>
);

export function WrappedStory({ stats }: { stats: WrappedStats }) {
  const { setOpen } = useWarpDialogContext();
  const cardRef = React.useRef<HTMLDivElement>(null);
  const [[current, dir], setState] = React.useState<[number, number]>([0, 0]);
  const [downloading, setDownloading] = React.useState(false);

  const money = React.useCallback(
    (n: number) => formatMoney(n, stats.currency),
    [stats.currency],
  );
  const numFormat = React.useMemo(
    () => ({
      style: "currency" as const,
      currency: stats.currency,
      maximumFractionDigits: 0,
    }),
    [stats.currency],
  );

  const slides = React.useMemo<Slide[]>(() => {
    const list: Slide[] = [];

    // 1. Intro
    list.push({
      key: "intro",
      content: (
        <div className="flex h-full flex-col justify-center gap-4">
          <Label>
            {stats.monthLabel} {stats.year}
          </Label>
          <h1 className="text-3xl font-semibold leading-[1.1] tracking-tight text-white sm:text-4xl">
            Your month,
            <br />
            wrapped.
          </h1>
          <span className="h-px w-10" style={{ backgroundColor: SAFFRON }} />
          <p className="text-sm text-white/55">
            A quiet look at where your money went.
          </p>
        </div>
      ),
    });

    // 2. Total spent
    list.push({
      key: "spent",
      content: (
        <div className="flex h-full flex-col justify-center gap-3">
          <Label>
            {stats.txnCount > 0 ? `In ${stats.monthLabel} you spent` : "You spent"}
          </Label>
          <Hero>
            <AnimatedNumber value={stats.totalSpent} format={numFormat} />
          </Hero>
          <p className="text-sm text-white/55">
            across{" "}
            <span className="font-medium text-white/80">{stats.txnCount}</span>{" "}
            {stats.txnCount === 1 ? "transaction" : "transactions"}
          </p>
        </div>
      ),
    });

    // 3. Bucket split
    if (stats.totalSpent > 0) {
      list.push({
        key: "split",
        content: (
          <div className="flex h-full flex-col justify-center gap-6">
            <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Where it went
            </h2>
            <div className="flex flex-col gap-4">
              {stats.bucketSplit.map((s) => (
                <div key={s.bucket} className="flex flex-col gap-1.5">
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="text-white/70">
                      {BUCKET_META[s.bucket].label}
                    </span>
                    <span className="tabular-nums text-white/50">{s.pct}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                    <motion.div
                      className="h-full rounded-full"
                      style={{
                        backgroundColor: `rgba(${SAFFRON_RGB},${BUCKET_ALPHA[s.bucket]})`,
                      }}
                      initial={{ width: 0 }}
                      animate={{ width: `${s.pct}%` }}
                      transition={{ duration: 0.7, ease: [0.23, 1, 0.32, 1] }}
                    />
                  </div>
                  <span className="text-xs tabular-nums text-white/40">
                    {money(s.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ),
      });
    }

    // 4. Top category
    if (stats.topCategory) {
      const tc = stats.topCategory;
      list.push({
        key: "category",
        content: (
          <div className="flex h-full flex-col justify-center gap-3">
            <Label>Top category</Label>
            {tc.icon && <div className="text-5xl sm:text-6xl">{tc.icon}</div>}
            <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              {tc.name}
            </h2>
            <p className="text-sm text-white/55">
              <span className="tabular-nums font-medium text-white/80">
                {money(tc.amount)}
              </span>{" "}
              spent here
            </p>
          </div>
        ),
      });
    }

    // 5. Biggest splurge
    if (stats.biggestExpense) {
      const be = stats.biggestExpense;
      list.push({
        key: "splurge",
        content: (
          <div className="flex h-full flex-col justify-center gap-3">
            <Label>Biggest splurge</Label>
            <h2 className="text-xl font-medium leading-snug tracking-tight text-white/85 sm:text-2xl">
              {be.label}
            </h2>
            <Hero>{money(be.amount)}</Hero>
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">
              {be.category}
            </p>
          </div>
        ),
      });
    }

    // 6. Savings
    const saved = stats.netSaved;
    list.push({
      key: "savings",
      content: (
        <div className="flex h-full flex-col justify-center gap-3">
          {saved >= 0 ? (
            <>
              <Label>You banked</Label>
              <Hero>
                <AnimatedNumber value={saved} format={numFormat} />
              </Hero>
              <p className="text-sm text-white/55">
                <span className="font-medium text-white/80">
                  {stats.savingsRatePct}%
                </span>{" "}
                of everything you earned
              </p>
            </>
          ) : (
            <>
              <Label>You outspent income by</Label>
              <Hero>{money(Math.abs(saved))}</Hero>
              <p className="text-sm text-white/55">
                Next month&apos;s the comeback.
              </p>
            </>
          )}
        </div>
      ),
    });

    // 7. Final share card
    list.push({
      key: "final",
      content: (
        <div className="flex h-full flex-col justify-between">
          <div className="flex flex-col gap-3">
            <Label>
              My {stats.monthLabel} {stats.year}
            </Label>
            <h2 className="text-3xl font-semibold tracking-tight text-white">
              Wrapped.
            </h2>
            <span className="h-px w-10" style={{ backgroundColor: SAFFRON }} />
          </div>

          <div className="flex flex-col divide-y divide-white/10">
            <FinalRow label="Spent" value={money(stats.totalSpent)} />
            <FinalRow
              label="Saved"
              value={
                stats.netSaved >= 0
                  ? `${money(stats.netSaved)} · ${stats.savingsRatePct}%`
                  : `−${money(Math.abs(stats.netSaved))}`
              }
            />
            {stats.topCategory && (
              <FinalRow
                label="Top category"
                value={`${stats.topCategory.icon ?? ""} ${stats.topCategory.name}`.trim()}
              />
            )}
            <FinalRow label="Transactions" value={String(stats.txnCount)} />
          </div>

          <div className="flex items-center justify-between">
            <Wordmark />
            <span className="text-[11px] text-white/40">tracked on Telegram</span>
          </div>
        </div>
      ),
    });

    return list;
  }, [stats, money, numFormat]);

  const last = slides.length - 1;
  const isFinal = current === last;

  const go = React.useCallback(
    (delta: number) =>
      setState(([c]) => {
        const n = Math.min(Math.max(c + delta, 0), slides.length - 1);
        return [n, delta];
      }),
    [slides.length],
  );

  const close = () => setOpen(false);

  async function handleDownload() {
    if (!cardRef.current || downloading) return;
    setDownloading(true);
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(cardRef.current, {
        pixelRatio: 2,
        cacheBust: true,
        // Skip the in-card controls so the exported image is pure content.
        filter: (node) =>
          !(node instanceof HTMLElement && node.dataset.export === "skip"),
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `blipko-${stats.monthLabel.toLowerCase()}-${stats.year}-wrapped.png`;
      a.click();
    } catch (err) {
      console.error("Wrapped export failed:", err);
    } finally {
      setDownloading(false);
    }
  }

  const active = slides[current];

  return (
    <div className="relative isolate w-[min(88vw,340px)]">
      <div
        ref={cardRef}
        className="relative aspect-9/16 max-h-[85vh] overflow-hidden rounded-3xl p-6 sm:p-7"
        style={{ background: CARD_BG }}
      >
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={active.key}
            className="h-full w-full"
            custom={dir}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
          >
            {active.content}
          </motion.div>
        </AnimatePresence>

        {/* Watermark on non-final slides */}
        {!isFinal && (
          <div
            data-export="skip"
            className="pointer-events-none absolute bottom-6 left-6"
          >
            <Wordmark />
          </div>
        )}

        {/* ---- Controls (inside the card, excluded from the PNG via filter) ---- */}

        {/* Segmented progress */}
        <div
          data-export="skip"
          className="pointer-events-none absolute inset-x-4 top-4 flex gap-1.5"
        >
          {slides.map((s, i) => (
            <div
              key={s.key}
              className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/20"
            >
              <div
                className="h-full rounded-full bg-white/90 transition-all duration-300"
                style={{ width: i <= current ? "100%" : "0%" }}
              />
            </div>
          ))}
        </div>

        {/* Close */}
        <button
          type="button"
          data-export="skip"
          onClick={close}
          aria-label="Close"
          className="absolute right-3 top-7 flex h-8 w-8 items-center justify-center rounded-full text-white/60 transition hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Tap zones */}
        {current > 0 && (
          <button
            type="button"
            data-export="skip"
            onClick={() => go(-1)}
            aria-label="Previous"
            className="group absolute inset-y-0 left-0 w-2/5"
          >
            <ChevronLeft className="absolute left-1.5 top-1/2 h-5 w-5 -translate-y-1/2 text-white/0 transition group-hover:text-white/50" />
          </button>
        )}
        {!isFinal && (
          <button
            type="button"
            data-export="skip"
            onClick={() => go(1)}
            aria-label="Next"
            className="group absolute inset-y-0 right-0 w-3/5"
          >
            <ChevronRight className="absolute right-1.5 top-1/2 h-5 w-5 -translate-y-1/2 text-white/0 transition group-hover:text-white/50" />
          </button>
        )}

        {/* Final actions — pinned inside the card, over a scrim */}
        {isFinal && (
          <div
            data-export="skip"
            className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 bg-gradient-to-t from-black via-black/90 to-transparent px-6 pb-5 pt-20"
          >
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              className={cn(
                "flex w-full items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition",
                downloading ? "opacity-60" : "hover:opacity-90",
              )}
            >
              <Download className="h-4 w-4" />
              {downloading ? "Preparing…" : "Download & share"}
            </button>
            <button
              type="button"
              onClick={() => go(-last)}
              className="text-xs font-medium text-white/50 transition hover:text-white/80"
            >
              Replay
            </button>
          </div>
        )}
      </div>

      {/* Confetti — sibling of the card so it is never captured. Restrained. */}
      {isFinal && (
        <Confetti
          className="pointer-events-none absolute inset-0 z-30 h-full w-full"
          options={{
            particleCount: 70,
            spread: 80,
            startVelocity: 32,
            origin: { y: 0.35 },
            colors: [SAFFRON, "#ffffff", "#f6d9a8"],
          }}
        />
      )}
    </div>
  );
}

function FinalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2.5">
      <span className="text-sm text-white/50">{label}</span>
      <span className="truncate text-right text-sm font-medium text-white/90">
        {value}
      </span>
    </div>
  );
}
