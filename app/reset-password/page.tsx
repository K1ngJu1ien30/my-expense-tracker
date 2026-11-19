"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Key, Sparkles, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function ResetPasswordPage() {
    const router = useRouter();
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");
    const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Read "#access_token=" payload hash injected by Supabase inherently
    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
            if (event === "PASSWORD_RECOVERY") {
                // Hash token captured into Supabase session automatically.
            }
        });
        return () => {
            subscription.unsubscribe();
            if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
        };
    }, []);

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg("");

        if (password !== confirmPassword) {
            setErrorMsg("Passwords do not match");
            return;
        }
        if (password.length < 6) {
            setErrorMsg("Password must be at least 6 characters");
            return;
        }

        setLoading(true);

        try {
            const { error } = await supabase.auth.updateUser({ password });
            if (error) throw error;
            
            setSuccess(true);
            redirectTimerRef.current = setTimeout(() => {
                router.replace("/");
            }, 2000);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "Failed to update password";
            setErrorMsg(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="absolute inset-0 z-[9999] bg-background flex flex-col items-center justify-center p-6 pb-safe">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-[340px] bg-card p-8 rounded-[2.5rem] shadow-heavy border border-border/80">
                
                <div className="flex justify-center mb-6">
                    <div style={{ backgroundColor: `#3b82f61A`, color: "#3b82f6" }} className="p-4 rounded-full border border-border/50">
                        {success ? <CheckCircle2 className="w-8 h-8 text-emerald-500" /> : <Sparkles className="w-8 h-8" />}
                    </div>
                </div>

                <div className="text-center mb-8">
                    <h1 className="text-2xl font-black text-foreground tracking-tight">Set New Password</h1>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-2">
                        {success ? "Success" : "Secure your account"}
                    </p>
                </div>

                <AnimatePresence>
                    {errorMsg && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mb-4 text-center">
                            <p className="text-xs font-bold text-rose-500 bg-rose-500/10 py-2 rounded-lg">{errorMsg}</p>
                        </motion.div>
                    )}
                </AnimatePresence>

                {!success ? (
                    <form onSubmit={handleReset} className="space-y-4">
                        <div className="relative">
                            <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input 
                                type="password" 
                                placeholder="New Password" 
                                value={password}
                                onChange={e=>setPassword(e.target.value)}
                                className="w-full bg-muted/60 text-sm font-semibold pl-11 pr-4 py-3.5 rounded-xl border border-border focus:border-primary outline-none transition-colors"
                                required
                            />
                        </div>
                        
                        <div className="relative">
                            <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input 
                                type="password" 
                                placeholder="Confirm Password" 
                                value={confirmPassword}
                                onChange={e=>setConfirmPassword(e.target.value)}
                                className="w-full bg-muted/60 text-sm font-semibold pl-11 pr-4 py-3.5 rounded-xl border border-border focus:border-primary outline-none transition-colors"
                                required
                            />
                        </div>

                        <button 
                            disabled={loading}
                            type="submit"
                            className="bg-primary w-full text-primary-foreground py-4 mt-2 rounded-xl font-bold hover:opacity-90 active:scale-[0.98] transition-all flex justify-center items-center gap-2 shadow-soft"
                        >
                            {loading ? "Updating..." : "Update Password"}
                        </button>
                        
                        <div className="mt-4 text-center">
                           <button type="button" onClick={() => router.replace("/")} className="text-xs font-bold text-muted-foreground hover:text-foreground">
                              Cancel
                           </button>
                        </div>
                    </form>
                ) : (
                    <div className="text-center space-y-4">
                        <p className="text-sm font-bold text-foreground">Password updated successfully!</p>
                        <p className="text-xs text-muted-foreground">Redirecting...</p>
                    </div>
                )}
            </motion.div>
        </div>
    );
}
