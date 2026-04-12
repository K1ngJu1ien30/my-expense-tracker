"use client";

import { Home, PieChart, User, Plus, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppContext } from "@/lib/context";

export default function BottomNav({ onOpenAdd }: { onOpenAdd: () => void }) {
  const pathname = usePathname();
  const { accentColor } = useAppContext();
  const activeColor = accentColor || '#3b82f6';

  const isHome = pathname === '/';
  const isStats = pathname.startsWith('/analytics');
  const isHub = pathname.startsWith('/hub') || pathname.startsWith('/vault') || pathname.startsWith('/goals');
  const isProfile = pathname.startsWith('/profile');
  
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-zinc-950 pb-safe border-t border-border shadow-up rounded-t-3xl px-6 py-4 flex justify-between items-center bg-opacity-90 dark:bg-opacity-90 backdrop-blur-xl">
      <Link href="/" style={isHome ? { color: activeColor } : {}} className={cn("flex flex-col items-center gap-1 transition-colors", !isHome && 'text-muted-foreground hover:text-foreground')}>
        <Home className="w-6 h-6" strokeWidth={isHome ? 2.5 : 2} />
        <span className="text-[10px] font-semibold">Home</span>
      </Link>
      
      <Link href="/analytics" style={isStats ? { color: activeColor } : {}} className={cn("flex flex-col items-center gap-1 transition-colors", !isStats && 'text-muted-foreground hover:text-foreground')}>
        <PieChart className="w-6 h-6" strokeWidth={isStats ? 2.5 : 2} />
        <span className="text-[10px] font-medium">Stats</span>
      </Link>

      <div className="relative -top-6">
        <button 
          onClick={onOpenAdd}
          style={{ backgroundColor: activeColor, boxShadow: `0 0 20px ${activeColor}60` }}
          className="text-white p-4 rounded-full hover:scale-105 active:scale-95 transition-transform"
        >
          <Plus className="w-8 h-8" strokeWidth={3} />
        </button>
      </div>

      <Link href="/hub" style={isHub ? { color: activeColor } : {}} className={cn("flex flex-col items-center gap-1 transition-colors", !isHub && 'text-muted-foreground hover:text-foreground')}>
        <LayoutGrid className="w-6 h-6" strokeWidth={isHub ? 2.5 : 2} />
        <span className="text-[10px] font-medium">Hub</span>
      </Link>
      
      <Link href="/profile" style={isProfile ? { color: activeColor } : {}} className={cn("flex flex-col items-center gap-1 transition-colors", !isProfile && 'text-muted-foreground hover:text-foreground')}>
        <User className="w-6 h-6" strokeWidth={isProfile ? 2.5 : 2} />
        <span className="text-[10px] font-medium">Profile</span>
      </Link>
    </div>
  );
}
