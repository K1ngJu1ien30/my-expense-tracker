"use client";

import { useState, useMemo } from "react";
import { ArrowLeft, Copy, Check, Clipboard, FileText, CheckCircle2, AlertCircle, ArrowRight, Upload } from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useAppContext } from "@/lib/context";
import { NativeHaptics } from "@/lib/haptics";
import type { Transaction } from "@/lib/types";

export const STATEMENT_PROMPT_STRING = `Parse the uploaded bank statement(s) into JSON. One or more files may be attached.

For each transaction row found:
- date: YYYY-MM-DD
- description: clean merchant/payee name (remove codes, reference numbers, trailing digits)
- amount: NEGATIVE for expenses/debits, POSITIVE for income/credits
- category: best match from my categories below using 'Parent > Subcategory' when a subcategory fits, just parent name otherwise, 'Other' if unsure
- account: specific account name as printed on the statement (e.g. 'Chase Sapphire Reserve', 'OCBC 365 Credit Card'), not generic labels

Skip only: balance lines, statement totals, disclosures, headers/footers.

## My Accounts
Cash Wallet, Digital Wallet, Checking Account, Savings Account, Credit Card

## My Expense Categories
- Food
- Groceries
- Transport
- Housing
- Bills
- Healthcare
- Shopping
- Other

## My Income Categories
- Salary

Reply with ONLY a json code block, no other text:
{
  "statement": {
    "issuer": "<name or 'Multiple'>",
    "period": { "start": "YYYY-MM-DD", "end": "YYYY-MM-DD" }
  },
  "transactions": [
    { "date": "YYYY-MM-DD", "description": "...", "amount": -0.00, "category": "...", "account": "..." }
  ]
}

## Rules
- NEVER fabricate or hallucinate transactions. Only output what is in the document.
- NEVER skip, truncate, or omit transactions. Read every page of every file from start to finish. Output every single transaction row.
- If multiple files are uploaded, process each file fully then merge all transactions into the single 'transactions' array.
- If the statement spans a year boundary and only shows month/day, infer the year from the statement period.
- Do not ask questions, do not refuse, do not offer to split into multiple responses.
- If your output gets cut off, stop mid-JSON and I will reply 'continue' so you can finish. Do not stop early to avoid being cut off, just keep going.`;

export type ParsedImportItem = {
  id: string;
  date: string;
  note: string;
  amount: number;
  type: "Expense" | "Income";
  category: string;
  account: string;
  selected: boolean;
};

export default function StatementImportPage() {
  const { categories, accounts, addTransaction, triggerToast, accentColor, formatCurrency } = useAppContext();
  const activeAccent = accentColor || "#3b82f6";

  const [copied, setCopied] = useState(false);
  const [jsonText, setJsonText] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsedItems, setParsedItems] = useState<ParsedImportItem[]>([]);
  const [statementInfo, setStatementInfo] = useState<{ issuer?: string; period?: { start?: string; end?: string } } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importedCount, setImportedCount] = useState<number | null>(null);

  // ─── Step 1: Copy Prompt to Clipboard ────────────────────────────────────
  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(STATEMENT_PROMPT_STRING);
      setCopied(true);
      NativeHaptics.successMedium();
      triggerToast("📋 AI Prompt copied to clipboard!");
      setTimeout(() => setCopied(false), 3000);
    } catch {
      triggerToast("Failed to copy automatically. Please select text manually.");
    }
  };

  // ─── Step 2: Paste from Clipboard ────────────────────────────────────────
  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setJsonText(text);
        NativeHaptics.lightTick();
        triggerToast("Pasted JSON from clipboard!");
      }
    } catch {
      triggerToast("Clipboard read blocked. Please paste directly into text area.");
    }
  };

  // ─── Category & Merchant Fallback Normalizer ─────────────────────────────
  const normalizeCategory = (categoryStr: string, descStr: string): string => {
    const rawCat = (categoryStr || "").trim();
    const desc = (descStr || "").toLowerCase();

    // If category is in 'Parent > Subcategory' format, extract Parent
    let cat = rawCat.includes(">") ? rawCat.split(">")[0].trim() : rawCat;

    // Check exact match in active categories
    const exactMatch = categories.find((c) => c.toLowerCase() === cat.toLowerCase());
    if (exactMatch) return exactMatch;

    // Merchant keyword fallbacks
    if (/mcdonald|kfc|starbucks|tealive|restoran|grabfood|foodpanda|subway|nasi|cafe|bakery|boba/i.test(desc)) {
      return categories.find((c) => c.toLowerCase() === "food") || "Food";
    }
    if (/shopee|lazada|taobao|zalora|uniqlo|amazon|shein|watson|guardian/i.test(desc)) {
      return categories.find((c) => c.toLowerCase() === "shopping") || "Shopping";
    }
    if (/grab|gojek|touch n go|tng|petronas|shell|caltex|bhp|rapidkl|mrt|lrt|toll/i.test(desc)) {
      return categories.find((c) => c.toLowerCase() === "transport") || "Transport";
    }
    if (/lotus|jaya grocer|village grocer|mydin|speedmart|aeon|giant|supermarket/i.test(desc)) {
      return categories.find((c) => c.toLowerCase() === "groceries") || "Groceries";
    }
    if (/tenaga|syabas|air selangor|telekom|maxis|celcom|digi|unifi|utility|bill/i.test(desc)) {
      return categories.find((c) => c.toLowerCase() === "bills") || "Bills";
    }
    if (/clinic|klinik|hospital|pharmacy|farmasi|doctor/i.test(desc)) {
      return categories.find((c) => c.toLowerCase() === "healthcare") || "Healthcare";
    }

    return "Other";
  };

  // ─── Account Normalizer ──────────────────────────────────────────────────
  const normalizeAccount = (accountStr: string): string => {
    if (!accounts || accounts.length === 0) return "Cash";
    const target = (accountStr || "").trim().toLowerCase();
    const match = accounts.find((a) => a.toLowerCase() === target || a.toLowerCase().includes(target));
    if (match) return match;
    // Fallback to first available account
    return accounts[0] || "Cash";
  };

  // ─── Step 3: Parse JSON Result ───────────────────────────────────────────
  const handleParseJSON = () => {
    setParseError(null);
    setImportedCount(null);

    if (!jsonText.trim()) {
      setParseError("Please paste the JSON output from ChatGPT / Gemini first.");
      return;
    }

    try {
      // Clean markdown code blocks if present
      let clean = jsonText.trim();
      if (clean.startsWith("```")) {
        clean = clean.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
      }

      const parsed = JSON.parse(clean);

      const rawTxs = Array.isArray(parsed.transactions)
        ? parsed.transactions
        : Array.isArray(parsed)
        ? parsed
        : null;

      if (!rawTxs || rawTxs.length === 0) {
        setParseError("No 'transactions' array found in the JSON object.");
        return;
      }

      if (parsed.statement) {
        setStatementInfo(parsed.statement);
      }

      const mappedItems: ParsedImportItem[] = rawTxs.map((row: any, idx: number) => {
        const rawAmount = Number(row.amount || 0);
        // Negative amount = Expense, Positive amount = Income
        const isExpense = rawAmount < 0;
        const absAmount = Math.abs(rawAmount);

        const desc = (row.description || "Statement Transaction").trim();
        const cat = isExpense
          ? normalizeCategory(row.category || "", desc)
          : categories.find((c) => c.toLowerCase() === "salary" || c.toLowerCase() === "income") || "Income";
        const acc = normalizeAccount(row.account || "");

        // Format date string YYYY-MM-DD
        let dateStr = row.date || new Date().toISOString().split("T")[0];
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
          const parsedD = new Date(dateStr);
          if (!isNaN(parsedD.getTime())) {
            dateStr = parsedD.toISOString().split("T")[0];
          } else {
            dateStr = new Date().toISOString().split("T")[0];
          }
        }

        return {
          id: `import-${idx}-${Date.now()}`,
          date: dateStr,
          note: desc,
          amount: absAmount,
          type: isExpense ? "Expense" : "Income",
          category: cat,
          account: acc,
          selected: true,
        };
      });

      setParsedItems(mappedItems);
      NativeHaptics.successMedium();
      triggerToast(`✅ Parsed ${mappedItems.length} transactions!`);
    } catch (err: any) {
      console.error(err);
      setParseError(`JSON Parsing Error: ${err.message || "Invalid JSON format"}. Make sure to paste valid JSON.`);
    }
  };

  // Toggle selection
  const toggleSelectItem = (id: string) => {
    setParsedItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item))
    );
  };

  const toggleSelectAll = () => {
    const allSelected = parsedItems.every((i) => i.selected);
    setParsedItems((prev) => prev.map((item) => ({ ...item, selected: !allSelected })));
  };

  // Update item field
  const updateItemField = (id: string, field: keyof ParsedImportItem, value: any) => {
    setParsedItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  // ─── Step 4: Batch Import to Database ────────────────────────────────────
  const handleExecuteImport = async () => {
    const selectedItems = parsedItems.filter((i) => i.selected);
    if (selectedItems.length === 0) {
      triggerToast("No transactions selected for import.");
      return;
    }

    setIsImporting(true);
    let successCount = 0;

    try {
      for (const item of selectedItems) {
        const payload: Partial<Transaction> = {
          date: item.date,
          note: item.note,
          amount: item.amount,
          type: item.type,
          category: item.category,
          account: item.account,
        };
        await addTransaction(payload);
        successCount++;
      }

      setImportedCount(successCount);
      setParsedItems([]);
      setJsonText("");
      NativeHaptics.successMedium();
      triggerToast(`🎉 Successfully imported ${successCount} transactions!`);
    } catch (err) {
      console.error(err);
      triggerToast("An error occurred during import. Please try again.");
    } finally {
      setIsImporting(false);
    }
  };

  const selectedCount = parsedItems.filter((i) => i.selected).length;
  const selectedTotal = parsedItems
    .filter((i) => i.selected)
    .reduce((sum, i) => sum + (i.type === "Expense" ? i.amount : -i.amount), 0);

  return (
    <div className="p-6 space-y-6 pb-32 animate-in fade-in duration-500 min-h-[100dvh]">
      {/* Top Bar */}
      <div className="flex items-center justify-between pt-2">
        <Link
          href="/profile"
          onClick={() => NativeHaptics.lightTick()}
          className="flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Profile
        </Link>
        <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">
          AI Statement Import
        </span>
      </div>

      {/* Header Banner */}
      <div className="bg-card rounded-3xl p-5 border border-border/40 shadow-soft space-y-2">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-rose-500/10 text-rose-500">
            <Upload className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-foreground">Import Bank Statement</h1>
            <p className="text-xs text-muted-foreground font-medium">
              Parse PDFs or images using AI & auto-import transactions
            </p>
          </div>
        </div>
      </div>

      {/* ─── STEP 1: COPY PROMPT CARD ──────────────────────────────────────── */}
      <div className="bg-card p-5 rounded-3xl border border-border/40 shadow-soft space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-black flex items-center justify-center">
              1
            </span>
            <h2 className="text-sm font-black text-foreground">Copy AI Statement Prompt</h2>
          </div>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          Copy this prompt, then attach your bank statement file(s) in ChatGPT, Gemini, or Claude. Paste the prompt and send.
        </p>

        {/* Large Prominent Copy Prompt Button */}
        <button
          type="button"
          onClick={handleCopyPrompt}
          style={copied ? {} : { backgroundColor: activeAccent }}
          className={`w-full py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2.5 transition-all shadow-md active:scale-[0.98] ${
            copied ? "bg-emerald-500 text-white" : "text-white"
          }`}
        >
          {copied ? (
            <>
              <Check className="w-5 h-5" />
              Prompt Copied to Clipboard!
            </>
          ) : (
            <>
              <Copy className="w-5 h-5" />
              Copy AI Prompt
            </>
          )}
        </button>

        {/* Prompt Preview Accordion/Box */}
        <details className="text-xs text-muted-foreground bg-muted/40 rounded-2xl border border-border/30 overflow-hidden">
          <summary className="p-3 font-bold cursor-pointer hover:text-foreground select-none">
            View exact prompt string
          </summary>
          <pre className="p-3 font-mono text-[10px] whitespace-pre-wrap leading-relaxed text-muted-foreground border-t border-border/30 max-h-48 overflow-y-auto hide-scrollbar select-all">
            {STATEMENT_PROMPT_STRING}
          </pre>
        </details>
      </div>

      {/* ─── STEP 2: IMPORT RESULT / PASTE JSON ───────────────────────────── */}
      <div className="bg-card p-5 rounded-3xl border border-border/40 shadow-soft space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-black flex items-center justify-center">
              2
            </span>
            <h2 className="text-sm font-black text-foreground">Paste JSON Result</h2>
          </div>
          <button
            type="button"
            onClick={handlePasteClipboard}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted/60 hover:bg-muted text-xs font-bold text-foreground transition-all"
          >
            <Clipboard className="w-3.5 h-3.5" />
            Paste Clipboard
          </button>
        </div>

        <textarea
          rows={6}
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
          placeholder={`Paste the AI's JSON output here... e.g. { "transactions": [...] }`}
          className="w-full bg-muted/30 border border-border/50 rounded-2xl p-3.5 text-xs font-mono text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary transition-colors resize-none"
        />

        {parseError && (
          <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs font-semibold flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{parseError}</span>
          </div>
        )}

        <button
          type="button"
          onClick={handleParseJSON}
          className="w-full py-3.5 rounded-2xl bg-foreground text-background font-bold text-xs flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-sm"
        >
          <FileText className="w-4 h-4" />
          Parse & Preview Transactions
        </button>
      </div>

      {/* Success Notification Banner */}
      {importedCount !== null && (
        <div className="p-4 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-xs font-bold flex items-center gap-3 animate-in fade-in duration-300">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <div>
            <p className="text-sm font-black">Import Completed!</p>
            <p className="font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">
              Successfully saved {importedCount} transactions to your database.
            </p>
          </div>
        </div>
      )}

      {/* ─── STEP 3: PREVIEW & BATCH IMPORT TABLE ─────────────────────────── */}
      {parsedItems.length > 0 && (
        <div className="bg-card p-5 rounded-3xl border border-border/40 shadow-soft space-y-4 animate-in fade-in duration-300">
          <div className="flex items-center justify-between border-b border-border/40 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-black flex items-center justify-center">
                  3
                </span>
                <h2 className="text-sm font-black text-foreground">Review & Import</h2>
              </div>
              {statementInfo?.issuer && (
                <p className="text-[11px] font-bold text-muted-foreground mt-1">
                  Issuer: {statementInfo.issuer}{" "}
                  {statementInfo.period?.start && `(${statementInfo.period.start} to ${statementInfo.period.end})`}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={toggleSelectAll}
              className="text-xs font-bold text-primary hover:underline"
            >
              {parsedItems.every((i) => i.selected) ? "Deselect All" : "Select All"}
            </button>
          </div>

          {/* Parsed List */}
          <div className="space-y-3 max-h-[400px] overflow-y-auto hide-scrollbar pr-1">
            {parsedItems.map((item) => (
              <div
                key={item.id}
                className={`p-3.5 rounded-2xl border transition-all space-y-2.5 ${
                  item.selected
                    ? "bg-muted/40 border-border/60"
                    : "bg-muted/10 border-border/20 opacity-60"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <input
                      type="checkbox"
                      checked={item.selected}
                      onChange={() => toggleSelectItem(item.id)}
                      className="w-4 h-4 rounded border-border text-primary focus:ring-0 cursor-pointer"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-foreground truncate">{item.note}</p>
                      <p className="text-[10px] text-muted-foreground font-semibold">{item.date}</p>
                    </div>
                  </div>

                  <span
                    className={`text-xs font-black shrink-0 ${
                      item.type === "Expense" ? "text-rose-500" : "text-emerald-500"
                    }`}
                  >
                    {item.type === "Expense" ? "-" : "+"}
                    {formatCurrency(item.amount)}
                  </span>
                </div>

                {/* Edit Controls Row */}
                {item.selected && (
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/30">
                    <div>
                      <label className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground block mb-0.5">
                        Category
                      </label>
                      <select
                        value={item.category}
                        onChange={(e) => updateItemField(item.id, "category", e.target.value)}
                        className="w-full bg-card border border-border/50 rounded-xl px-2 py-1 text-xs font-semibold text-foreground outline-none"
                      >
                        {categories.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground block mb-0.5">
                        Account
                      </label>
                      <select
                        value={item.account}
                        onChange={(e) => updateItemField(item.id, "account", e.target.value)}
                        className="w-full bg-card border border-border/50 rounded-xl px-2 py-1 text-xs font-semibold text-foreground outline-none"
                      >
                        {accounts.map((acc) => (
                          <option key={acc} value={acc}>
                            {acc}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Import Action Bar */}
          <div className="pt-3 border-t border-border/40 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-foreground">
                {selectedCount} item{selectedCount !== 1 ? "s" : ""} selected
              </p>
              <p className="text-[10px] text-muted-foreground font-semibold">
                Net Expense: {formatCurrency(selectedTotal)}
              </p>
            </div>

            <button
              type="button"
              onClick={handleExecuteImport}
              disabled={isImporting || selectedCount === 0}
              style={{ backgroundColor: activeAccent }}
              className="px-5 py-3 rounded-2xl text-white font-bold text-xs flex items-center gap-2 active:scale-95 transition-all shadow-md disabled:opacity-50"
            >
              {isImporting ? (
                "Importing..."
              ) : (
                <>
                  Import Selected
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
