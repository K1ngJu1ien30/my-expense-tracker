// ============================================================================
// In-App Credit Card Reminders Derivation Engine (Phase 3A)
// ============================================================================

import type {
  Account,
  CreditCardPayment,
  CreditCardPaymentAllocation,
  CreditCardStatement,
} from "./types";
import {
  calculateStatementRemaining,
  calculateMinimumRemaining,
} from "./hooks/useCreditCardPayments";
import { dateKeyToUtcMs, formatLocalDate, roundCurrency } from "./utils";

export type CreditCardReminderUrgency = "overdue" | "due_today" | "due_soon";

export type CreditCardReminder = {
  id: string;
  cardId: string;
  cardName: string;
  cardLastFour?: string;
  statementId?: string;
  statementDate?: string;
  dueDate: string;
  daysRemaining: number; // negative = overdue, 0 = today, positive = future
  urgency: CreditCardReminderUrgency;
  remainingBalance: number;
  minimumPayment: number;
  totalCardDebt: number;
  reminderDaysBefore: number;
};

/**
 * Pure function: derives actionable in-app reminders for credit cards.
 * Consolidated per billing statement / due-date cycle (NEVER created per purchase).
 */
export function deriveCreditCardReminders(params: {
  accountObjects: Account[];
  statements: CreditCardStatement[];
  creditCardPayments: CreditCardPayment[];
  creditCardAllocations?: CreditCardPaymentAllocation[];
  accountBalances: Record<string, number>;
  todayDateStr?: string;
}): CreditCardReminder[] {
  const {
    accountObjects,
    statements,
    creditCardPayments,
    creditCardAllocations,
    accountBalances,
    todayDateStr = formatLocalDate(),
  } = params;

  const todayTime = dateKeyToUtcMs(todayDateStr);
  const reminders: CreditCardReminder[] = [];

  const creditCards = accountObjects.filter(
    (a) => a.kind === "credit_card" && !a.isArchived
  );

  for (const card of creditCards) {
    const cardId = card.id || card.name;
    const cardBal = accountBalances[card.name] ?? (Number(card.openingBalance) || 0);
    const totalCardDebt = cardBal < 0 ? roundCurrency(Math.abs(cardBal)) : 0;
    const reminderDaysBefore = card.cardDetails?.reminderDaysBefore ?? 3;

    // Filter statements for this card, sorted by dueDate ASC (oldest due first)
    const cardStatements = statements
      .filter((s) => s.accountId === cardId || s.accountId === card.name)
      .sort((a, b) => dateKeyToUtcMs(a.dueDate) - dateKeyToUtcMs(b.dueDate));

    // Single pass: compute remaining balance once per unsettled statement
    const unsettledWithRemaining: Array<{ st: CreditCardStatement; remaining: number }> = [];
    for (const s of cardStatements) {
      if (s.isSettled) continue;
      const remaining = calculateStatementRemaining(s, creditCardPayments, creditCardAllocations);
      if (remaining > 0.005) {
        unsettledWithRemaining.push({ st: s, remaining });
      }
    }

    if (unsettledWithRemaining.length > 0) {
      for (const { st, remaining } of unsettledWithRemaining) {
        const minRemaining = calculateMinimumRemaining(
          st,
          creditCardPayments,
          creditCardAllocations
        );
        const dueTime = dateKeyToUtcMs(st.dueDate);
        const diffDays = Math.round((dueTime - todayTime) / 86400000);

        if (diffDays < 0) {
          reminders.push({
            id: `reminder-${cardId}-${st.id}-overdue`,
            cardId,
            cardName: card.name,
            cardLastFour: card.cardDetails?.cardLastFour,
            statementId: st.id,
            statementDate: st.statementDate,
            dueDate: st.dueDate,
            daysRemaining: diffDays,
            urgency: "overdue",
            remainingBalance: remaining,
            minimumPayment: minRemaining,
            totalCardDebt,
            reminderDaysBefore,
          });
        } else if (diffDays === 0) {
          reminders.push({
            id: `reminder-${cardId}-${st.id}-today`,
            cardId,
            cardName: card.name,
            cardLastFour: card.cardDetails?.cardLastFour,
            statementId: st.id,
            statementDate: st.statementDate,
            dueDate: st.dueDate,
            daysRemaining: 0,
            urgency: "due_today",
            remainingBalance: remaining,
            minimumPayment: minRemaining,
            totalCardDebt,
            reminderDaysBefore,
          });
        } else if (diffDays <= reminderDaysBefore) {
          reminders.push({
            id: `reminder-${cardId}-${st.id}-soon`,
            cardId,
            cardName: card.name,
            cardLastFour: card.cardDetails?.cardLastFour,
            statementId: st.id,
            statementDate: st.statementDate,
            dueDate: st.dueDate,
            daysRemaining: diffDays,
            urgency: "due_soon",
            remainingBalance: remaining,
            minimumPayment: minRemaining,
            totalCardDebt,
            reminderDaysBefore,
          });
        }
      }
    } else if (totalCardDebt > 0 && card.dueDay) {
      // Fallback: No issued statement entered, but card has outstanding debt and configured dueDay.
      // Use pure calendar arithmetic (clamping dueDay to month length) so UTC+8/UTC-5 never shifts ±1 day.
      const [yStr, mStr, dStr] = todayDateStr.split("-");
      const todayY = Number(yStr);
      const todayM = Number(mStr) - 1; // 0-indexed
      const todayD = Number(dStr);

      let targetY = todayY;
      let targetM = todayM;
      const daysInCurrentM = new Date(Date.UTC(todayY, todayM + 1, 0)).getUTCDate();
      const clampedCurrentDueDay = Math.min(card.dueDay, daysInCurrentM);
      if (todayD > clampedCurrentDueDay) {
        targetM += 1;
        if (targetM > 11) {
          targetM = 0;
          targetY += 1;
        }
      }
      const daysInTargetM = new Date(Date.UTC(targetY, targetM + 1, 0)).getUTCDate();
      const targetDay = Math.min(card.dueDay, daysInTargetM);
      const dueStr = `${targetY}-${String(targetM + 1).padStart(2, "0")}-${String(targetDay).padStart(2, "0")}`;
      const dueTime = dateKeyToUtcMs(dueStr);
      const diffDays = Math.round((dueTime - todayTime) / 86400000);

      if (diffDays >= 0 && diffDays <= reminderDaysBefore) {
        reminders.push({
          id: `reminder-${cardId}-estimated-soon`,
          cardId,
          cardName: card.name,
          cardLastFour: card.cardDetails?.cardLastFour,
          statementId: undefined,
          dueDate: dueStr,
          daysRemaining: diffDays,
          urgency: diffDays === 0 ? "due_today" : "due_soon",
          remainingBalance: totalCardDebt,
          minimumPayment: roundCurrency(Math.min(totalCardDebt, Math.max(50, totalCardDebt * 0.05))),
          totalCardDebt,
          reminderDaysBefore,
        });
      }
    }
  }

  // Sort: overdue first (most days overdue), then due today, then due soon (soonest first)
  reminders.sort((a, b) => {
    const urgencyWeight = { overdue: 0, due_today: 1, due_soon: 2 };
    if (urgencyWeight[a.urgency] !== urgencyWeight[b.urgency]) {
      return urgencyWeight[a.urgency] - urgencyWeight[b.urgency];
    }
    return a.daysRemaining - b.daysRemaining;
  });

  return reminders;
}
