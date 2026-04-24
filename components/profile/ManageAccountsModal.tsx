"use client";

import { useState } from "react";
import { motion, Reorder } from "framer-motion";
import { X, GripVertical, Edit2, Check, Archive, Trash2, Plus } from "lucide-react";
import type { Account } from "@/lib/types";

const CURRENCIES = ["RM", "SGD", "USD", "JPY"] as const;

/**
 * Drag-to-reorder, rename-in-place, archive, and delete account manager.
 * Also includes the archived list and the "add new account" form at the
 * bottom — both with their own per-currency picker.
 */
export function ManageAccountsModal({
  accounts,
  accountObjects,
  reorderAccounts,
  renameAccount,
  toggleArchiveAccount,
  deleteAccount,
  addAccount,
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
  addAccount: (name: string, currency?: string) => void;
  confirmAction: (title: string, message: string, onConfirm: () => void) => void;
  triggerToast: (msg: string) => void;
  accentColor: string;
  onClose: () => void;
}) {
  const [newAccount, setNewAccount] = useState("");
  const [newAccountCurrency, setNewAccountCurrency] = useState<string>("RM");
  const [editingAccount, setEditingAccount] = useState<string | null>(null);
  const [editingAccountVal, setEditingAccountVal] = useState("");

  const archived = accountObjects.filter((a) => a.isArchived);

  const submitNew = () => {
    const name = newAccount.trim();
    if (!name) return;
    addAccount(name, newAccountCurrency);
    triggerToast(`"${name}" added!`);
    setNewAccount("");
    setNewAccountCurrency("RM");
  };

  const commitRename = (oldName: string) => {
    const next = editingAccountVal.trim();
    if (!next) return;
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
        className="bg-card w-full max-w-sm rounded-[2rem] shadow-heavy z-10 overflow-hidden flex flex-col max-h-[85vh]"
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

        <p className="px-5 pt-4 text-xs font-bold text-muted-foreground uppercase tracking-wider text-center">
          Drag to reorder
        </p>

        <div className="flex-1 overflow-y-auto p-4 hide-scrollbar">
          <Reorder.Group axis="y" values={accounts} onReorder={reorderAccounts} className="space-y-2">
            {accounts.map((accName) => (
              <Reorder.Item
                key={accName}
                value={accName}
                className="flex justify-between items-center bg-card shadow-sm p-3 rounded-xl border border-border/80 cursor-grab active:cursor-grabbing"
              >
                <div className="flex items-center gap-3 flex-1">
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
                        className="p-1.5 text-white rounded-lg"
                      >
                        <Check className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  ) : (
                    <span className="font-medium text-sm text-foreground flex-1">{accName}</span>
                  )}
                </div>
                {editingAccount !== accName && (
                  <div className="flex items-center gap-1 shrink-0">
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
            ))}
          </Reorder.Group>

          {archived.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border/40">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 px-1">
                Archived
              </p>
              <div className="space-y-2">
                {archived.map((acc) => (
                  <div
                    key={acc.name}
                    className="flex justify-between items-center bg-muted/30 p-3 rounded-xl border border-border/50 opacity-60"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-muted-foreground">{acc.name}</span>
                      <span className="text-[9px] font-black text-muted-foreground/60 bg-muted px-1.5 py-0.5 rounded">
                        {acc.currencyCode}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => { toggleArchiveAccount(acc.name); triggerToast(`"${acc.name}" restored`); }}
                      className="text-xs font-bold px-3 py-1 rounded-lg bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Restore
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {accountObjects.length === 0 && (
            <p className="text-center text-sm font-medium text-muted-foreground py-4">
              No accounts defined!
            </p>
          )}
        </div>

        <div className="p-4 border-t border-border/40 bg-muted/20 space-y-2">
          <div className="flex gap-2">
            <input
              value={newAccount}
              onChange={(e) => setNewAccount(e.target.value)}
              type="text"
              placeholder="New account (e.g. Maybank)"
              aria-label="New account name"
              className="flex-1 bg-card rounded-xl px-4 py-2 text-sm font-medium outline-none border border-border text-foreground"
              onKeyDown={(e) => { if (e.key === "Enter") submitNew(); }}
            />
            <button
              type="button"
              aria-label="Add account"
              style={{ backgroundColor: accentColor }}
              onClick={submitNew}
              className="text-white p-3 rounded-xl hover:scale-[1.02] active:scale-95 transition-transform"
            >
              <Plus className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
          <div className="flex gap-1.5">
            {CURRENCIES.map((cur) => (
              <button
                key={cur}
                type="button"
                onClick={() => setNewAccountCurrency(cur)}
                style={newAccountCurrency === cur ? { backgroundColor: accentColor, color: "#fff" } : {}}
                className={`flex-1 py-1.5 text-[10px] font-black tracking-wider rounded-lg transition-all ${
                  newAccountCurrency === cur
                    ? "shadow-sm scale-[1.03]"
                    : "bg-muted text-muted-foreground hover:bg-border"
                }`}
              >
                {cur}
              </button>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
