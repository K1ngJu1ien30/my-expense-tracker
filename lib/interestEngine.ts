// ============================================================================
// Interest & Finance Charges Projection Engine (Phase 3C)
// ============================================================================

import type { Account, CreditCardStatement, InterestProjection } from "./types";
import { roundCurrency } from "./utils";

export const APR_TIER_PRESETS = [
  {
    tier: 1,
    apr: 15.0,
    label: "Tier 1: 15.0% p.a.",
    description: "Prompt payments for 10+ consecutive months (Bank Tier 1)",
  },
  {
    tier: 2,
    apr: 17.0,
    label: "Tier 2: 17.0% p.a.",
    description: "Prompt payments for 8-9 consecutive months (Bank Tier 2)",
  },
  {
    tier: 3,
    apr: 18.0,
    label: "Tier 3: 18.0% p.a.",
    description: "Standard / Default rate for new cardholders",
  },
] as const;

/**
 * Pure function: calculates finance charge projections and grace period status.
 *
 * INVARIANT: This calculation is strictly for informational display and warnings.
 * Antigravity NEVER silently posts predicted interest to actual financial records.
 */
export function calculateInterestProjection(params: {
  activeCard: Account;
  cardDebt: number;
  latestStatement?: CreditCardStatement | null;
  statementRemaining: number;
  minimumRemaining: number;
  referenceDateStr?: string;
}): InterestProjection {
  const {
    activeCard,
    cardDebt,
    latestStatement,
    statementRemaining,
    minimumRemaining,
    referenceDateStr = new Date().toISOString().split("T")[0],
  } = params;

  // 1. Determine effective APR (default to 15.0% standard if unconfigured)
  const rawApr = activeCard.cardDetails?.apr ?? (activeCard as unknown as { apr?: number }).apr;
  const apr = typeof rawApr === "number" && rawApr >= 0 ? rawApr : 15.0;
  const dailyRatePct = roundCurrency((apr / 365) * 100) / 100;

  const todayTime = new Date(referenceDateStr).getTime();

  // 2. Evaluate statement cycle & grace period
  if (latestStatement) {
    const dueTime = new Date(latestStatement.dueDate).getTime();
    const diffDays = Math.ceil((dueTime - todayTime) / 86400000);
    const isOverdue = diffDays < 0;

    if (statementRemaining <= 0.005) {
      // Statement is fully settled
      return {
        apr,
        dailyRatePct,
        unpaidBalance: 0,
        estimatedDailyCharge: 0,
        estimatedMonthlyCharge: 0,
        gracePeriodActive: true,
        isOverdue: false,
        potentialLateFee: 0,
        daysRemainingInCycle: Math.max(0, diffDays),
      };
    }

    // Statement balance remains unpaid
    const baseBalance = roundCurrency(statementRemaining);
    const dailyInterest = (baseBalance * (apr / 100)) / 365;
    const monthlyInterest = dailyInterest * 30;

    // Late payment fee: standard Malaysian credit card rule is 1% of total unpaid balance, min RM 10, max RM 100
    let potentialLateFee = 0;
    if (isOverdue && minimumRemaining > 0) {
      potentialLateFee = Math.min(100, Math.max(10, roundCurrency(baseBalance * 0.01)));
    }

    return {
      apr,
      dailyRatePct,
      unpaidBalance: baseBalance,
      estimatedDailyCharge: roundCurrency(dailyInterest),
      estimatedMonthlyCharge: roundCurrency(monthlyInterest),
      gracePeriodActive: !isOverdue && diffDays >= 0,
      isOverdue,
      potentialLateFee: roundCurrency(potentialLateFee),
      daysRemainingInCycle: Math.max(0, diffDays),
    };
  }

  // 3. Fallback: No statement entered, but card has debt
  if (cardDebt > 0) {
    const baseBalance = roundCurrency(cardDebt);
    const dailyInterest = (baseBalance * (apr / 100)) / 365;
    const monthlyInterest = dailyInterest * 30;

    return {
      apr,
      dailyRatePct,
      unpaidBalance: baseBalance,
      estimatedDailyCharge: roundCurrency(dailyInterest),
      estimatedMonthlyCharge: roundCurrency(monthlyInterest),
      gracePeriodActive: false,
      isOverdue: false,
      potentialLateFee: 0,
      daysRemainingInCycle: 0,
    };
  }

  // 4. Zero balance
  return {
    apr,
    dailyRatePct,
    unpaidBalance: 0,
    estimatedDailyCharge: 0,
    estimatedMonthlyCharge: 0,
    gracePeriodActive: true,
    isOverdue: false,
    potentialLateFee: 0,
    daysRemainingInCycle: 0,
  };
}
