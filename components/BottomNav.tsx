"use client";

import { Home, PieChart, Target, User, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppContext } from "@/lib/context";

export default function BottomNav({ onOpenAdd }: { onOpenAdd: () => void }) {
  const pathname = usePathname();
  const { accentColor } = useAppContext();
  const activeColor = accentColor || '#3b82f6'; // Safe fallback
  
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-zinc-950 pb-safe border-t border-border shadow-up rounded-t-3xl px-6 py-4 flex justify-between items-center bg-opacity-90 dark:bg-opacity-90 backdrop-blur-xl">
      <Link href="/" style={pathname === '/' ? { color: activeColor } : {}} className={cn("flex flex-col items-center gap-1 transition-colors", pathname !== '/' && 'text-muted-foreground hover:text-foreground')}>
        <Home className="w-6 h-6" strokeWidth={pathname === '/' ? 2.5 : 2} />
        <span className="text-[10px] font-semibold">Home</span>
      </Link>
      
      <Link href="/analytics" style={pathname === '/analytics' ? { color: activeColor } : {}} className={cn("flex flex-col items-center gap-1 transition-colors", pathname !== '/analytics' && 'text-muted-foreground hover:text-foreground')}>
        <PieChart className="w-6 h-6" strokeWidth={pathname === '/analytics' ? 2.5 : 2} />
        <span className="text-[10px] font-medium">Stats</span>
      </Link>

      {/* FAB - Adjusted position to overlap the nav bar */}
      <div className="relative -top-6">
        <button 
          onClick={onOpenAdd}
          style={{ backgroundColor: activeColor, boxShadow: `0 0 20px ${activeColor}60` }}
          className="text-white p-4 rounded-full hover:scale-105 active:scale-95 transition-transform"
        >
          <Plus className="w-8 h-8" strokeWidth={3} />
        </button>
      </div>

      <Link href="/goals" style={pathname === '/goals' ? { color: activeColor } : {}} className={cn("flex flex-col items-center gap-1 transition-colors", pathname !== '/goals' && 'text-muted-foreground hover:text-foreground')}>
        <Target className="w-6 h-6" strokeWidth={pathname === '/goals' ? 2.5 : 2} />
        <span className="text-[10px] font-medium">Goals</span>
      </Link>
      
      <Link href="/profile" style={pathname === '/profile' ? { color: activeColor } : {}} className={cn("flex flex-col items-center gap-1 transition-colors", pathname !== '/profile' && 'text-muted-foreground hover:text-foreground')}>
        <User className="w-6 h-6" strokeWidth={pathname === '/profile' ? 2.5 : 2} />
        <span className="text-[10px] font-medium">Profile</span>
      </Link>
    </div>
  );
}
