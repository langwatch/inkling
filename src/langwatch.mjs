// LangWatch client for Inkling's own evaluations: datasets, experiments and traces over REST and
// OTLP/JSON, with no dependencies. It is on only when LANGWATCH_API_KEY is set, and a LangWatch error
// never fails a run: every call reports one stderr line and returns null. See docs/tools/langwatch.md.
import { randomBytes } from "node:crypto";

export const DEFAULT_ENDPOINT = "https://app.langwatch.ai";
const TIMEOUT_MS = 30_000;
const CHUNK = 100;

/** The connection from the environment, or null when LangWatch is off. */
export function lwConfig(env = process.env) {
  const apiKey = env.LANGWATCH_API_KEY?.trim();
  if (!apiKey || env.INKLING_LANGWATCH === "0") return null;
  return { apiKey, endpoint: (env.LANGWATCH_ENDPOINT?.trim() || DEFAULT_ENDPOINT).replace(/\/+$/, "") };
}

const warn = (msg) => process.stderr.write(`inkling langwatch: ${msg}\n`);

/** Runs fn and returns its value, or null after one stderr line when it throws. */
export async function safely(what, fn) {
  try {
    return await fn();
  } catch (e) {
    warn(`${what} skipped: ${e.message}`);
    return null;
  }
}

async function call(cfg, method, path, body) {
  const res = await fetch(cfg.endpoint + path, {
    method,
    headers: { "content-type": "application/json", authorization: `Bearer ${cfg.apiKey}`, "x-auth-token": cfg.apiKey },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const text = await res.text();
  if (!res.ok) {
    const err = new Error(`${method} ${path}: HTTP ${res.status} ${text.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }
  return text ? JSON.parse(text) : {};
}

export const traceId = () => randomBytes(16).toString("hex");
export const spanId = () => randomBytes(8).toString("hex");

/** The LangWatch column type for a value. */
function columnType(v) {
  if (typeof v === "number") return "number";
  if (typeof v === "boolean") return "boolean";
  if (Array.isArray(v)) return "list";
  if (v && typeof v === "object") return "json";
  return "string";
}

export function columnsOf(entries) {
  const cols = new Map();
  for (const e of entries) for (const [k, v] of Object.entries(e)) if (v !== null && v !== undefined && !cols.has(k)) cols.set(k, columnType(v));
  return [...cols].map(([name, type]) => ({ name, type }));
}

/** Make the dataset hold exactly these entries: create it, or replace every record it had. */
export async function syncDataset(cfg, { name, entries }) {
  let ds = null;
  try {
    ds = await call(cfg, "GET", `/api/v1/dataset/${encodeURIComponent(name)}/records?page=1&limit=1`);
    ds = ds.dataset ?? { slug: name };
  } catch (e) {
    if (e.status !== 404) throw e;
  }
  if (!ds) ds = await call(cfg, "POST", "/api/v1/dataset", { name, columnTypes: columnsOf(entries) });
  const slug = ds.slug ?? name;
  for (;;) {
    const page = await call(cfg, "GET", `/api/v1/dataset/${encodeURIComponent(slug)}/records?page=1&limit=500`);
    const ids = (page.data ?? []).map((r) => r.id);
    if (!ids.length) break;
    await call(cfg, "DELETE", `/api/v1/dataset/${encodeURIComponent(slug)}/records`, { recordIds: ids });
  }
  for (let i = 0; i < entries.length; i += CHUNK) await call(cfg, "POST", `/api/v1/dataset/${encodeURIComponent(slug)}/records`, { entries: entries.slice(i, i + CHUNK) });
  return { name, slug, rows: entries.length, url: ds.platformUrl ?? null };
}

const attr = (key, value) => {
  if (typeof value === "number") return { key, value: Number.isInteger(value) ? { intValue: String(value) } : { doubleValue: value } };
  if (typeof value === "boolean") return { key, value: { boolValue: value } };
  return { key, value: { stringValue: typeof value === "string" ? value : JSON.stringify(value) } };
};
const nanos = (ms) => String(BigInt(Math.round(ms)) * 1_000_000n);

/**
 * One span: { name, type (llm|agent|tool|evaluation|span), start, end (ms), input, output, model,
 * attrs, parent }. A row's trace is a root span plus its calls; build it with rowTrace.
 */
export function rowTrace({ runId, index, name, start, end, input, output, calls = [], attrs = {}, thread, ids }) {
  const tid = ids?.traceId ?? traceId();
  const root = ids?.spanId ?? spanId();
  const base = { "langwatch.origin": "evaluation", "evaluation.run_id": runId, "evaluation.index": index, ...(thread ? { "langwatch.thread.id": thread } : {}) };
  const spans = [
    { traceId: tid, spanId: root, name, type: "span", start, end, input, output, attrs: { ...base, ...attrs } },
    ...calls.map((c) => ({ traceId: tid, spanId: spanId(), parent: root, ...c, attrs: { ...base, ...(c.attrs ?? {}) } })),
  ];
  return { traceId: tid, spans };
}

function otlpSpan(s) {
  const attributes = [attr("langwatch.span.type", s.type ?? "span")];
  if (s.input !== undefined) attributes.push(attr("langwatch.input", s.input));
  if (s.output !== undefined) attributes.push(attr("langwatch.output", s.output));
  if (s.model) attributes.push(attr("gen_ai.request.model", s.model));
  for (const [k, v] of Object.entries(s.attrs ?? {})) if (v !== undefined && v !== null) attributes.push(attr(k, v));
  return {
    traceId: s.traceId,
    spanId: s.spanId,
    ...(s.parent ? { parentSpanId: s.parent } : {}),
    name: s.name,
    kind: 1,
    startTimeUnixNano: nanos(s.start),
    endTimeUnixNano: nanos(Math.max(s.end ?? s.start, s.start)),
    attributes,
    status: { code: s.error ? 2 : 1, ...(s.error ? { message: String(s.error) } : {}) },
  };
}

/** Send spans as OTLP/JSON, in chunks, under the service name inkling. */
export async function sendSpans(cfg, spans) {
  for (let i = 0; i < spans.length; i += 200) {
    await call(cfg, "POST", "/api/otel/v1/traces", {
      resourceSpans: [{
        resource: { attributes: [attr("service.name", "inkling")] },
        scopeSpans: [{ scope: { name: "inkling" }, spans: spans.slice(i, i + 200).map(otlpSpan) }],
      }],
    });
  }
}

/**
 * Log a finished run as an experiment. rows: [{ entry, duration?, traceId?, predicted?, error?,
 * evaluations: [{ name, score?, passed?, label?, details? }] }]. Returns { slug, runId, url }.
 */
export async function logExperiment(cfg, { slug, name, runId, rows, createdAt = Date.now() }) {
  const init = await call(cfg, "POST", "/api/v1/experiment/init", { experiment_name: name, experiment_slug: slug, experiment_type: "BATCH_EVALUATION_V2" });
  const expSlug = init.slug ?? slug;
  const evalCount = rows.reduce((n, r) => n + (r.evaluations?.length ?? 0), 0);
  for (let i = 0; i < Math.max(rows.length, 1); i += CHUNK) {
    const part = rows.slice(i, i + CHUNK);
    const last = i + CHUNK >= rows.length;
    await call(cfg, "POST", "/api/v1/evaluations/batch/log_results", {
      experiment_slug: expSlug,
      name,
      run_id: runId,
      dataset: part.map((r, k) => ({
        index: i + k,
        entry: r.entry,
        duration: Math.round(r.duration ?? 0),
        error: r.error ?? null,
        trace_id: r.traceId ?? null,
        predicted: r.predicted ?? null,
      })),
      evaluations: part.flatMap((r, k) => (r.evaluations ?? []).map((ev) => ({
        name: ev.name,
        evaluator: ev.evaluator ?? ev.name,
        trace_id: r.traceId ?? null,
        status: ev.status ?? "processed",
        index: i + k,
        score: ev.score ?? null,
        passed: ev.passed ?? null,
        label: ev.label ?? null,
        details: ev.details ?? null,
      }))),
      progress: Math.min(i + CHUNK, rows.length),
      total: rows.length,
      timestamps: { created_at: createdAt, ...(last ? { finished_at: Date.now() } : {}) },
      ...(last ? { expected: { dataset: rows.length, evaluations: evalCount } } : {}),
    });
  }
  const url = init.path ? `${cfg.endpoint}${init.path}?runId=${encodeURIComponent(runId)}` : null;
  return { slug: expSlug, runId, url };
}
