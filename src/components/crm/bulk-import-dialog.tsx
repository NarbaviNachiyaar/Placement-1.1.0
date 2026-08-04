import { useRef, useState } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { AlertTriangle, CheckCircle2, Download, Upload } from "lucide-react";
import { toast } from "sonner";
import { db } from "@/lib/data/client";
import { useAuth } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type ImportField = {
  /** Column header expected in the CSV/Excel file. */
  key: string;
  /** Whether this field must be present and non-empty on every row. */
  required?: boolean;
};

export type BulkImportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Human label, e.g. "Companies", "Contacts", "Tasks". */
  entityLabel: string;
  /** Supabase table to insert/update into. */
  table: string;
  fields: ImportField[];
  /** Sample row shown in the downloadable template. */
  sampleRow: Record<string, string>;
  /** Column used to detect duplicates (e.g. "name" or "email"). */
  dedupeKey: string;
  /** Existing values of dedupeKey already in the table (lowercased). */
  existingValues: Set<string>;
  /** Turn a raw parsed row into the exact payload sent to Supabase. */
  buildPayload: (row: Record<string, string>) => Record<string, unknown>;
  onImported: () => void;
};

type ParsedRow = {
  raw: Record<string, string>;
  errors: string[];
  isDuplicate: boolean;
};

export function BulkImportDialog({
  open,
  onOpenChange,
  entityLabel,
  table,
  fields,
  sampleRow,
  dedupeKey,
  existingValues,
  buildPayload,
  onImported,
}: BulkImportDialogProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [duplicateMode, setDuplicateMode] = useState<"skip" | "update">("skip");
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ inserted: number; updated: number; skipped: number } | null>(
    null,
  );

  function reset() {
    setRows([]);
    setFileName("");
    setResult(null);
    setProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function downloadTemplate() {
    const csv = Papa.unparse([sampleRow]);
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${table}-import-template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function validateRow(raw: Record<string, string>): string[] {
    const errors: string[] = [];
    for (const f of fields) {
      if (f.required && !raw[f.key]?.toString().trim()) {
        errors.push(`Missing "${f.key}"`);
      }
    }
    return errors;
  }

  function processRows(data: Record<string, string>[]) {
    const seenInFile = new Set<string>();
    const parsed: ParsedRow[] = data.map((raw) => {
      const errors = validateRow(raw);
      const key = (raw[dedupeKey] ?? "").toString().trim().toLowerCase();
      const isDuplicate = Boolean(
        key && (existingValues.has(key) || seenInFile.has(key)),
      );
      if (key) seenInFile.add(key);
      return { raw, errors, isDuplicate };
    });
    setRows(parsed);
  }

  function handleFile(file: File) {
    setFileName(file.name);
    setResult(null);
    const isExcel = /\.xlsx?$/i.test(file.name);
    if (isExcel) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const wb = XLSX.read(e.target?.result, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: "" });
        processRows(json);
      };
      reader.readAsArrayBuffer(file);
    } else {
      Papa.parse<Record<string, string>>(file, {
        header: true,
        skipEmptyLines: true,
        complete: (res) => processRows(res.data),
      });
    }
  }

  async function runImport() {
    const validRows = rows.filter((r) => r.errors.length === 0);
    const insertBatch = validRows.filter(
      (r) => !r.isDuplicate || duplicateMode !== "skip",
    ).filter((r) => !(r.isDuplicate && duplicateMode === "update"));
    const updateBatch = duplicateMode === "update" ? validRows.filter((r) => r.isDuplicate) : [];
    const skippedCount =
      duplicateMode === "skip" ? validRows.filter((r) => r.isDuplicate).length : 0;

    setImporting(true);
    let inserted = 0;
    let updated = 0;
    const total = insertBatch.length + updateBatch.length || 1;

    try {
      for (let i = 0; i < insertBatch.length; i++) {
        const payload = buildPayload(insertBatch[i].raw);
        const { error } = await db.from(table).insert(payload);
        if (!error) inserted++;
        setProgress(Math.round(((i + 1) / total) * 100));
      }

      for (let i = 0; i < updateBatch.length; i++) {
        const payload = buildPayload(updateBatch[i].raw);
        const key = (updateBatch[i].raw[dedupeKey] ?? "").toString().trim();
        const { error } = await db.from(table).update(payload).ilike(dedupeKey, key);
        if (!error) updated++;
        setProgress(Math.round(((insertBatch.length + i + 1) / total) * 100));
      }

      await logActivity({
        userId: user?.id,
        userEmail: user?.email,
        action: "Bulk Import",
        entityType: table,
        details: `${entityLabel}: ${inserted} added, ${updated} updated, ${skippedCount} skipped from ${fileName}`,
      });

      setResult({ inserted, updated, skipped: skippedCount });
      toast.success(`Import finished: ${inserted} added, ${updated} updated, ${skippedCount} skipped`);
      onImported();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  const validCount = rows.filter((r) => r.errors.length === 0).length;
  const errorCount = rows.length - validCount;
  const duplicateCount = rows.filter((r) => r.isDuplicate && r.errors.length === 0).length;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Bulk import {entityLabel.toLowerCase()}</DialogTitle>
          <DialogDescription>
            Upload a CSV or Excel file. Download the template below to see the expected columns.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" className="rounded-xl" onClick={downloadTemplate}>
              <Download className="mr-1.5 size-4" /> Download sample template
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mr-1.5 size-4" /> Choose file
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            {fileName && <span className="text-xs text-muted-foreground">{fileName}</span>}
          </div>

          {rows.length > 0 && !result && (
            <>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{rows.length} rows found</Badge>
                <Badge variant="outline" className="border-emerald-500/40 text-emerald-600">
                  {validCount} valid
                </Badge>
                {errorCount > 0 && (
                  <Badge variant="outline" className="border-destructive/40 text-destructive">
                    {errorCount} with errors
                  </Badge>
                )}
                {duplicateCount > 0 && (
                  <Badge variant="outline" className="border-amber-500/40 text-amber-600">
                    {duplicateCount} duplicates
                  </Badge>
                )}
              </div>

              {duplicateCount > 0 && (
                <div>
                  <Label className="mb-1.5 block text-xs">Duplicate rows (matched by {dedupeKey})</Label>
                  <RadioGroup
                    value={duplicateMode}
                    onValueChange={(v) => setDuplicateMode(v as "skip" | "update")}
                    className="flex gap-4"
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="skip" id="skip" />
                      <Label htmlFor="skip" className="text-sm font-normal">
                        Skip duplicates
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="update" id="update" />
                      <Label htmlFor="update" className="text-sm font-normal">
                        Update existing records
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              )}

              <div className="max-h-64 overflow-auto rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      {fields.map((f) => (
                        <TableHead key={f.key}>{f.key}</TableHead>
                      ))}
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.slice(0, 50).map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                        {fields.map((f) => (
                          <TableCell key={f.key} className="text-xs">
                            {r.raw[f.key] ?? ""}
                          </TableCell>
                        ))}
                        <TableCell className="text-xs">
                          {r.errors.length > 0 ? (
                            <span className="flex items-center gap-1 text-destructive">
                              <AlertTriangle className="size-3.5" /> {r.errors.join(", ")}
                            </span>
                          ) : r.isDuplicate ? (
                            <span className="text-amber-600">Duplicate</span>
                          ) : (
                            <span className="flex items-center gap-1 text-emerald-600">
                              <CheckCircle2 className="size-3.5" /> Ready
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {rows.length > 50 && (
                  <p className="p-2 text-center text-xs text-muted-foreground">
                    Showing first 50 of {rows.length} rows
                  </p>
                )}
              </div>
            </>
          )}

          {importing && <Progress value={progress} />}

          {result && (
            <div className="rounded-xl border bg-muted/40 p-4 text-sm">
              <p className="font-semibold">Import complete</p>
              <p className="text-muted-foreground">
                {result.inserted} added · {result.updated} updated · {result.skipped} skipped
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {result ? "Close" : "Cancel"}
          </Button>
          {!result && (
            <Button onClick={() => void runImport()} disabled={validCount === 0 || importing}>
              {importing ? "Importing…" : `Import ${validCount} row${validCount === 1 ? "" : "s"}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
