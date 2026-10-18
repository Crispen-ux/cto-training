import fs from "node:fs";
import path from "node:path";

export const REGISTER_BASE_URL = "https://www.ctoframework.com";

export interface RegisterRow {
  pillar: string;
  section: string;
  title: string;
  path: string;
  roleTag: string;
  sourceCategory: string;
  dateReviewed: string;
  reviewDepth: string;
  url: string;
}

/** Minimal CSV parser supporting quoted fields with commas and doubled quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((f) => f !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    if (row.some((f) => f !== "")) rows.push(row);
  }
  return rows;
}

export function parseRegister(text: string): RegisterRow[] {
  const [header, ...rest] = parseCsv(text);
  const idx = (name: string) => header.indexOf(name);
  return rest.map((r) => ({
    pillar: r[idx("pillar")],
    section: r[idx("section")],
    title: r[idx("title")],
    path: r[idx("path")],
    roleTag: r[idx("role_tag")],
    sourceCategory: r[idx("source_category")],
    dateReviewed: r[idx("date_reviewed")],
    reviewDepth: r[idx("review_depth")],
    url: REGISTER_BASE_URL + r[idx("path")],
  }));
}

let cache: RegisterRow[] | null = null;
export function loadRegister(): RegisterRow[] {
  if (!cache) {
    const file = path.join(process.cwd(), "data", "source-register.csv");
    cache = parseRegister(fs.readFileSync(file, "utf8"));
  }
  return cache;
}
