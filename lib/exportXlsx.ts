import * as XLSX from "xlsx";

export function downloadXlsx(
  sheets: { name: string; rows: Record<string, unknown>[] }[],
  filename: string,
) {
  const wb = XLSX.utils.book_new();
  for (const { name, rows } of sheets) {
    const ws = XLSX.utils.json_to_sheet(rows);
    // Auto-fit column widths
    const cols = rows.length > 0
      ? Object.keys(rows[0]).map((key) => ({
          wch: Math.max(
            key.length,
            ...rows.map((r) => String(r[key] ?? "").length),
          ) + 2,
        }))
      : [];
    ws["!cols"] = cols;
    XLSX.utils.book_append_sheet(wb, ws, name);
  }
  XLSX.writeFile(wb, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}
