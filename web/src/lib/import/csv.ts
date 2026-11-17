// Minimal RFC 4180 reader for bank statement exports: quoted fields, escaped
// "" quotes, CRLF, a UTF-8 BOM. The delimiter is a comma or a tab — some
// banks (SBI) export tab-separated text under a .csv/.xls name — whichever the
// first lines use more. Pure, so the browser parses the file and the raw
// statement never reaches the server.
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const head = src.split(/\r?\n/, 5).join("\n");
  const tabs = head.split("\t").length;
  const commas = head.split(",").length;
  const delim = tabs > commas ? "\t" : ",";

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === delim) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}
