/**
 * Shared heatmap tile styling used by both the Calendar page and Hub preview.
 * Extracted into lib/ to respect Next.js App Router page-export constraints and
 * provide clean contrast in both light and dark/AMOLED themes.
 */
export function getHeatmapTileStyle(amount: number) {
  if (amount <= 0) {
    return {
      tileClass:
        "bg-muted/40 dark:bg-zinc-900/60 border border-border/30 text-muted-foreground/70 cursor-default",
      numClass: "text-muted-foreground/80",
      amtClass: "opacity-0 select-none",
    };
  }
  if (amount < 50) {
    return {
      tileClass:
        "bg-rose-500/15 dark:bg-rose-950/40 border border-rose-500/30 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 hover:scale-[1.04] active:scale-95 shadow-sm cursor-pointer",
      numClass: "text-rose-700 dark:text-rose-300 font-black",
      amtClass: "text-rose-700 dark:text-rose-400 font-black",
    };
  }
  if (amount < 150) {
    return {
      tileClass:
        "bg-gradient-to-br from-rose-500/30 to-red-500/35 dark:from-rose-900/60 dark:to-red-950/70 border border-rose-500/50 dark:border-rose-700/60 text-rose-900 dark:text-rose-200 hover:scale-[1.04] active:scale-95 shadow-sm cursor-pointer",
      numClass: "text-rose-900 dark:text-rose-200 font-black",
      amtClass: "text-rose-900 dark:text-rose-200 font-black",
    };
  }
  return {
    tileClass:
      "bg-gradient-to-br from-rose-600 to-red-600 text-white border border-rose-400 shadow-md shadow-rose-600/30 hover:scale-[1.04] active:scale-95 cursor-pointer font-black",
    numClass: "text-white font-black",
    amtClass: "text-white font-black",
  };
}
