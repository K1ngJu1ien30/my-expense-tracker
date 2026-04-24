"use client";

import { forwardRef } from "react";
import type { ReceiptPayload } from "@/lib/receiptData";

/**
 * Thermal-receipt aesthetic rendering of a monthly recap.
 *
 * Design choices:
 *   • Monospace (Courier New / ui-monospace) to read like real receipt paper
 *   • `clip-path` polygon creates serrated top + bottom edges
 *   • Warm paper tint on the background
 *   • Fake barcode + receipt ID at the footer
 *
 * The component accepts a `ref` so the parent can hand the DOM node to
 * html2canvas for the "share as PNG" flow. Width is fixed at 360px to
 * guarantee consistent rendering on any phone.
 */

type Props = {
  payload: ReceiptPayload;
  userName: string;
  formatCurrency: (n: number) => string;
  /** Optional — hides the decorative footer if the caller needs a more compact variant. */
  compact?: boolean;
};

/** Generate a pseudo-barcode from the receipt ID (stable, not scannable). */
function barcodeFor(id: string): string {
  // Simple deterministic hash → bar pattern. Not a real barcode spec — it's
  // purely decorative, so we just need a stable-looking visual sequence.
  const seed = [...id].reduce((a, c) => a + c.charCodeAt(0), 0);
  const bars = "║▌║█║▌│║▌│║▌║█║▌│║│║▌║█│║▌║│║█";
  const start = seed % Math.max(1, bars.length - 20);
  return bars.slice(start, start + 24);
}

const MonthlyReceipt = forwardRef<HTMLDivElement, Props>(function MonthlyReceipt(
  { payload, userName, formatCurrency, compact = false },
  ref
) {
  const {
    label,
    daysInMonth,
    categories,
    expenseTotal,
    incomeTotal,
    netSaved,
    biggestSplurge,
    quietDayStreak,
    expenseCount,
    activeAccounts,
    vsLastMonth,
    receiptId,
  } = payload;

  const topCategory = categories[0];

  // Serrated top + bottom via clip-path (24 little teeth).
  const serratedEdge: React.CSSProperties = {
    clipPath:
      "polygon(0 8px, 4% 0, 8% 8px, 12% 0, 16% 8px, 20% 0, 24% 8px, 28% 0, 32% 8px, 36% 0, 40% 8px, 44% 0, 48% 8px, 52% 0, 56% 8px, 60% 0, 64% 8px, 68% 0, 72% 8px, 76% 0, 80% 8px, 84% 0, 88% 8px, 92% 0, 96% 8px, 100% 0, 100% calc(100% - 8px), 96% 100%, 92% calc(100% - 8px), 88% 100%, 84% calc(100% - 8px), 80% 100%, 76% calc(100% - 8px), 72% 100%, 68% calc(100% - 8px), 64% 100%, 60% calc(100% - 8px), 56% 100%, 52% calc(100% - 8px), 48% 100%, 44% calc(100% - 8px), 40% 100%, 36% calc(100% - 8px), 32% 100%, 28% calc(100% - 8px), 24% 100%, 20% calc(100% - 8px), 16% 100%, 12% calc(100% - 8px), 8% 100%, 4% calc(100% - 8px), 0 100%)",
  };

  return (
    <div
      ref={ref}
      style={{
        ...serratedEdge,
        // Warm off-white like thermal paper, slight drop-shadow outside the clip.
        background: "linear-gradient(180deg, #fdf8eb 0%, #f8f1de 100%)",
        fontFamily:
          '"Courier New", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        color: "#2a2a28",
      }}
      className="w-[360px] px-6 py-8 shadow-heavy mx-auto text-[11px] leading-[1.45] select-none"
      aria-label={`Monthly receipt for ${label}`}
    >
      {/* ─── Masthead ──────────────────────────────────────────── */}
      <div className="text-center">
        <p className="text-[14px] font-black tracking-[0.25em]">
          EXPENSE TRACKER PRO
        </p>
        <p className="text-[10px] tracking-[0.4em] mt-1 text-stone-600">
          ─── MONTHLY RECEIPT ───
        </p>
      </div>

      <Divider />

      <div className="text-center text-[10px] text-stone-700 tracking-wider">
        <p className="uppercase">{label}</p>
        <p className="mt-0.5">
          {daysInMonth} day period · Cashier:{" "}
          <span className="font-bold">{userName || "You"}</span>
        </p>
      </div>

      <Divider />

      {/* ─── Line items ─────────────────────────────────────────── */}
      <div className="space-y-0.5">
        <div className="flex justify-between text-[10px] text-stone-500 uppercase tracking-wider">
          <span>Item</span>
          <span>Amount</span>
        </div>
        <div className="border-t border-dashed border-stone-400 my-1" />
        {categories.length === 0 ? (
          <p className="text-center text-stone-500 py-2">— no expenses recorded —</p>
        ) : (
          categories.map((c) => (
            <Row
              key={c.category}
              left={`${c.category}${c.percent ? ` (${c.percent}%)` : ""}`}
              right={formatCurrency(c.amount)}
            />
          ))
        )}
      </div>

      <div className="border-t border-dashed border-stone-400 my-2" />

      {/* ─── Subtotals ──────────────────────────────────────────── */}
      <div className="space-y-0.5 font-semibold">
        <Row left="SUBTOTAL (Spent)" right={formatCurrency(expenseTotal)} />
        {incomeTotal > 0 && (
          <Row left="Income" right={`-${formatCurrency(incomeTotal)}`} />
        )}
      </div>

      <div className="border-t-2 border-double border-stone-700 my-2" />

      <div className="font-black text-[13px]">
        <Row
          left="NET SAVED"
          right={formatCurrency(netSaved)}
          highlighted
        />
      </div>

      <Divider />

      {/* ─── Highlights ─────────────────────────────────────────── */}
      <div className="text-center text-[10px] tracking-[0.3em] uppercase text-stone-600 mb-2">
        ⭐ Highlights ⭐
      </div>

      <div className="space-y-1 text-[11px]">
        {topCategory && (
          <p>
            <span className="text-stone-500">▸ Top Category:</span>{" "}
            <span className="font-bold">
              {topCategory.category} ({topCategory.percent}%)
            </span>
          </p>
        )}
        {biggestSplurge > 0 && (
          <p>
            <span className="text-stone-500">▸ Biggest Splurge:</span>{" "}
            <span className="font-bold">{formatCurrency(biggestSplurge)}</span>
          </p>
        )}
        {quietDayStreak > 0 && (
          <p>
            <span className="text-stone-500">▸ Quiet Day Streak:</span>{" "}
            <span className="font-bold">
              {quietDayStreak} day{quietDayStreak !== 1 ? "s" : ""}
            </span>
          </p>
        )}
        {vsLastMonth !== null && (
          <p>
            <span className="text-stone-500">▸ vs. Last Month:</span>{" "}
            <span className="font-bold">
              {vsLastMonth > 0 ? "+" : ""}
              {vsLastMonth.toFixed(1)}%{" "}
              {vsLastMonth < -2 ? "🎯" : vsLastMonth > 10 ? "⚠" : ""}
            </span>
          </p>
        )}
      </div>

      <Divider />

      <div className="text-center text-[10px] text-stone-600 space-y-0.5">
        <p>
          TRANSACTIONS: <span className="font-bold">{expenseCount}</span>
        </p>
        <p>
          ACCOUNTS:{" "}
          <span className="font-bold">{activeAccounts} active</span>
        </p>
      </div>

      {!compact && (
        <>
          <Divider />
          <div className="text-center text-[10px] leading-[1.6]">
            <p className="font-bold tracking-wider">THANK YOU FOR BUDGETING</p>
            <p className="mt-1 text-stone-500">* * * * * * *</p>
            {netSaved > 0 && (
              <p className="mt-1 text-stone-700">
                You saved{" "}
                <span className="font-bold">{formatCurrency(netSaved)}</span>{" "}
                this month
              </p>
            )}
          </div>

          <Divider />

          <div className="text-center">
            <p className="text-[18px] tracking-[0.1em] leading-none text-stone-800 font-bold">
              {barcodeFor(receiptId)}
            </p>
            <p className="text-[9px] tracking-widest mt-1 text-stone-600">
              RECEIPT ID: {receiptId}
            </p>
            <p className="text-[9px] text-stone-500 mt-0.5">
              Keep for records
            </p>
          </div>
        </>
      )}
    </div>
  );
});

/** Dotted divider line, matches thermal receipt aesthetic. */
function Divider() {
  return (
    <div className="my-3 border-t border-dashed border-stone-400" aria-hidden="true" />
  );
}

/** A single left/right line item. */
function Row({
  left,
  right,
  highlighted,
}: {
  left: string;
  right: string;
  highlighted?: boolean;
}) {
  return (
    <div
      className={`flex justify-between items-baseline gap-2 ${
        highlighted ? "" : "text-stone-800"
      }`}
    >
      <span className="truncate">{left}</span>
      <span className={highlighted ? "" : "font-semibold"}>{right}</span>
    </div>
  );
}

export default MonthlyReceipt;
