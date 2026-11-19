import type { Transaction } from "./context";
import { getLocalDateKeyFromIso } from "./utils";

/** Neutralize spreadsheet formula injection (=, +, -, @, tab, CR) on CSV cells. */
function escapeCsvCell(raw: unknown): string {
  let str = String(raw ?? "");
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

export async function exportDataToCSV(
  transactions: Transaction[],
  monthFilter: string | null,
  _currency: string
): Promise<void> {
  void _currency;
  const activeTxs = transactions.filter(tx => !tx.deleted_at);
  if (activeTxs.length === 0) throw new Error("No transactions to export.");

  // Filter by month if specified (e.g. "April 2026")
  let filtered = activeTxs;
  if (monthFilter) {
    filtered = activeTxs.filter(tx => {
      const d = new Date(tx.date);
      const label = d.toLocaleString("en-US", { month: "long", year: "numeric" });
      return label === monthFilter;
    });
    if (filtered.length === 0) throw new Error(`No transactions found for ${monthFilter}.`);
  }

  // Build CSV (UTF-8 BOM for clean Excel parsing)
  const headers = ["Date", "Type", "Category", "Sub Category", "Amount", "Account", "To Account", "Note", "Status"];
  const rows = filtered.map(tx => [
    getLocalDateKeyFromIso(tx.date),
    tx.type,
    tx.category || "",
    tx.sub_category || "",
    tx.amount,
    tx.account || "",
    tx.to_account || "",
    tx.note || "",
    tx.status || "cleared",
  ]);
  const csvContent =
    "\uFEFF" +
    [headers, ...rows]
      .map(row => row.map(escapeCsvCell).join(","))
      .join("\n");

  const fileName = monthFilter
    ? `tracker_${monthFilter.replace(/\s/g, "_")}.csv`
    : "tracker_all_time.csv";

  // Try native Capacitor export first (Android)
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (Capacitor.isNativePlatform()) {
      const { Filesystem, Directory, Encoding } = await import("@capacitor/filesystem");
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
