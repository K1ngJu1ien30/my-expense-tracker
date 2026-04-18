"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect } from "react";

import { useAppContext } from "@/lib/context";
import { NativeHaptics } from "@/lib/haptics";

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
  const [status, setStatus] = useState<"cleared" | "pending">("cleared");
  const [isClaimable, setIsClaimable] = useState(false);

  const isActuallyOpen = isOpen || editTransactionId !== null;

  useEffect(() => {
    // Set default accounts once accounts array is loaded
    if (!account && accounts.length > 0) setAccount(accounts[0]);
    if (!toAccount && accounts.length > 1) setToAccount(accounts[1] || accounts[0]);
  }, [accounts]);

  useEffect(() => {
    if (editTransactionId) {
       const tx = transactions.find(t => t.id === editTransactionId);
       if (tx) {
         setTxType(tx.type as TxType);
         setCategory(tx.category || categories[0]);
         setAccount(tx.account || "Bank (MBB)");
         if (tx.to_account) setToAccount(tx.to_account);
         setAmount(String(tx.amount));
         setNote(tx.note || "");
         setDate(tx.date ? new Date(tx.date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0]);
         setStatus((tx.status as "cleared" | "pending") || "cleared");
         setIsClaimable(tx.is_claimable === true);
       }
    } else {
       setAmount("");
       setNote("");
       setDate(new Date().toISOString().split("T")[0]);
       setStatus("cleared");
       setIsClaimable(false);
    }
  }, [editTransactionId, transactions, categories]);

  const handleDragEnd = (_: any, info: any) => {
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
            className="absolute bottom-0 left-0 right-0 bg-card z-[51] rounded-t-[2rem] shadow-heavy flex flex-col max-h-[90vh]"
          >
            <div className="w-12 h-1.5 bg-border rounded-full mx-auto mt-3 mb-5 cursor-grab active:cursor-grabbing" />
            
            <div className="px-6 pb-8 overflow-y-auto hide-scrollbar">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">{editTransactionId ? "Edit" : "New"} Transaction</h2>
                <button onClick={handleClose} className="p-2 bg-muted rounded-full text-muted-foreground hover:text-foreground transition-colors">
                  <X className="w-5 h-5" />
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
                    <PillSelector options={categories} value={category} onChange={setCategory} />
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
                      className={`w-12 h-7 rounded-full transition-colors relative flex items-center pointer-events-none ${isClaimable ? "" : "bg-muted border border-border"}`}
                      style={isClaimable ? { backgroundColor: accentColor } : {}}
                    >
                      <div className={`w-5 h-5 bg-card rounded-full shadow-sm absolute transition-transform ${isClaimable ? "translate-x-[24px]" : "translate-x-[3px]"}`} />
                    </button>
                  </div>
                )}

                <div>
                  <input 
                    type="date" 
                    value={date}
                    onChange={e=>setDate(e.target.value)}
                    className="w-full bg-muted text-sm px-4 py-3 rounded-xl border border-border/50 text-foreground outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium mb-3"
                  />
                  <input 
                    type="text" 
                    placeholder="Sub-category / Note (Optional)" 
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
                       category: txType === "Transfer" ? "Transfer" : category,
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
