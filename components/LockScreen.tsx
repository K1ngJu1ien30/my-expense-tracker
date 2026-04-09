"use client";

import { useState, useEffect } from "react";
import { Lock, Fingerprint, Delete, ShieldCheck } from "lucide-react";
import { useAppContext } from "@/lib/context";
import { motion, AnimatePresence } from "framer-motion";

export default function LockScreen() {
   const { isSecurityEnabled, isLocked, setIsLocked, securityMethod, appPin, accentColor, triggerToast } = useAppContext();
   const [pinEntry, setPinEntry] = useState("");
   const [error, setError] = useState(false);
   const [forcePin, setForcePin] = useState(false);

   useEffect(() => {
      // Native biometric prompt mock via standard browser confirm dialogue payload
      if (isLocked && securityMethod === "Biometrics" && !forcePin && typeof window !== 'undefined') {
         setTimeout(() => {
            if (window.confirm("Unlock Premium Tracker natively via Fingerprint/FaceID?")) {
               triggerToast("Biometrics verified");
               setIsLocked(false);
            } else {
               setForcePin(true);
            }
         }, 400); // slight hardware delay
      }
   }, [isLocked, securityMethod, forcePin, setIsLocked, triggerToast]);

   if (!isSecurityEnabled || !isLocked) return null;

   const handlePin = (num: string) => {
      if (pinEntry.length < 4) {
         if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(20);
         const newPin = pinEntry + num;
         setPinEntry(newPin);

         if (newPin.length === 4) {
             const verifyPin = appPin || "0000"; // default mock if uninitialized
             if (newPin === verifyPin) {
                 setIsLocked(false);
                 setPinEntry("");
             } else {
                 if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([30, 50, 30]);
                 setError(true);
                 setTimeout(() => { setPinEntry(""); setError(false); }, 400);
             }
         }
      }
   }

   const handleDelete = () => {
       if (pinEntry.length > 0) {
          if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10);
          setPinEntry(prev => prev.slice(0, -1));
       }
   };

   return (
      <motion.div 
         initial={{ opacity: 0 }} 
         animate={{ opacity: 1 }} 
         exit={{ opacity: 0 }} 
         className="absolute inset-0 z-[9999] bg-background/80 backdrop-blur-2xl flex flex-col items-center justify-between py-[15vh] px-8 rounded-[inherit]"
      >
         <div className="flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-muted/50 mb-6 flex items-center justify-center border border-border/50 shadow-soft">
               <ShieldCheck style={{ color: accentColor }} className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold mb-2">App Locked</h2>
            <p className="text-sm text-muted-foreground font-semibold">
               {securityMethod === "Biometrics" && !forcePin ? "Waiting for Biometrics..." : "Enter your PIN to access"}
            </p>
            
            {/* PIN Dots */}
            <motion.div animate={error ? { x: [-10, 10, -10, 10, 0] } : {}} transition={{ duration: 0.4 }} className="flex gap-4 mt-8">
               {[...Array(4)].map((_, i) => (
                  <div key={i} className={`w-4 h-4 rounded-full transition-colors duration-300 ${i < pinEntry.length ? 'shadow-sm' : 'bg-muted border border-border/50 shadow-inner'}`} style={i < pinEntry.length ? { backgroundColor: accentColor } : {}} />
               ))}
            </motion.div>
         </div>

         {/* Numpad */}
         <div className="w-full max-w-[280px]">
            <div className="grid grid-cols-3 gap-6">
               {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                  <button 
                     key={num} 
                     onClick={() => handlePin(num.toString())}
                     className="w-16 h-16 mx-auto rounded-full bg-card shadow-soft text-2xl font-bold border border-border/40 hover:scale-[1.05] active:scale-95 transition-transform flex items-center justify-center focus:outline-none"
                  >
                     {num}
                  </button>
               ))}
               
               {/* Bottom Left Button - Biometrics or Empty */}
               <div className="flex items-center justify-center">
                  {securityMethod === "Biometrics" && forcePin && (
                      <button onClick={() => setForcePin(false)} className="w-16 h-16 mx-auto rounded-full bg-muted/30 text-muted-foreground active:scale-95 transition-transform flex items-center justify-center">
                         <Fingerprint className="w-6 h-6" />
                      </button>
                  )}
               </div>

               <button 
                  onClick={() => handlePin("0")}
                  className="w-16 h-16 mx-auto rounded-full bg-card shadow-soft text-2xl font-bold border border-border/40 hover:scale-[1.05] active:scale-95 transition-transform flex items-center justify-center focus:outline-none"
               >
                  0
               </button>

               {/* Bottom Right Button - Delete */}
               <div className="flex items-center justify-center">
                  <button onClick={handleDelete} className="w-16 h-16 mx-auto rounded-full bg-muted/30 text-muted-foreground hover:text-foreground active:scale-95 transition-transform flex items-center justify-center">
                     <Delete className="w-6 h-6" />
                  </button>
               </div>
            </div>
         </div>
      </motion.div>
   )
}
