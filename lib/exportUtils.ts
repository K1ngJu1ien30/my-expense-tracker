import type { Transaction } from "./context";

export async function exportDataToCSV(
  transactions: Transaction[],
  monthFilter: string | null,
  currency: string
): Promise<void> {
  if (transactions.length === 0) throw new Error("No transactions to export.");

  // Filter by month if specified (e.g. "April 2026")
  let filtered = transactions;
  if (monthFilter) {
    filtered = transactions.filter(tx => {
      const d = new Date(tx.date);
      const label = d.toLocaleString("en-US", { month: "long", year: "numeric" });
      return label === monthFilter;
    });
    if (filtered.length === 0) throw new Error(`No transactions found for ${monthFilter}.`);
  }

  // Build CSV
  const headers = ["Date", "Type", "Category", "Sub Category", "Amount", "Account", "To Account", "Note", "Status"];
  const rows = filtered.map(tx => [
    new Date(tx.date).toLocaleDateString(),
    tx.type,
    tx.category || "",
    tx.sub_category || "",
    tx.amount,
    tx.account || "",
    tx.to_account || "",
    tx.note || "",
    tx.status || "cleared",
  ]);
  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const fileName = monthFilter
    ? `tracker_${monthFilter.replace(/\s/g, "_")}.csv`
    : "tracker_all_time.csv";

  // Try native Capacitor export first (Android)
  try {
    // @ts-ignore - Native plugin, not available in web builds
    const { Capacitor } = await import("@capacitor/core");
    if (Capacitor.isNativePlatform()) {
      // @ts-ignore
      const { Filesystem, Directory, Encoding } = await import("@capacitor/filesystem");
      // @ts-ignore
      const { Share } = await import("@capacitor/share");

      await Filesystem.writeFile({
        path: fileName,
        data: csvContent,
        directory: Directory.Cache,
        encoding: Encoding.UTF8,
      });

      const fileResult = await Filesystem.getUri({
        path: fileName,
        directory: Directory.Cache,
      });

      await Share.share({
        title: "Expense Export",
        text: `Transaction report${monthFilter ? ` for ${monthFilter}` : ""} — ${filtered.length} records`,
        url: fileResult.uri,
      });

      return;
    }
  } catch {
    // Fall through to web download
  }

  // Web fallback — download via blob
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
