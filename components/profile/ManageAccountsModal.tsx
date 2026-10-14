"use client";

import { useState } from "react";
import { motion, Reorder } from "framer-motion";
import {
  X,
  GripVertical,
  Edit2,
  Check,
  Archive,
  Trash2,
  Plus,
  Landmark,
  Wallet,
  Smartphone,
  PiggyBank,
  CreditCard,
  TrendingUp,
} from "lucide-react";
import type { Account, AccountKind, CreditCardDetails } from "@/lib/types";

const CURRENCIES = ["RM", "SGD", "USD", "JPY"] as const;

const ACCOUNT_KINDS: {
  kind: AccountKind;
  label: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;
}[] = [
  { kind: "bank", label: "Bank", icon: Landmark },
  { kind: "cash", label: "Cash", icon: Wallet },
  { kind: "ewallet", label: "E-Wallet", icon: Smartphone },
  { kind: "savings", label: "Savings", icon: PiggyBank },
  { kind: "credit_card", label: "Credit Card", icon: CreditCard },
  { kind: "investment", label: "Investment", icon: TrendingUp },
];

/**
 * Drag-to-reorder, rename-in-place, archive, and delete account manager.
 * Supports selecting account kind (bank, cash, ewallet, savings, credit_card, investment),
 * optional opening balances, credit card parameters, and per-currency picker.
 */
export function ManageAccountsModal({
  accounts,
  accountObjects,
  reorderAccounts,
  renameAccount,
  toggleArchiveAccount,
  deleteAccount,
  addAccount,
  addCreditCardAccount,
  updateCreditCardDetails: _updateCreditCardDetails,
  confirmAction,
  triggerToast,
  accentColor,
  onClose,
}: {
  accounts: string[];
  accountObjects: Account[];
  reorderAccounts: (next: string[]) => Promise<void>;
  renameAccount: (oldName: string, next: string) => void;
  toggleArchiveAccount: (name: string) => void;
  deleteAccount: (name: string) => void;
  addAccount: (name: string, currency?: string, kind?: AccountKind, openingBalance?: number) => void;
  addCreditCardAccount?: (params: {
    name: string;
    currencyCode?: string;
    creditLimit?: number | null;
    openingBalance?: number;
    issuer?: string;
    cardLastFour?: string;
    statementDay: number;
    gracePeriodDays?: number;
    dueDay?: number | null;
    apr?: number | null;
    cardColor?: string | null;
    reminderDaysBefore?: number;
  }) => Promise<void>;
  updateCreditCardDetails?: (accountId: string, patch: Partial<CreditCardDetails>) => Promise<void>;
  confirmAction: (title: string, message: string, onConfirm: () => void) => void;
  triggerToast: (msg: string) => void;
  accentColor: string;
  onClose: () => void;
}) {
  const [newAccount, setNewAccount] = useState("");
  const [newAccountCurrency, setNewAccountCurrency] = useState<string>("RM");
  const [newAccountKind, setNewAccountKind] = useState<AccountKind>("bank");
  const [newAccountOpeningBalance, setNewAccountOpeningBalance] = useState("");
  const [editingAccount, setEditingAccount] = useState<string | null>(null);
  const [editingAccountVal, setEditingAccountVal] = useState("");

  // Credit card specific fields
  const [issuer, setIssuer] = useState("");
  const [cardLastFour, setCardLastFour] = useState("");
  const [creditLimit, setCreditLimit] = useState("");
  const [statementDay, setStatementDay] = useState("15");
  const [gracePeriodDays, setGracePeriodDays] = useState("20");
  const [apr, setApr] = useState("");
  const [reminderDaysBefore, setReminderDaysBefore] = useState("3");

  const archived = accountObjects.filter((a) => a.isArchived);

  const submitNew = async () => {
    const name = newAccount.trim();
    if (!name) {
      triggerToast("⚠️ Account name cannot be empty.");
      return;
    }
    const isDuplicate = accountObjects.some(
      (a) => a.name.trim().toLowerCase() === name.toLowerCase()
    );
    if (isDuplicate) {
      triggerToast(`⚠️ An account named "${name}" already exists.`);
      return;
    }

    const parsedBal = newAccountOpeningBalance.trim() ? parseFloat(newAccountOpeningBalance) : 0;
    const openingBalance = isNaN(parsedBal) ? 0 : parsedBal;

    if (newAccountKind === "credit_card" && addCreditCardAccount) {
      const sDay = parseInt(statementDay, 10);
      const validStatementDay = isNaN(sDay) || sDay < 1 ? 15 : Math.min(sDay, 31);
      const parsedGrace = parseInt(gracePeriodDays, 10);
      const validGrace = isNaN(parsedGrace) || parsedGrace < 0 ? 20 : parsedGrace;
      const parsedLimit = creditLimit.trim() ? parseFloat(creditLimit) : null;
      const validLimit = parsedLimit !== null && !isNaN(parsedLimit) && parsedLimit >= 0 ? parsedLimit : null;
      const parsedApr = apr.trim() ? parseFloat(apr) : null;
      const validApr = parsedApr !== null && !isNaN(parsedApr) && parsedApr >= 0 ? parsedApr : null;
      const parsedRemind = parseInt(reminderDaysBefore, 10);
      const validRemind = isNaN(parsedRemind) || parsedRemind < 0 ? 3 : parsedRemind;
      const cleanLastFour = cardLastFour.trim().slice(-4);

      await addCreditCardAccount({
        name,
        currencyCode: newAccountCurrency,
        openingBalance,
        creditLimit: validLimit,
        statementDay: validStatementDay,
        gracePeriodDays: validGrace,
        apr: validApr,
        issuer: issuer.trim() || undefined,
        cardLastFour: cleanLastFour || undefined,
        reminderDaysBefore: validRemind,
      });

      triggerToast(`Credit card "${name}" added!`);
      setNewAccount("");
      setNewAccountCurrency("RM");
      setNewAccountKind("bank");
      setNewAccountOpeningBalance("");
      setIssuer("");
      setCardLastFour("");
      setCreditLimit("");
      setStatementDay("15");
      setGracePeriodDays("20");
      setApr("");
      setReminderDaysBefore("3");
      return;
    }

    addAccount(name, newAccountCurrency, newAccountKind, openingBalance);
    triggerToast(`"${name}" added!`);
    setNewAccount("");
    setNewAccountCurrency("RM");
    setNewAccountKind("bank");
    setNewAccountOpeningBalance("");
  };

  const commitRename = (oldName: string) => {
    const next = editingAccountVal.trim();
    if (!next) {
      triggerToast("⚠️ Account name cannot be empty.");
      return;
    }
    if (next.toLowerCase() === oldName.trim().toLowerCase()) {
      setEditingAccount(null);
      return;
    }
    const isDuplicate = accountObjects.some(
      (a) => a.name.trim().toLowerCase() === next.toLowerCase() && a.name !== oldName
    );
    if (isDuplicate) {
      triggerToast(`⚠️ An account named "${next}" already exists.`);
      return;
    }
    renameAccount(oldName, next);
    setEditingAccount(null);
    triggerToast("Account renamed!");
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        aria-hidden="true"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />
      <motion.div
        initial={{ y: 20, opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 20, opacity: 0, scale: 0.95 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="accounts-title"
        className="bg-card w-full max-w-sm sm:max-w-md rounded-[2rem] shadow-heavy z-10 overflow-hidden flex flex-col max-h-[88vh]"
      >
        <div className="p-5 border-b border-border/40 flex justify-between items-center bg-muted/20">
          <h3 id="accounts-title" className="font-bold text-foreground">Manage Accounts</h3>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="p-1.5 hover:bg-muted rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
          </button>
        </div>

        <p className="px-5 pt-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider text-center">
          Drag to reorder
        </p>

        <div className="flex-1 overflow-y-auto p-4 hide-scrollbar space-y-2">
          <Reorder.Group axis="y" values={accounts} onReorder={reorderAccounts} className="space-y-2">
            {accounts.map((accName) => {
              const accObj = accountObjects.find(
                (a) => a.name.trim().toLowerCase() === accName.trim().toLowerCase()
              );
              const kindMeta =
                ACCOUNT_KINDS.find((k) => k.kind === (accObj?.kind || "bank")) || ACCOUNT_KINDS[0];
              const KindIcon = kindMeta.icon;

              return (
                <Reorder.Item
                  key={accName}
                  value={accName}
                  className="flex justify-between items-center bg-card shadow-sm p-3 rounded-xl border border-border/80 cursor-grab active:cursor-grabbing"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <GripVertical className="w-4 h-4 text-muted-foreground/50 shrink-0" aria-hidden="true" />
                    {editingAccount === accName ? (
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          autoFocus
                          value={editingAccountVal}
                          onChange={(e) => setEditingAccountVal(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") commitRename(accName); }}
                          aria-label={`Rename ${accName}`}
                          className="flex-1 bg-muted px-2 py-1 rounded-lg text-sm font-semibold outline-none text-foreground border border-border"
                        />
                        <button
                          type="button"
                          onClick={() => commitRename(accName)}
                          aria-label="Save rename"
                          style={{ backgroundColor: accentColor }}
                          className="p-1.5 text-white rounded-lg shrink-0"
                        >
                          <Check className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-foreground truncate">{accName}</span>
                          <span className="text-[9px] font-black text-muted-foreground/70 bg-muted px-1.5 py-0.5 rounded shrink-0">
                            {accObj?.currencyCode || "RM"}
                          </span>
                        </div>
                        {accObj?.kind === "credit_card" ? (
                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md inline-flex items-center gap-1 bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                              <CreditCard className="w-2.5 h-2.5 shrink-0" aria-hidden="true" />
                              {accObj.cardDetails?.issuer || kindMeta.label}
                              {accObj.cardDetails?.cardLastFour ? ` •••• ${accObj.cardDetails.cardLastFour}` : ""}
                            </span>
                            {accObj.creditLimit !== undefined && accObj.creditLimit !== null && (
                              <span className="text-[10px] font-mono text-muted-foreground/80 bg-muted/70 px-1.5 py-0.5 rounded">
                                Limit: {accObj.currencyCode || "RM"} {Number(accObj.creditLimit).toLocaleString()}
                              </span>
                            )}
                            <span className="text-[10px] font-mono text-muted-foreground/80 bg-muted/70 px-1.5 py-0.5 rounded">
                              Stmt: Day {accObj.statementDay || accObj.cardDetails?.statementDay || 15}
                            </span>
                            {accObj?.openingBalance !== undefined && Number(accObj.openingBalance) !== 0 && (
                              <span className="text-[10px] text-rose-500 font-mono font-medium">
                                Debt: {accObj.currencyCode || "RM"} {Math.abs(Number(accObj.openingBalance)).toFixed(2)}
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md inline-flex items-center gap-1 bg-muted/60 text-muted-foreground">
                              <KindIcon className="w-2.5 h-2.5 shrink-0" aria-hidden="true" />
                              {kindMeta.label}
                            </span>
                            {accObj?.openingBalance !== undefined && Number(accObj.openingBalance) !== 0 && (
                              <span className="text-[10px] text-muted-foreground/70 font-mono">
                                Init: {Number(accObj.openingBalance) > 0 ? `+${accObj.openingBalance}` : accObj.openingBalance}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {editingAccount !== accName && (
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      <button
                        type="button"
                        aria-label={`Rename ${accName}`}
                        onClick={() => { setEditingAccount(accName); setEditingAccountVal(accName); }}
                        className="text-muted-foreground hover:text-primary transition-colors p-1.5"
                      >
                        <Edit2 className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Archive ${accName}`}
                        onClick={() => { toggleArchiveAccount(accName); triggerToast(`"${accName}" archived`); }}
                        className="text-muted-foreground hover:text-amber-500 transition-colors p-1.5"
                      >
                        <Archive className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete ${accName}`}
                        onClick={() => {
                          confirmAction(
                            "Delete Account",
                            `Are you sure you want to remove "${accName}"?`,
                            () => {
                              deleteAccount(accName);
                              triggerToast(`"${accName}" removed.`);
                            }
                          );
                        }}
                        className="text-muted-foreground hover:text-red-500 transition-colors p-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  )}
                </Reorder.Item>
              );
            })}
          </Reorder.Group>

          {archived.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border/40">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 px-1">
                Archived
              </p>
              <div className="space-y-2">
                {archived.map((acc) => {
                  const kindMeta =
                    ACCOUNT_KINDS.find((k) => k.kind === (acc.kind || "bank")) || ACCOUNT_KINDS[0];
                  const KindIcon = kindMeta.icon;

                  return (
                    <div
                      key={acc.name}
                      className="flex justify-between items-center bg-muted/30 p-3 rounded-xl border border-border/50 opacity-60"
                    >
                      <div className="flex flex-col flex-1 min-w-0 mr-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-muted-foreground truncate">{acc.name}</span>
                          <span className="text-[9px] font-black text-muted-foreground/60 bg-muted px-1.5 py-0.5 rounded">
                            {acc.currencyCode || "RM"}
                          </span>
                        </div>
                        {acc.kind === "credit_card" ? (
                          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md inline-flex items-center gap-1 bg-purple-500/10 text-purple-600 dark:text-purple-400">
                              <CreditCard className="w-2.5 h-2.5 shrink-0" aria-hidden="true" />
                              {acc.cardDetails?.issuer || kindMeta.label}
                              {acc.cardDetails?.cardLastFour ? ` •••• ${acc.cardDetails.cardLastFour}` : ""}
                            </span>
                            {acc.creditLimit !== undefined && acc.creditLimit !== null && (
                              <span className="text-[10px] font-mono text-muted-foreground/60">
                                Limit: {acc.currencyCode || "RM"} {Number(acc.creditLimit).toLocaleString()}
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md inline-flex items-center gap-1 bg-muted/60 text-muted-foreground">
                              <KindIcon className="w-2.5 h-2.5 shrink-0" aria-hidden="true" />
                              {kindMeta.label}
                            </span>
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => { toggleArchiveAccount(acc.name); triggerToast(`"${acc.name}" restored`); }}
                        className="text-xs font-bold px-3 py-1 rounded-lg bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
                      >
                        Restore
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {accountObjects.length === 0 && (
            <p className="text-center text-sm font-medium text-muted-foreground py-4">
              No accounts defined!
            </p>
          )}
        </div>

        {/* Add Account Section */}
        <div className="p-4 border-t border-border/40 bg-muted/20 space-y-2.5 shrink-0">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-1">
            Add New Account
          </p>

          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                value={newAccount}
                onChange={(e) => setNewAccount(e.target.value)}
                type="text"
                placeholder={newAccountKind === "credit_card" ? "Card nickname (e.g. Maybank 2 Gold)" : "Account name (e.g. Maybank)"}
                aria-label="New account name"
                className="flex-1 bg-card rounded-xl px-3.5 py-2 text-sm font-medium outline-none border border-border text-foreground placeholder:text-muted-foreground/60"
                onKeyDown={(e) => { if (e.key === "Enter") submitNew(); }}
              />
              <input
                value={newAccountOpeningBalance}
                onChange={(e) => setNewAccountOpeningBalance(e.target.value)}
                type="number"
                step="any"
                placeholder={newAccountKind === "credit_card" ? "Current debt (0.00)" : "Initial balance (0.00)"}
                aria-label={newAccountKind === "credit_card" ? "Current debt" : "Opening balance"}
                className="w-36 bg-card rounded-xl px-3 py-2 text-sm font-medium outline-none border border-border text-foreground placeholder:text-muted-foreground/60"
                onKeyDown={(e) => { if (e.key === "Enter") submitNew(); }}
              />
            </div>

            {/* Account Kind Selection */}
            <div className="grid grid-cols-3 gap-1.5">
              {ACCOUNT_KINDS.map((item) => {
                const Icon = item.icon;
                const isSelected = newAccountKind === item.kind;
                return (
                  <button
                    key={item.kind}
                    type="button"
                    onClick={() => setNewAccountKind(item.kind)}
                    style={isSelected ? { backgroundColor: `${accentColor}1F`, borderColor: accentColor } : {}}
                    className={`flex items-center justify-center gap-1.5 py-1.5 px-2 text-[10px] font-bold rounded-lg border transition-all ${
                      isSelected
                        ? "border-primary text-foreground shadow-xs font-black"
                        : "bg-card border-border/60 text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <Icon className="w-3 h-3 shrink-0" aria-hidden="true" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Credit Card Specific Configuration Accordion/Panel */}
            {newAccountKind === "credit_card" && (
              <div className="p-3 bg-card rounded-xl border border-border/80 space-y-2 text-xs shadow-xs animate-in fade-in slide-in-from-top-1 duration-200">
                <div className="flex items-center justify-between text-[11px] font-bold">
                  <span className="flex items-center gap-1.5 text-foreground">
                    <CreditCard className="w-3.5 h-3.5 text-purple-500" aria-hidden="true" />
                    Card Settings
                  </span>
                  <span className="text-[10px] text-rose-500 font-semibold bg-rose-500/10 px-1.5 py-0.5 rounded">
                    Liability
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground block mb-1">
                      Bank / Issuer
                    </label>
                    <input
                      value={issuer}
                      onChange={(e) => setIssuer(e.target.value)}
                      type="text"
                      placeholder="e.g. Maybank / CIMB"
                      aria-label="Card issuer"
                      className="w-full bg-muted/50 rounded-lg px-2.5 py-1.5 text-xs font-medium outline-none border border-border text-foreground placeholder:text-muted-foreground/50"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground block mb-1">
                      Last 4 Digits
                    </label>
                    <input
                      value={cardLastFour}
                      onChange={(e) => setCardLastFour(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      type="text"
                      maxLength={4}
                      placeholder="e.g. 8821"
                      aria-label="Last 4 digits"
                      className="w-full bg-muted/50 rounded-lg px-2.5 py-1.5 text-xs font-mono font-medium outline-none border border-border text-foreground placeholder:text-muted-foreground/50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground block mb-1">
                      Credit Limit
                    </label>
                    <input
                      value={creditLimit}
                      onChange={(e) => setCreditLimit(e.target.value)}
                      type="number"
                      min="0"
                      step="any"
                      placeholder="e.g. 10000"
                      aria-label="Credit limit"
                      className="w-full bg-muted/50 rounded-lg px-2.5 py-1.5 text-xs font-medium outline-none border border-border text-foreground placeholder:text-muted-foreground/50"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground block mb-1">
                      Stmt Day
                    </label>
                    <input
                      value={statementDay}
                      onChange={(e) => setStatementDay(e.target.value)}
                      type="number"
                      min="1"
                      max="31"
                      placeholder="15"
                      aria-label="Statement closing day"
                      className="w-full bg-muted/50 rounded-lg px-2.5 py-1.5 text-xs font-medium outline-none border border-border text-foreground"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground block mb-1">
                      Grace (Days)
                    </label>
                    <input
                      value={gracePeriodDays}
                      onChange={(e) => setGracePeriodDays(e.target.value)}
                      type="number"
                      min="0"
                      max="60"
                      placeholder="20"
                      aria-label="Grace period in days"
                      className="w-full bg-muted/50 rounded-lg px-2.5 py-1.5 text-xs font-medium outline-none border border-border text-foreground"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground block mb-1">
                      APR % (Optional)
                    </label>
                    <input
                      value={apr}
                      onChange={(e) => setApr(e.target.value)}
                      type="number"
                      step="any"
                      placeholder="e.g. 15.0"
                      aria-label="Annual percentage rate"
                      className="w-full bg-muted/50 rounded-lg px-2.5 py-1.5 text-xs font-medium outline-none border border-border text-foreground placeholder:text-muted-foreground/50"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground block mb-1">
                      Reminder (Days)
                    </label>
                    <input
                      value={reminderDaysBefore}
                      onChange={(e) => setReminderDaysBefore(e.target.value)}
                      type="number"
                      min="0"
                      max="30"
                      placeholder="3"
                      aria-label="Payment reminder days before"
                      className="w-full bg-muted/50 rounded-lg px-2.5 py-1.5 text-xs font-medium outline-none border border-border text-foreground"
                    />
                  </div>
                </div>

                <p className="text-[10px] text-muted-foreground/80 leading-tight pt-0.5">
                  💡 Outstanding balance is treated as starting unpaid debt and reflected as a liability in your net worth.
                </p>
              </div>
            )}

            {/* Currency Selection + Submit Button */}
            <div className="flex items-center gap-2 pt-0.5">
              <div className="flex gap-1.5 flex-1">
                {CURRENCIES.map((cur) => (
                  <button
                    key={cur}
                    type="button"
                    onClick={() => setNewAccountCurrency(cur)}
                    style={newAccountCurrency === cur ? { backgroundColor: accentColor, color: "#fff" } : {}}
                    className={`flex-1 py-1.5 text-[10px] font-black tracking-wider rounded-lg transition-all ${
                      newAccountCurrency === cur
                        ? "shadow-sm scale-[1.03]"
                        : "bg-card text-muted-foreground hover:bg-border border border-border/40"
                    }`}
                  >
                    {cur}
                  </button>
                ))}
              </div>
              <button
                type="button"
                aria-label="Add account"
                style={{ backgroundColor: accentColor }}
                onClick={submitNew}
                className="text-white px-3.5 py-1.5 rounded-xl hover:scale-[1.02] active:scale-95 transition-transform flex items-center gap-1 text-xs font-bold shrink-0"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                <span>Add</span>
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
