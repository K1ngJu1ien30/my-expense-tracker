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
    todayDateStr = new Date().toISOString().split("T")[0],
  } = params;

  const todayTime = new Date(todayDateStr).getTime();
  const reminders: CreditCardReminder[] = [];

  const creditCards = accountObjects.filter(
    (a) => a.kind === "credit_card" && !a.isArchived
  );

  for (const card of creditCards) {
    const cardId = card.id || card.name;
    const cardBal = accountBalances[card.name] ?? (Number(card.openingBalance) || 0);
    const totalCardDebt = cardBal < 0 ? Math.round(Math.abs(cardBal) * 100) / 100 : 0;
    const reminderDaysBefore = card.cardDetails?.reminderDaysBefore ?? 3;

    // Filter statements for this card, sorted by dueDate ASC (oldest due first)
    const cardStatements = statements
      .filter((s) => s.accountId === cardId || s.accountId === card.name)
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

    // Find unsettled statements
    const unsettled = cardStatements.filter((s) => {
      if (s.isSettled) return false;
      const remaining = calculateStatementRemaining(
        s,
        creditCardPayments,
        creditCardAllocations
      );
      return remaining > 0.005;
    });

    if (unsettled.length > 0) {
      // Evaluate each unsettled statement
      for (const st of unsettled) {
        const remaining = calculateStatementRemaining(
          st,
          creditCardPayments,
          creditCardAllocations
        );
        const minRemaining = calculateMinimumRemaining(
          st,
          creditCardPayments,
          creditCardAllocations
        );
        const dueTime = new Date(st.dueDate).getTime();
        const diffDays = Math.ceil((dueTime - todayTime) / 86400000);

        if (diffDays < 0) {
          // Overdue
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
          // Due Today
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
          // Due soon within configured window
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
      // Fallback: No issued statement entered, but card has outstanding debt and configured dueDay
      const today = new Date(todayDateStr);
      const currentMonthDue = new Date(today.getFullYear(), today.getMonth(), card.dueDay);
      let targetDueDate = currentMonthDue;
      if (today.getDate() > card.dueDay) {
        targetDueDate = new Date(today.getFullYear(), today.getMonth() + 1, card.dueDay);
      }
      const dueStr = targetDueDate.toISOString().split("T")[0];
      const diffDays = Math.ceil((targetDueDate.getTime() - todayTime) / 86400000);

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
          minimumPayment: Math.min(totalCardDebt, Math.max(50, totalCardDebt * 0.05)),
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
