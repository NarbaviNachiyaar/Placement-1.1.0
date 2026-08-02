type Row = Record<string, unknown>;

function toCsv(rows: Row[]) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join(
    "\n",
  );
}

function download(content: BlobPart, filename: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportCsv(rows: Row[], filename: string) {
  download("\uFEFF" + toCsv(rows), `${filename}.csv`, "text/csv;charset=utf-8;");
}

/** Excel opens CSV-based .xls with UTF-8 BOM and tab separation reliably. */
export function exportExcel(rows: Row[], filename: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const html = `<table><thead><tr>${headers
    .map((h) => `<th>${h}</th>`)
    .join("")}</tr></thead><tbody>${rows
    .map(
      (r) =>
        `<tr>${headers.map((h) => `<td>${r[h] === null || r[h] === undefined ? "" : String(r[h])}</td>`).join("")}</tr>`,
    )
    .join("")}</tbody></table>`;
  download(
    `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"/></head><body>${html}</body></html>`,
    `${filename}.xls`,
    "application/vnd.ms-excel",
  );
}

export function exportPdf(rows: Row[], filename: string, title: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const win = window.open("", "_blank", "width=1100,height=800");
  if (!win) return;
  win.document.write(`<!doctype html><html><head><title>${filename}</title>
  <style>
    body{font-family:ui-sans-serif,system-ui,sans-serif;padding:32px;color:#1b2440}
    h1{font-size:20px;margin:0 0 4px}
    p{color:#64748b;font-size:12px;margin:0 0 20px}
    table{width:100%;border-collapse:collapse;font-size:11px}
    th{text-align:left;background:#eef2ff;padding:8px;border-bottom:1px solid #cbd5e1}
    td{padding:7px 8px;border-bottom:1px solid #e2e8f0}
  </style></head><body>
  <h1>${title}</h1><p>Generated ${new Date().toLocaleString()}</p>
  <table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
  <tbody>${rows
    .map(
      (r) =>
        `<tr>${headers.map((h) => `<td>${r[h] === null || r[h] === undefined ? "" : String(r[h])}</td>`).join("")}</tr>`,
    )
    .join("")}</tbody></table></body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 350);
}
