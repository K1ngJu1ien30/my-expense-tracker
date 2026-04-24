"use client";

import { useState } from "react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { X, ArrowRight, Calendar, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect } from "react";

import { useAppContext } from "@/lib/context";
import { NativeHaptics } from "@/lib/haptics";
import { loadModel, predict, type Prediction, type PredictorModel } from "@/lib/categoryPredictor";

type TxType = "Expense" | "Income" | "Transfer";


function SegmentedControl({ value, onChange }: { value: TxType; onChange: (val: TxType) => void }) {
  const options: TxType[] = ["Expense", "Income", "Transfer"];
  return (
    <div className="flex bg-muted p-1 rounded-2xl relative w-full mb-6">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={cn(
            "flex-1 py-2 text-sm font-semibold rounded-xl relative z-10 transition-colors",
            value === opt ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {value === opt && (
            <motion.div
              layoutId="segment-active"
              className="absolute inset-0 bg-primary rounded-xl -z-10 shadow-sm"
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
            />
          )}
          {opt}
        </button>
      ))}
    </div>
  );
}

function PillSelector({ options, value, onChange }: { options: string[], value: string, onChange: (val: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2 pb-2">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={cn(
            "whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-all",
            value === opt 
              ? "bg-primary text-primary-foreground shadow-soft" 
              : "bg-muted text-muted-foreground hover:bg-border"
          )}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

export default function TransactionModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { categories, triggerToast, accentColor, addTransaction, updateTransaction, transactions, editTransactionId, setEditTransactionId, accounts, currency, exchangeRates, triggerDerry } = useAppContext();
  
  const [txType, setTxType] = useState<TxType>("Expense");
  const [modalCurrency, setModalCurrency] = useState(currency);
  const [account, setAccount] = useState("");
  const [toAccount, setToAccount] = useState("");
  const [category, setCategory] = useState(categories[0] || "Food");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerMonth, setPickerMonth] = useState(() => new Date());
  const [status, setStatus] = useState<"cleared" | "pending">("cleared");
  const [isClaimable, setIsClaimable] = useState(false);

  // ─── Category auto-suggest state ───────────────────────────────────────
  // Loaded once when the modal opens; refreshed on close so learnings from
  // the previous save appear on the next open.
  const [predictorModel, setPredictorModel] = useState<PredictorModel | null>(null);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  // Dismissed suggestions shouldn't re-appear for the same note in this session.
  const [dismissedForNote, setDismissedForNote] = useState<string>("");
  // Track whether the user manually picked a category so we don't overwrite
  // their choice with a later prediction.
  const [userPickedCategory, setUserPickedCategory] = useState(false);

  const isActuallyOpen = isOpen || editTransactionId !== null;

  useEffect(() => {
    // Seed default accounts once the accounts list arrives from the
    // context loader. This effect is a one-shot form initializer, not a
    // render-driven update — silencing the linter is intentional here.
     
    if (!account && accounts.length > 0) setAccount(accounts[0]);
     
    if (!toAccount && accounts.length > 1) setToAccount(accounts[1] || accounts[0]);
    // `account`/`toAccount` deliberately excluded — including them would
    // re-trigger the seed on every pick and overwrite user selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts]);

  useEffect(() => {
    if (editTransactionId) {
       const tx = transactions.find(t => t.id === editTransactionId);
       if (tx) {
         // Load-into-form-on-edit — a form initializer, same rationale as
         // the accounts seed above. Not a cascading-render pattern.
          
         setTxType(tx.type as TxType);
         setCategory(tx.category || categories[0]);
         setAccount(tx.account || "Bank (MBB)");
         if (tx.to_account) setToAccount(tx.to_account);
         setAmount(String(tx.amount));
         setNote(tx.note || "");
         setDate(tx.date ? new Date(tx.date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0]);
         setStatus((tx.status as "cleared" | "pending") || "cleared");
         setIsClaimable(tx.is_claimable === true);
         setUserPickedCategory(true); // Editing an existing tx — respect its category
          
       }
    } else {
        
       setAmount("");
       setNote("");
       setDate(new Date().toISOString().split("T")[0]);
       setStatus("cleared");
       setIsClaimable(false);
       setUserPickedCategory(false);
       setDismissedForNote("");
        
    }
  }, [editTransactionId, transactions, categories]);

  // Load the predictor model once when the modal opens. Reload on every open
  // so freshly-learned associations from the previous save are available.
  useEffect(() => {
    if (!isActuallyOpen) return;
    loadModel().then(setPredictorModel).catch(() => setPredictorModel({}));
  }, [isActuallyOpen]);

  // Re-score the note whenever it changes. Only suggests for new expenses
  // (editing a transaction respects its saved category) and hides the pill
  // once the user has dismissed it or manually changed the category.
  useEffect(() => {
     
    if (!predictorModel) { setPrediction(null); return; }
    if (txType !== "Expense") { setPrediction(null); return; }
    if (editTransactionId) { setPrediction(null); return; }
    if (userPickedCategory) { setPrediction(null); return; }
    if (!note || note === dismissedForNote) { setPrediction(null); return; }

    const p = predict(predictorModel, note, transactions.length);
    // Don't suggest what's already selected — no value in reaffirming.
    if (p && p.category === category) { setPrediction(null); return; }
    // Also skip if the suggested category isn't in the user's current list
    // (e.g. they renamed/deleted a category after training).
    if (p && !categories.includes(p.category)) { setPrediction(null); return; }
    setPrediction(p);
     
  }, [note, txType, editTransactionId, userPickedCategory, dismissedForNote, predictorModel, transactions.length, category, categories]);

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > 100) handleClose();
  };

  const handleClose = () => {
    setEditTransactionId(null);
    onClose();
  };

  return (
    <AnimatePresence>
      {isActuallyOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            aria-hidden="true"
            className="absolute inset-0 bg-black/40 backdrop-blur-sm z-50 rounded-[inherit]"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            drag="y"
            dragConstraints={{ top: 0 }}
            dragElastic={0.2}
            onDragEnd={handleDragEnd}
            role="dialog"
            aria-modal="true"
            aria-labelledby="tx-modal-title"
            className="absolute bottom-0 left-0 right-0 bg-card z-[51] rounded-t-[2rem] shadow-heavy flex flex-col max-h-[90vh]"
          >
            <div className="w-12 h-1.5 bg-border rounded-full mx-auto mt-3 mb-5 cursor-grab active:cursor-grabbing" aria-hidden="true" />
            
            <div className="px-6 pb-8 overflow-y-auto hide-scrollbar">
              <div className="flex items-center justify-between mb-4">
                <h2 id="tx-modal-title" className="text-xl font-bold">{editTransactionId ? "Edit" : "New"} Transaction</h2>
                <button type="button" aria-label="Close" onClick={handleClose} className="p-2 bg-muted rounded-full text-muted-foreground hover:text-foreground transition-colors">
                  <X className="w-5 h-5" aria-hidden="true" />
                </button>
              </div>

              <SegmentedControl value={txType} onChange={setTxType} />

              <div className="mb-4 flex flex-col items-center justify-center py-6 bg-muted/50 rounded-3xl">
                <div className="flex bg-muted p-1 rounded-xl mb-4">
                   {["RM", "SGD", "USD", "JPY"].map(c => (
                     <button 
                       key={c}
                       onClick={() => setModalCurrency(c)}
                       style={modalCurrency === c ? { backgroundColor: accentColor, color: '#fff' } : {}}
                       className={`px-3 py-1.5 text-[10px] font-black tracking-wider rounded-lg transition-all ${modalCurrency === c ? 'shadow-sm scale-110 z-10' : 'text-muted-foreground hover:text-foreground'}`}
                     >
                       {c}
                     </button>
                   ))}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-muted-foreground">{modalCurrency}</span>
                  <input 
                    type="number" 
                    placeholder="0.00" 
                    aria-label="Amount"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="bg-transparent text-5xl font-black text-foreground outline-none w-full max-w-[200px] text-center placeholder:text-muted"
                    autoFocus
                  />
                </div>
                {modalCurrency !== currency && amount && (() => {
                  // Convert: amount is in modalCurrency, show equivalent in base (MYR)
                  // exchangeRates is based on MYR, so rates[X] = how many X per 1 MYR
                  const rateMap: Record<string, string> = { "RM": "MYR", "MYR": "MYR", "USD": "USD", "SGD": "SGD", "JPY": "JPY" };
                  const foreignCode = rateMap[modalCurrency] || modalCurrency;
                  const foreignRate = exchangeRates[foreignCode];
                  const converted = foreignRate ? (Number(amount) / foreignRate) : null;
                  return converted !== null ? (
                    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 text-xs font-bold text-muted-foreground bg-background px-3 py-1.5 rounded-lg border border-border/50">
                      ≈ {currency} {converted.toFixed(2)}
                    </motion.p>
                  ) : null;
                })()}
              </div>

              <div className="space-y-6">
                {txType === "Transfer" ? (
                  <div className="p-4 bg-muted/30 rounded-2xl border border-border/50 flex flex-col gap-3">
                    <div>
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-2">From Account</label>
                      <PillSelector options={accounts} value={account} onChange={setAccount} />
                    </div>
                    <div className="flex justify-center -my-1 rounded-full relative z-10 w-full">
                      <div className="bg-card border border-border p-1.5 rounded-full shadow-sm text-muted-foreground">
                        <ArrowRight className="w-4 h-4 rotate-90" />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-2">To Account</label>
                      <PillSelector options={accounts} value={toAccount} onChange={setToAccount} />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-3">Account</label>
                    <PillSelector options={accounts} value={account} onChange={setAccount} />
                  </div>
                )}

                {txType !== "Transfer" && txType !== "Income" && (
                  <div>
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-3">Category</label>
                    {/*
                      Smart Suggestion Pill — appears only when the predictor
                      is confident. One tap applies the suggestion (and also
                      teaches the model by later save). X dismisses for the
                      current note only.
                    */}
                    <AnimatePresence>
                      {prediction && (
                        <motion.button
                          key={prediction.category}
                          type="button"
                          initial={{ opacity: 0, y: -4, scale: 0.96 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -4, scale: 0.96 }}
                          transition={{ type: "spring", damping: 20, stiffness: 320 }}
                          onClick={() => {
                            setCategory(prediction.category);
                            setUserPickedCategory(true);
                            setPrediction(null);
                            NativeHaptics.lightTick();
                          }}
                          aria-label={`Use suggested category ${prediction.category}`}
                          className="w-full mb-3 flex items-center gap-2.5 bg-card border border-border/50 rounded-xl px-3 py-2.5 shadow-sm hover:border-primary/40 active:scale-[0.99] transition-all text-left"
                          style={{ borderColor: `${accentColor}33` }}
                        >
                          <Sparkles className="w-3.5 h-3.5 shrink-0" style={{ color: accentColor }} aria-hidden="true" />
                          <span className="text-[11px] font-semibold text-muted-foreground">
                            Looks like{" "}
                            <span className="font-black" style={{ color: accentColor }}>
                              {prediction.category}
                            </span>
                            ?
                          </span>
                          <span
                            role="presentation"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDismissedForNote(note);
                              setPrediction(null);
                            }}
                            className="ml-auto text-muted-foreground/70 hover:text-muted-foreground p-0.5 cursor-pointer"
                            aria-hidden="true"
                          >
                            <X className="w-3 h-3" />
                          </span>
                        </motion.button>
                      )}
                    </AnimatePresence>
                    <PillSelector
                      options={categories}
                      value={category}
                      onChange={(c) => { setCategory(c); setUserPickedCategory(true); }}
                    />
                  </div>
                )}

                {txType === "Income" && (
                  <div>
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-3">Status</label>
                    <div className="flex bg-muted p-1 rounded-2xl w-full">
                      {(["cleared", "pending"] as const).map(s => (
                        <button
                          key={s}
                          onClick={() => setStatus(s)}
                          className={cn(
                            "flex-1 py-2 text-sm font-semibold rounded-xl relative z-10 transition-colors",
                            status === s ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {status === s && (
                            <motion.div
                              layoutId="status-active"
                              className={`absolute inset-0 rounded-xl -z-10 shadow-sm ${s === "cleared" ? "bg-emerald-500" : "bg-amber-500"}`}
                              transition={{ type: "spring", stiffness: 300, damping: 25 }}
                            />
                          )}
                          {s === "cleared" ? "Cleared (In Bank)" : "Pending"}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {txType === "Expense" && (
                  <div
                    className="flex items-center justify-between p-4 bg-muted/30 rounded-2xl border border-border/50 cursor-pointer"
                    onClick={() => setIsClaimable(!isClaimable)}
                  >
                    <div>
                      <p className="text-sm font-bold text-foreground">Claimable / Split Bill</p>
                      <p className="text-[10px] text-muted-foreground font-medium mt-0.5">Mark as reimbursable or shared expense</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isClaimable}
                      aria-label="Mark as claimable or split bill"
                      className={`w-12 h-7 rounded-full transition-colors relative flex items-center pointer-events-none ${isClaimable ? "" : "bg-muted border border-border"}`}
                      style={isClaimable ? { backgroundColor: accentColor } : {}}
                    >
                      <div className={`w-5 h-5 bg-card rounded-full shadow-sm absolute transition-transform ${isClaimable ? "translate-x-[24px]" : "translate-x-[3px]"}`} />
                    </button>
                  </div>
                )}

                <div>
                  <button
                    type="button"
                    onClick={() => { setPickerMonth(new Date(date)); setShowDatePicker(!showDatePicker); }}
                    className="w-full bg-muted text-sm px-4 py-3 rounded-xl border border-border/50 text-foreground font-medium mb-3 flex items-center gap-3 active:scale-[0.98] transition-all text-left"
                  >
                    <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
                    {new Date(date + 'T00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </button>

                  <AnimatePresence>
                    {showDatePicker && (() => {
                      const year = pickerMonth.getFullYear();
                      const month = pickerMonth.getMonth();
                      const firstDay = new Date(year, month, 1).getDay();
                      const daysInMonth = new Date(year, month + 1, 0).getDate();
                      const blanks = Array.from({ length: (firstDay || 7) - 1 }, (_, i) => i);
                      const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
                      // Selected-day highlight not currently rendered — reserved
                      // for a future visual affordance. Prefix-underscored so
                      // the unused-var linter stays quiet.
                      // const _selectedDay = ...

                      return (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden mb-3"
                        >
                          <div className="bg-card border border-border/50 rounded-2xl p-4 shadow-soft">
                            <div className="flex items-center justify-between mb-3">
                              <button type="button" aria-label="Previous month" onClick={() => setPickerMonth(new Date(year, month - 1, 1))} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><ChevronLeft className="w-4 h-4 text-muted-foreground" aria-hidden="true" /></button>
                              <p className="text-sm font-bold text-foreground">{pickerMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
                              <button type="button" aria-label="Next month" onClick={() => setPickerMonth(new Date(year, month + 1, 1))} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><ChevronRight className="w-4 h-4 text-muted-foreground" aria-hidden="true" /></button>
                            </div>
                            <div className="grid grid-cols-7 gap-1 text-center">
                              {['M','T','W','T','F','S','S'].map((d, i) => <span key={i} className="text-[10px] font-bold text-muted-foreground py-1">{d}</span>)}
                              {blanks.map(i => <div key={`b-${i}`} />)}
                              {days.map(d => {
                                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                                const isSelected = date === dateStr;
                                const isToday = dateStr === new Date().toISOString().split('T')[0];
                                return (
                                  <button
                                    key={d}
                                    type="button"
                                    onClick={() => { setDate(dateStr); setShowDatePicker(false); }}
                                    style={isSelected ? { backgroundColor: accentColor, color: '#fff' } : {}}
                                    className={`h-9 rounded-xl text-xs font-bold transition-all ${isSelected ? 'shadow-sm scale-105' : isToday ? 'bg-muted font-black text-foreground' : 'text-foreground hover:bg-muted/50'}`}
                                  >
                                    {d}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })()}
                  </AnimatePresence>

                  <input 
                    type="text" 
                    placeholder="Sub-category / Note (Optional)" 
                    aria-label="Note"
                    value={note}
                    onChange={e=>setNote(e.target.value)}
                    className="w-full bg-muted text-sm px-4 py-3 rounded-xl border border-border/50 text-foreground outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium placeholder:text-muted-foreground/70"
                  />
                </div>

                <button 
                  style={{ backgroundColor: accentColor, boxShadow: `0 0 15px ${accentColor}4D` }}
                  className="w-full text-white py-4 rounded-xl font-bold active:scale-[0.98] transition-all mt-4"
                  onClick={() => {
                    if (!amount || isNaN(Number(amount))) return;

                    // 🎈 The Derry Easter Egg
                    const isDerry = Number(amount) === 6.66 || note.toLowerCase().includes('pennywise');
                    if (isDerry) {
                      triggerDerry();
                    }

                    const payload = {
                       type: txType,
                       amount: Number(amount),
                       // Income is a top-level concept — it has no spending
                       // category (Salary, Bonus, etc. are tracked via notes,
                       // not category tags). Transfers get a canonical
                       // "Transfer" tag. Expenses carry the user-picked
                       // category.
                       category:
                         txType === "Transfer"
                           ? "Transfer"
                           : txType === "Income"
                             ? ""
                             : category,
                       account,
                       to_account: txType === "Transfer" ? toAccount : undefined,
                       note,
                       date: new Date(date).toISOString(),
                       status: txType === "Income" ? status : "cleared",
                       is_claimable: txType === "Expense" ? isClaimable : false,
                       claim_status: txType === "Expense" && isClaimable ? "pending" : "none"
                    };

                    if (editTransactionId) {
                       updateTransaction(editTransactionId, payload);
                       triggerToast(`✅ ${txType} updated successfully!`);
                    } else {
                       addTransaction(payload);
                       triggerToast(`✅ ${txType} saved!`);
                    }
                    
                    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(50);
                    handleClose();
                  }}
                >
                  {editTransactionId ? "Update Record" : `Save ${txType}`}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
