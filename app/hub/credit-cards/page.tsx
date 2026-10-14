"use client";

import { useState, useMemo } from "react";
import {
  ArrowLeft,
  CreditCard,
  Clock,
  Receipt,
  FileText,
  ChevronRight,
  ShieldCheck,
  Percent,
} from "lucide-react";
import Link from "next/link";
import { useAppContext } from "@/lib/context";
import { NativeHaptics } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import { calculateAccountBalances } from "@/lib/balance";
import {
  calculateStatementRemaining,
  calculateMinimumRemaining,
} from "@/lib/hooks/useCreditCardPayments";
import type { CreditCardStatement, Transaction } from "@/lib/types";

export default function CreditCardsDashboardPage() {
  const {
    accountObjects,
    transactions,
    currency,
    accentColor,
    statements,
    creditCardPayments,
    openCreditCardPayment,
  } = useAppContext();

  // ─── Filter credit card accounts ─────────────────────────────────────────
  const creditCards = useMemo(
    () => accountObjects.filter((a) => a.kind === "credit_card" && !a.isArchived),
    [accountObjects]
  );

  // Active card tab: "all" or specific card ID
  const [selectedCardId, setSelectedCardId] = useState<string>(() =>
    creditCards.length > 0 ? creditCards[0].id || creditCards[0].name : "all"
  );

  // Synchronize balances from centralized engine
  const balancesData = useMemo(
    () => calculateAccountBalances(accountObjects, transactions),
    [accountObjects, transactions]
  );

  // Find active card object
  const activeCard = useMemo(
    () => creditCards.find((c) => (c.id || c.name) === selectedCardId) || null,
    [creditCards, selectedCardId]
  );

  // ─── Consolidated Totals across all credit cards ──────────────────────────
  const consolidated = useMemo(() => {
    let totalDebt = 0;
    let totalLimit = 0;
    let cardsWithLimitCount = 0;

    creditCards.forEach((card) => {
      const bal =
        balancesData.balancesByName[card.name] ??
        (Number(card.openingBalance) || 0);
      const cardDebt = bal < 0 ? Math.abs(bal) : 0;
      totalDebt += cardDebt;

      const limit = Number(card.creditLimit || card.cardDetails?.accountId || 0);
      if (limit > 0) {
        totalLimit += limit;
        cardsWithLimitCount++;
      }
    });

    const totalAvailable = Math.max(0, totalLimit - totalDebt);
    const overallUtilization =
      totalLimit > 0 ? (totalDebt / totalLimit) * 100 : 0;

    return {
      totalDebt: Math.round(totalDebt * 100) / 100,
      totalLimit: Math.round(totalLimit * 100) / 100,
      totalAvailable: Math.round(totalAvailable * 100) / 100,
      overallUtilization: Math.round(overallUtilization * 10) / 10,
      hasLimit: cardsWithLimitCount > 0,
    };
  }, [creditCards, balancesData]);

  // ─── Active Card Metrics ──────────────────────────────────────────────────
  const activeCardMetrics = useMemo(() => {
    if (!activeCard) return null;

    const bal =
      balancesData.balancesByName[activeCard.name] ??
      (Number(activeCard.openingBalance) || 0);
    const outstandingDebt = bal < 0 ? Math.round(Math.abs(bal) * 100) / 100 : 0;

    const limit = Number(activeCard.creditLimit || 0);
    const availableCredit = limit > 0 ? Math.max(0, limit - outstandingDebt) : 0;
    const utilizationPct =
      limit > 0 ? Math.round((outstandingDebt / limit) * 1000) / 10 : 0;

    // Filter statements for this card
    const cardStatements = statements
      .filter((s) => s.accountId === activeCard.id || s.accountId === activeCard.name)
      .sort((a, b) => new Date(b.statementDate).getTime() - new Date(a.statementDate).getTime());

    // Latest statement (prefer unsettled, else latest date)
    const latestStatement: CreditCardStatement | null =
      cardStatements.find(
        (s) => !s.isSettled && calculateStatementRemaining(s, creditCardPayments) > 0
      ) || cardStatements[0] || null;

    const statementRemaining = latestStatement
      ? calculateStatementRemaining(latestStatement, creditCardPayments)
      : 0;

    const minimumRemaining = latestStatement
      ? calculateMinimumRemaining(latestStatement, creditCardPayments)
      : 0;

    // Due date calculation
    let dueStatus: { label: string; tone: "overdue" | "today" | "soon" | "settled" | "none" } = {
      label: "No statement",
      tone: "none",
    };

    if (latestStatement) {
      if (latestStatement.isSettled || statementRemaining <= 0) {
        dueStatus = { label: "Statement Settled", tone: "settled" };
      } else {
        const dueTime = new Date(latestStatement.dueDate).getTime();
        const todayTime = new Date(new Date().toISOString().split("T")[0]).getTime();
        const diffDays = Math.ceil((dueTime - todayTime) / 86400000);

        if (diffDays < 0) {
          dueStatus = {
            label: `Overdue by ${Math.abs(diffDays)} day${Math.abs(diffDays) > 1 ? "s" : ""}`,
            tone: "overdue",
          };
        } else if (diffDays === 0) {
          dueStatus = { label: "Due Today", tone: "today" };
        } else {
          dueStatus = {
            label: `Due in ${diffDays} day${diffDays > 1 ? "s" : ""}`,
            tone: "soon",
          };
        }
      }
    }

    // New purchases since statement closing date
    const newPurchases: Transaction[] = transactions.filter((tx) => {
      if (tx.deleted_at || tx.type !== "Expense") return false;
      const matchesCard =
        tx.account_id === activeCard.id ||
        tx.account.trim().toLowerCase() === activeCard.name.trim().toLowerCase();
      if (!matchesCard) return false;

      if (!latestStatement) return true;
      return new Date(tx.date) > new Date(latestStatement.statementDate);
    });

    const newPurchasesTotal = newPurchases.reduce(
      (sum, tx) => sum + Number(tx.amount || 0),
      0
    );

    // Card payment history
    const cardPayments = creditCardPayments.filter(
      (p) => p.accountId === activeCard.id || p.accountId === activeCard.name
    );

    return {
      outstandingDebt,
      creditLimit: limit,
      availableCredit,
      utilizationPct,
      latestStatement,
      statementRemaining,
      minimumRemaining,
      dueStatus,
      newPurchases,
      newPurchasesTotal: Math.round(newPurchasesTotal * 100) / 100,
      cardPayments,
    };
  }, [activeCard, balancesData, statements, creditCardPayments, transactions]);

  // Tab switcher handler
  const handleSelectTab = (id: string) => {
    setSelectedCardId(id);
    NativeHaptics.lightTick();
  };

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6 pb-32 animate-in fade-in duration-300">
      {/* ─── Header Navigation ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/hub"
            className="p-2.5 bg-muted/60 hover:bg-muted rounded-2xl text-foreground transition-colors"
            aria-label="Back to Hub"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
              <span>Credit Cards</span>
              <span className="text-xs font-black uppercase px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-500">
                MVP
              </span>
            </h1>
            <p className="text-xs text-muted-foreground font-medium">
              Limits, utilization, statements & unbilled spending
            </p>
          </div>
        </div>

        {creditCards.length > 0 && (
          <button
            type="button"
            onClick={() => openCreditCardPayment(activeCard?.id || creditCards[0].id)}
            className="px-4 py-2.5 rounded-2xl text-xs font-bold text-white shadow-soft transition-all flex items-center gap-1.5 cursor-pointer"
            style={{ backgroundColor: accentColor || "#3b82f6" }}
          >
            <CreditCard className="w-4 h-4" />
            <span>Pay Card</span>
          </button>
        )}
      </div>

      {creditCards.length === 0 ? (
        /* Empty State */
        <div className="text-center py-16 px-6 bg-card rounded-[2rem] border border-border/60 shadow-soft space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto text-muted-foreground">
            <CreditCard className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-foreground">No Credit Cards Configured</h2>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Add your credit cards under Profile → Manage Accounts to track credit limits, statement closing dates, and repayments.
            </p>
          </div>
          <Link
            href="/profile"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-primary text-primary-foreground text-xs font-bold shadow-soft transition-transform active:scale-95"
          >
            <span>Manage Accounts</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        <>
          {/* ─── Card Switcher Pills ────────────────────────────────────────── */}
          <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
            {creditCards.length > 1 && (
              <button
                type="button"
                onClick={() => handleSelectTab("all")}
                className={cn(
                  "px-4 py-2 rounded-2xl text-xs font-bold transition-all shrink-0 cursor-pointer",
                  selectedCardId === "all"
                    ? "bg-primary text-primary-foreground shadow-soft"
                    : "bg-muted text-muted-foreground hover:bg-border"
                )}
              >
                All Cards Summary
              </button>
            )}
            {creditCards.map((card) => {
              const isSelected = (card.id || card.name) === selectedCardId;
              const debt =
                balancesData.balancesByName[card.name] < 0
                  ? Math.abs(balancesData.balancesByName[card.name])
                  : 0;
              return (
                <button
                  key={card.id || card.name}
                  type="button"
                  onClick={() => handleSelectTab(card.id || card.name)}
                  className={cn(
                    "px-4 py-2 rounded-2xl text-xs font-bold transition-all shrink-0 flex items-center gap-2 cursor-pointer",
                    isSelected
                      ? "bg-primary text-primary-foreground shadow-soft"
                      : "bg-muted text-muted-foreground hover:bg-border"
                  )}
                >
                  <CreditCard className="w-3.5 h-3.5 opacity-80" />
                  <span>{card.name}</span>
                  {card.cardDetails?.cardLastFour && (
                    <span className="opacity-70 font-mono text-[10px]">
                      ••{card.cardDetails.cardLastFour}
                    </span>
                  )}
                  {debt > 0 && (
                    <span
                      className={cn(
                        "text-[10px] px-1.5 py-0.2 rounded-full",
                        isSelected
                          ? "bg-white/20 text-white"
                          : "bg-rose-500/20 text-rose-400"
                      )}
                    >
                      {currency} {debt.toFixed(0)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ─── Consolidated All Cards View ───────────────────────────────── */}
          {selectedCardId === "all" ? (
            <div className="space-y-6">
              {/* Consolidated Hero Card */}
              <div className="p-6 rounded-[2rem] bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-950 text-white shadow-heavy border border-white/10 space-y-5 relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-300">
                      Consolidated Credit Overview
                    </span>
                  </div>
                  <span className="text-xs font-black px-2.5 py-1 rounded-full bg-white/10 text-gray-200">
                    {creditCards.length} Active Cards
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                  <div>
                    <span className="text-gray-400 text-[10px] font-bold uppercase tracking-wider block">
                      Total Card Debt
                    </span>
                    <span className="text-2xl sm:text-3xl font-black text-rose-400 tracking-tight block mt-0.5 font-mono">
                      {currency} {consolidated.totalDebt.toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400 text-[10px] font-bold uppercase tracking-wider block">
                      Available Credit
                    </span>
                    <span className="text-2xl sm:text-3xl font-black text-emerald-400 tracking-tight block mt-0.5 font-mono">
                      {currency} {consolidated.totalAvailable.toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400 text-[10px] font-bold uppercase tracking-wider block">
                      Combined Credit Limit
                    </span>
                    <span className="text-2xl sm:text-3xl font-black text-gray-100 tracking-tight block mt-0.5 font-mono">
                      {currency} {consolidated.totalLimit.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Combined Utilization Progress Bar */}
                {consolidated.hasLimit && (
                  <div className="space-y-2 pt-2 border-t border-white/10">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-300 font-semibold">
                        Overall Credit Utilization:
                      </span>
                      <span
                        className={cn(
                          "font-mono font-black",
                          consolidated.overallUtilization > 70
                            ? "text-rose-400"
                            : consolidated.overallUtilization > 30
                            ? "text-amber-400"
                            : "text-emerald-400"
                        )}
                      >
                        {consolidated.overallUtilization.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-500",
                          consolidated.overallUtilization > 70
                            ? "bg-rose-500"
                            : consolidated.overallUtilization > 30
                            ? "bg-amber-500"
                            : "bg-emerald-500"
                        )}
                        style={{
                          width: `${Math.min(100, Math.max(2, consolidated.overallUtilization))}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {creditCards.map((card) => {
                  const bal =
                    balancesData.balancesByName[card.name] ??
                    (Number(card.openingBalance) || 0);
                  const cardDebt = bal < 0 ? Math.abs(bal) : 0;
                  const limit = Number(card.creditLimit || 0);
                  const avail = limit > 0 ? Math.max(0, limit - cardDebt) : 0;
                  const util = limit > 0 ? Math.round((cardDebt / limit) * 100) : 0;

                  return (
                    <div
                      key={card.id || card.name}
                      onClick={() => handleSelectTab(card.id || card.name)}
                      className="p-5 rounded-3xl bg-card border border-border/60 hover:border-border transition-all shadow-soft cursor-pointer space-y-4"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center text-white"
                            style={{
                              backgroundColor:
                                card.cardDetails?.cardColor || accentColor || "#3b82f6",
                            }}
                          >
                            <CreditCard className="w-4 h-4" />
                          </div>
                          <div>
                            <h3 className="font-bold text-sm text-foreground">{card.name}</h3>
                            <p className="text-[10px] text-muted-foreground font-mono">
                              {card.cardDetails?.issuer || "Card"} ••
                              {card.cardDetails?.cardLastFour || "0000"}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openCreditCardPayment(card.id || card.name);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-primary/10 text-primary hover:bg-primary hover:text-white text-xs font-bold transition-all"
                        >
                          Pay
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-muted-foreground text-[10px] block">
                            Outstanding Debt
                          </span>
                          <span className="font-black font-mono text-rose-500">
                            {currency} {cardDebt.toFixed(2)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground text-[10px] block">
                            Available Credit
                          </span>
                          <span className="font-black font-mono text-emerald-500">
                            {currency} {avail.toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {limit > 0 && (
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] text-muted-foreground">
                            <span>Utilization</span>
                            <span className="font-mono font-bold">{util}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className={cn(
                                "h-full rounded-full",
                                util > 70
                                  ? "bg-rose-500"
                                  : util > 30
                                  ? "bg-amber-500"
                                  : "bg-emerald-500"
                              )}
                              style={{ width: `${Math.min(100, util)}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : activeCard && activeCardMetrics ? (
            /* ─── Individual Card Detail View ─────────────────────────────── */
            <div className="space-y-6">
              {/* Card Hero Banner (Physical Card Styled) */}
              <div
                className="p-6 rounded-[2.5rem] text-white shadow-heavy relative overflow-hidden space-y-6"
                style={{
                  background:
                    activeCard.cardDetails?.cardColor ||
                    "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
                }}
              >
                <div className="flex justify-between items-start relative z-10">
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold uppercase tracking-widest opacity-70">
                      {activeCard.cardDetails?.issuer || "Credit Card"}
                    </span>
                    <h2 className="text-2xl font-black tracking-tight">{activeCard.name}</h2>
                  </div>
                  <div className="w-10 h-7 rounded-lg bg-amber-400/80 border border-amber-300 shadow-sm flex items-center justify-center">
                    <div className="w-6 h-4 border border-black/30 rounded-[3px]" />
                  </div>
                </div>

                <div className="relative z-10 flex items-center justify-between font-mono text-sm tracking-widest pt-2">
                  <span>•••• •••• •••• {activeCard.cardDetails?.cardLastFour || "0000"}</span>
                  <span className="text-xs opacity-75">
                    Stmt Day: {activeCard.statementDay || 15}
                  </span>
                </div>

                {/* 3 Metric Pills */}
                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-white/10 relative z-10">
                  <div className="bg-black/30 backdrop-blur-md p-3 rounded-2xl">
                    <span className="text-[10px] uppercase font-bold text-gray-300 block">
                      Outstanding
                    </span>
                    <span className="text-base font-black text-rose-300 font-mono block mt-0.5">
                      {currency} {activeCardMetrics.outstandingDebt.toFixed(2)}
                    </span>
                  </div>

                  <div className="bg-black/30 backdrop-blur-md p-3 rounded-2xl">
                    <span className="text-[10px] uppercase font-bold text-gray-300 block">
                      Available
                    </span>
                    <span className="text-base font-black text-emerald-300 font-mono block mt-0.5">
                      {currency} {activeCardMetrics.availableCredit.toFixed(2)}
                    </span>
                  </div>

                  <div className="bg-black/30 backdrop-blur-md p-3 rounded-2xl">
                    <span className="text-[10px] uppercase font-bold text-gray-300 block">
                      Limit
                    </span>
                    <span className="text-base font-black text-gray-100 font-mono block mt-0.5">
                      {currency} {activeCardMetrics.creditLimit.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* ─── Credit Utilization Gauge ────────────────────────────────── */}
              {activeCardMetrics.creditLimit > 0 && (
                <div className="p-5 bg-card rounded-3xl border border-border/60 shadow-soft space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Percent className="w-4 h-4 text-primary" />
                      <h3 className="font-bold text-sm text-foreground">
                        Credit Utilization
                      </h3>
                    </div>
                    <span
                      className={cn(
                        "text-xs font-black font-mono px-2 py-0.5 rounded-full",
                        activeCardMetrics.utilizationPct > 70
                          ? "bg-rose-500/10 text-rose-500"
                          : activeCardMetrics.utilizationPct > 30
                          ? "bg-amber-500/10 text-amber-500"
                          : "bg-emerald-500/10 text-emerald-500"
                      )}
                    >
                      {activeCardMetrics.utilizationPct.toFixed(1)}% Used
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        activeCardMetrics.utilizationPct > 70
                          ? "bg-rose-500"
                          : activeCardMetrics.utilizationPct > 30
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                      )}
                      style={{
                        width: `${Math.min(100, Math.max(2, activeCardMetrics.utilizationPct))}%`,
                      }}
                    />
                  </div>

                  {/* Contextual Tip */}
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    {activeCardMetrics.utilizationPct <= 30
                      ? "Healthy utilization (under 30%). Excellent for credit score health."
                      : activeCardMetrics.utilizationPct <= 70
                      ? "Moderate utilization. Paying down before statement closing optimizes your rating."
                      : "High utilization alert (> 70%). Paying down this balance will save interest."}
                  </p>
                </div>
              )}

              {/* ─── Statement & Due Date Card ──────────────────────────────── */}
              <div className="p-5 bg-card rounded-3xl border border-border/60 shadow-soft space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-primary" />
                    <h3 className="font-bold text-sm text-foreground">
                      Billing Statement Cycle
                    </h3>
                  </div>

                  {/* Status Badge */}
                  <span
                    className={cn(
                      "text-xs font-black px-2.5 py-1 rounded-full",
                      activeCardMetrics.dueStatus.tone === "overdue" &&
                        "bg-rose-500/15 text-rose-500",
                      activeCardMetrics.dueStatus.tone === "today" &&
                        "bg-rose-500/15 text-rose-500 animate-pulse",
                      activeCardMetrics.dueStatus.tone === "soon" &&
                        "bg-amber-500/15 text-amber-600 dark:text-amber-400",
                      activeCardMetrics.dueStatus.tone === "settled" &&
                        "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
                      activeCardMetrics.dueStatus.tone === "none" &&
                        "bg-muted text-muted-foreground"
                    )}
                  >
                    {activeCardMetrics.dueStatus.label}
                  </span>
                </div>

                {activeCardMetrics.latestStatement ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-muted/20 p-4 rounded-2xl border border-border/40 text-xs">
                      <div>
                        <span className="text-muted-foreground text-[10px] block">
                          Statement Date
                        </span>
                        <span className="font-bold text-foreground">
                          {activeCardMetrics.latestStatement.statementDate}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-[10px] block">
                          Confirmed Due Date
                        </span>
                        <span className="font-bold text-foreground">
                          {activeCardMetrics.latestStatement.dueDate}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-[10px] block">
                          Original Balance
                        </span>
                        <span className="font-bold text-foreground font-mono">
                          {currency}{" "}
                          {activeCardMetrics.latestStatement.closingBalance.toFixed(2)}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-[10px] block">
                          Statement Remaining
                        </span>
                        <span
                          className={cn(
                            "font-black font-mono",
                            activeCardMetrics.statementRemaining > 0
                              ? "text-rose-500"
                              : "text-emerald-500"
                          )}
                        >
                          {currency} {activeCardMetrics.statementRemaining.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {activeCardMetrics.minimumRemaining > 0 && (
                      <div className="flex items-center justify-between px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs font-semibold text-amber-600 dark:text-amber-400">
                        <span>Minimum Payment Due:</span>
                        <span className="font-mono font-bold">
                          {currency} {activeCardMetrics.minimumRemaining.toFixed(2)}
                        </span>
                      </div>
                    )}

                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => openCreditCardPayment(activeCard.id || activeCard.name)}
                        className="flex-1 py-3 rounded-2xl bg-primary text-white text-xs font-bold shadow-soft hover:opacity-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <CreditCard className="w-4 h-4" />
                        <span>Pay This Statement</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-muted/20 rounded-2xl border border-dashed border-border/80 text-center space-y-2">
                    <p className="text-xs text-muted-foreground">
                      No statement has been recorded yet for this card.
                    </p>
                    <button
                      type="button"
                      onClick={() => openCreditCardPayment(activeCard.id || activeCard.name)}
                      className="text-xs font-bold text-primary hover:underline"
                    >
                      Record an issued statement or make a direct payment →
                    </button>
                  </div>
                )}
              </div>

              {/* ─── New Purchases Since Statement Closing ───────────────────── */}
              <div className="p-5 bg-card rounded-3xl border border-border/60 shadow-soft space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-primary" />
                    <div>
                      <h3 className="font-bold text-sm text-foreground">
                        Unbilled Card Purchases
                      </h3>
                      <p className="text-[10px] text-muted-foreground">
                        Charges made after the latest statement cycle closed
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-black text-foreground font-mono">
                    {currency} {activeCardMetrics.newPurchasesTotal.toFixed(2)}
                  </span>
                </div>

                {activeCardMetrics.newPurchases.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-3 text-center bg-muted/20 rounded-xl">
                    No unbilled purchases recorded since statement closed.
                  </p>
                ) : (
                  <div className="space-y-2 pt-1">
                    {activeCardMetrics.newPurchases.slice(0, 5).map((tx) => (
                      <div
                        key={tx.id}
                        className="p-3 bg-muted/20 rounded-2xl flex items-center justify-between text-xs"
                      >
                        <div className="space-y-0.5">
                          <span className="font-bold text-foreground block">
                            {tx.category || "General"}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(tx.date).toLocaleDateString()}
                            {tx.note ? ` • ${tx.note}` : ""}
                          </span>
                        </div>
                        <span className="font-mono font-bold text-rose-500">
                          -{currency} {Number(tx.amount).toFixed(2)}
                        </span>
                      </div>
                    ))}
                    {activeCardMetrics.newPurchases.length > 5 && (
                      <p className="text-[10px] text-center text-muted-foreground pt-1">
                        + {activeCardMetrics.newPurchases.length - 5} more unbilled charges
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* ─── Payment History Audit Trail ────────────────────────────── */}
              <div className="p-5 bg-card rounded-3xl border border-border/60 shadow-soft space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-emerald-500" />
                    <h3 className="font-bold text-sm text-foreground">
                      Repayment History
                    </h3>
                  </div>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">
                    {activeCardMetrics.cardPayments.length} Total Payments
                  </span>
                </div>

                {activeCardMetrics.cardPayments.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4 text-center bg-muted/20 rounded-xl">
                    No repayment history recorded for this card yet.
                  </p>
                ) : (
                  <div className="space-y-2 pt-1">
                    {activeCardMetrics.cardPayments.slice(0, 5).map((p) => {
                      const src = accountObjects.find(
                        (a) => a.id === p.sourceAccountId || a.name === p.sourceAccountId
                      );
                      return (
                        <div
                          key={p.id}
                          className="p-3 bg-muted/20 rounded-2xl flex items-center justify-between text-xs"
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-foreground">
                                From {src?.name || "Bank Account"}
                              </span>
                              <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-primary/10 text-primary">
                                {p.paymentType.replace("_", " ")}
                              </span>
                            </div>
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(p.paymentDate).toLocaleDateString()}
                              {p.note ? ` • ${p.note}` : ""}
                            </span>
                          </div>
                          <span className="font-mono font-black text-emerald-500">
                            +{currency} {Number(p.amount).toFixed(2)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
