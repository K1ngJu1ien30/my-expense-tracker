"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAppContext } from "@/lib/context";
import { Lock, Mail, Key, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function AuthScreen() {
    const { triggerToast, accentColor = "#3b82f6" } = useAppContext();
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        // Fallback fake logic if Supabase placeholder triggers
        if (process.env.NEXT_PUBLIC_SUPABASE_URL === undefined && password.length > 3) {
            triggerToast("Cannot run Auth: Missing ENV keys locally! Waiting for host DB.");
            setLoading(false);
            return;
        }

        try {
            if (isLogin) {
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
                triggerToast("Authentication successful!");
            } else {
                const { error } = await supabase.auth.signUp({ email, password });
                if (error) throw error;
                triggerToast("Account created successfully! Check your email.");
            }
        } catch (error: any) {
            triggerToast(error.message || "Failed to authenticate.");
            if(navigator.vibrate) navigator.vibrate([20, 20, 20]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="absolute inset-0 z-[9999] bg-background/80 backdrop-blur-2xl flex flex-col items-center justify-center p-6 rounded-[inherit]">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-[340px] bg-card p-8 rounded-[2.5rem] shadow-heavy border border-border/80">
                
                <div className="flex justify-center mb-6">
                    <div style={{ backgroundColor: `${accentColor}1A`, color: accentColor }} className="p-4 rounded-full border border-border/50">
                        <Sparkles className="w-8 h-8" />
                    </div>
                </div>

                <div className="text-center mb-8">
                    <h1 className="text-3xl font-black text-foreground tracking-tight">Tracker</h1>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-2">
                        {isLogin ? "Welcome back" : "Create Account"}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input 
                            type="email" 
                            placeholder="Email address" 
                            value={email}
                            onChange={e=>setEmail(e.target.value)}
                            className="w-full bg-muted/60 text-sm font-semibold pl-11 pr-4 py-3.5 rounded-xl border border-border focus:border-primary outline-none transition-colors"
                            required
                        />
                    </div>
                    
                    <div className="relative">
                        <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input 
                            type="password" 
                            placeholder="Password" 
                            value={password}
                            onChange={e=>setPassword(e.target.value)}
                            className="w-full bg-muted/60 text-sm font-semibold pl-11 pr-4 py-3.5 rounded-xl border border-border focus:border-primary outline-none transition-colors"
                            required
                        />
                    </div>

                    <button 
                        disabled={loading}
                        type="submit"
                        style={{ backgroundColor: accentColor, boxShadow: `0 0 20px ${accentColor}60` }}
                        className="w-full text-white py-4 mt-2 rounded-xl font-bold active:scale-[0.98] transition-all flex justify-center items-center gap-2"
                    >
                        {loading ? "Authenticating..." : (isLogin ? "Sign In" : "Sign Up")}
                        {!loading && <Lock className="w-4 h-4" />}
                    </button>
                </form>

                <div className="mt-6 text-center">
                    <button onClick={() => setIsLogin(!isLogin)} className="text-xs font-bold text-muted-foreground hover:text-foreground transition-colors">
                        {isLogin ? "New to Tracker? Create an account." : "Already have an account? Sign In."}
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
