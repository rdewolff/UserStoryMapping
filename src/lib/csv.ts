import type { EffortLevel, PriorityLane } from "@/lib/constants";

const isoWeekRegex = /^\d{4}-W(0[1-9]|[1-4][0-9]|5[0-3])$/i;

export function parseCsv(text: string): string[][] {
  const normalized = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const rows: string[][] = [];

  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];

    if (inQuotes) {
      if (char === '"') {
        if (normalized[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ",") {
      row.push(cell.trim());
      cell = "";
      continue;
    }

    if (char === "\n") {
      row.push(cell.trim());
      const hasContent = row.some((value) => value.length > 0);
      if (hasContent) {
        rows.push(row);
      }
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell.trim());
  if (row.some((value) => value.length > 0)) {
    rows.push(row);
  }

  return rows;
}

export function normalizeLane(input: string): PriorityLane {
  const value = input.trim().toLowerCase();

  if (["skeleton", "core", "must", "must-have", "p0", "high"].includes(value)) {
    return "skeleton";
  }

  if (["lovable", "nice", "nice-to-have", "p2", "low"].includes(value)) {
    return "lovable";
  }

  return "mvp";
}

export function normalizeEffort(input: string): EffortLevel {
  const value = input.trim().toLowerCase();

  if (["xs", "x-small", "tiny", "1"].includes(value)) {
    return "xs";
  }

  if (["s", "small", "2"].includes(value)) {
    return "s";
  }

  if (["l", "large", "4"].includes(value)) {
    return "l";
  }

  if (["xl", "x-large", "huge", "5"].includes(value)) {
    return "xl";
  }

  return "m";
}

export function normalizeWeekTarget(input: string): string | null {
  const normalized = input.trim().toUpperCase();
  if (!normalized) {
    return null;
  }

  return isoWeekRegex.test(normalized) ? normalized : null;
}
