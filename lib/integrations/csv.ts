export type ImportedMetricRow = {
  platform: string;
  metric: string;
  value: number;
  capturedOn: string;
  artistName?: string | null;
  releaseTitle?: string | null;
  sourceUrl?: string | null;
};

function parseRows(input: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (character === '"') {
      if (quoted && input[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (!quoted && character === ",") {
      row.push(value);
      value = "";
      continue;
    }
    if (!quoted && (character === "\n" || character === "\r")) {
      if (character === "\r" && input[index + 1] === "\n") index += 1;
      row.push(value);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      value = "";
      continue;
    }
    value += character;
  }

  row.push(value);
  if (row.some((cell) => cell.trim())) rows.push(row);
  return rows;
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function firstValue(record: Record<string, string>, keys: string[]) {
  for (const key of keys) {
    const value = record[key]?.trim();
    if (value) return value;
  }
  return "";
}

function normalizeDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid metric date: ${value}`);
  return date.toISOString().slice(0, 10);
}

export function parseMetricCsv(input: string): ImportedMetricRow[] {
  const rows = parseRows(input.replace(/^\uFEFF/, ""));
  if (rows.length < 2) throw new Error("The CSV must include a header and at least one metric row");
  const headers = rows[0].map(normalizeHeader);
  const parsed = rows.slice(1).map((cells, rowIndex) => {
    const record = Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
    const platform = firstValue(record, ["platform", "source", "service"]);
    const metric = firstValue(record, ["metric", "metric_name", "measure"]);
    const rawValue = firstValue(record, ["value", "metric_value", "count", "total"]);
    const rawDate = firstValue(record, ["date", "captured_on", "metric_date", "day"]);
    const value = Number(rawValue.replace(/,/g, ""));
    if (!platform || !metric || !rawValue || !rawDate || !Number.isFinite(value)) {
      throw new Error(`CSV row ${rowIndex + 2} must include platform, metric, numeric value, and date`);
    }
    return {
      platform: platform.toLowerCase().replace(/\s+/g, "_"),
      metric: metric.toLowerCase().replace(/\s+/g, "_"),
      value,
      capturedOn: normalizeDate(rawDate),
      artistName: firstValue(record, ["artist", "artist_name"]) || null,
      releaseTitle: firstValue(record, ["release", "release_title", "track", "track_title"]) || null,
      sourceUrl: firstValue(record, ["source_url", "url", "evidence_url"]) || null,
    };
  });
  if (parsed.length > 2_000) throw new Error("A single import is limited to 2,000 metric rows");
  return parsed;
}
