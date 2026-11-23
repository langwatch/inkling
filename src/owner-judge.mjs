// The owner judge: predicts whether the person who signs off copy would approve a title, heading,
// subtitle or line. LLM judges prefer machine prose until they are calibrated on that person's own
// verdicts (docs/research/judge-bias.md), so this judge passes nothing until it agrees with the owner's
// labels on held-out lines. Labels: calibration/owner-lines.jsonl. Status: calibration/judges/owner-judge.json.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadProduct } from "./audience.mjs";
import { retriever, nearestPrompt } from "./owner-nearest.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const OWNER_LINES = join(ROOT, "calibration", "owner-lines.jsonl");
export const STATUS = join(ROOT, "calibration", "judges", "owner-judge.json");
const NEAREST_SOURCE = join(ROOT, "src", "owner-nearest.mjs");
/**
 * Two judges. fewshot: every training verdict as an example. nearest: only the owner's closest training
 * verdicts by words and shape (src/owner-nearest.mjs). Each has its own calibration status file.
 */
export const METHODS = {
  fewshot: { status: STATUS },
  nearest: { status: join(ROOT, "calibration", "judges", "owner-judge-nearest.json") },
};
/** The judge `inkling titles` uses without --method. It moves to nearest only once nearest clears the bar. */
export const DEFAULT_METHOD = "fewshot";
const methodOf = (method) => {
  if (!METHODS[method]) throw new Error(`owner judge method must be one of ${Object.keys(METHODS).join(", ")}, got ${method}`);
  return METHODS[method];
};
/** Held-out agreement the judge needs before any of its approvals count. Raise as the labels grow. */
export const BAR = { minHeldout: 15, minAccuracy: 0.8, maxRejectedApproved: 0.2 };
export const UNCALIBRATED_EXIT = 5;

export function loadOwnerLines(path = OWNER_LINES) {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8").split("\n").filter((l) => l.trim() && !l.trim().startsWith("//")).map((l, i) => {
    const item = JSON.parse(l);
    for (const k of ["id", "kind", "product", "text", "label", "reason", "source", "split"]) if (!item[k]) throw new Error(`${path}:${i + 1}: needs ${k}`);
    if (!["approved", "rejected"].includes(item.label)) throw new Error(`${path}:${i + 1}: label must be approved or rejected`);
    if (!["train", "heldout"].includes(item.split)) throw new Error(`${path}:${i + 1}: split must be train or heldout`);
    return item;
  });
}

export function ownerPrompt({ line, kind, product, brief, moment, shots }) {
  const examples = shots.map((s) => `- [${s.label.toUpperCase()}] (${s.moment ?? `${s.kind}, ${s.product.split(",")[0]}`}) ${JSON.stringify(s.text)}\n  why: ${s.reason}`).join("\n");
  return `You predict whether the founder who signs off this company's copy approves or rejects a line. He rejects lines a cold reader from the audience would not get at once: words they don't use (insider terms, vendor setting names, acronyms), vague phrases, lines that sound machine-written (stock contrast shapes, mirrored pairs, "your X didn't Y" hooks, dramatic titles, aphorisms), lines told from the writer's side, concessions, worry, feature lists and invented scenes. He approves one plain claim from where the reader is, in words they would say: a plain fact, an offer or a side taken. A plain, ordinary-looking line is what he wants, so never reject a line for being simple, for naming a product the reader knows, or for a comparison that states the other option's cost. Reject only for a reason from the list above. Do not read files or research.

His past verdicts:
${examples}

Who reads it: ${product}
${brief ? `What the piece is: ${brief}\n` : ""}Kind of line: ${kind}${moment ? `\nWhere the reader meets it: ${moment}` : ""}
Line: ${JSON.stringify(line)}

Reply with JSON only:
{"verdict": "approve" or "reject", "reason": "one plain sentence quoting the words that decide it"}`;
}

const trainShots = (items) => items.filter((i) => i.split === "train");

/**
 * What the calibration covers: the prompt, the retrieval (nearest: the whole of src/owner-nearest.mjs) and
 * the training verdicts. A change to any of them needs a new calibration.
 */
export function judgeVersion(items = loadOwnerLines(), method = DEFAULT_METHOD) {
  methodOf(method);
  const h = createHash("sha256");
  if (method === "fewshot") h.update(ownerPrompt.toString());
  else h.update("nearest\n").update(readFileSync(NEAREST_SOURCE, "utf8"));
  return h.update(JSON.stringify(trainShots(items))).digest("hex").slice(0, 16);
}

/**
 * The prompt for one line. Examples and neighbours come from the training split only, never the line
 * itself, so a training line is judged leave-one-out and a held-out line never sees another held-out one.
 */
export function promptFor({ method = DEFAULT_METHOD, line, id, kind, product, brief, moment, items, near }) {
  methodOf(method);
  const train = trainShots(items).filter((s) => s.id !== id);
  if (method === "fewshot") return ownerPrompt({ line, kind, product, brief, moment, shots: train });
  const neighbours = (near ?? retriever(train)).neighbours({ id, text: line, kind, product, moment });
  return nearestPrompt({ line, kind, product, brief, moment, neighbours });
}

export function parseVerdict(text) {
  const m = String(text).match(/\{[\s\S]*\}/);
  if (!m) throw new Error("verdict has no JSON object");
  const v = JSON.parse(m[0]);
  if (!["approve", "reject"].includes(v.verdict)) throw new Error(`verdict must be approve or reject, got ${v.verdict}`);
  return v;
}

/** Null when the judge is calibrated for its current version, else why its verdicts don't count. */
export function uncalibrated({ method = DEFAULT_METHOD, status = methodOf(method).status, items = loadOwnerLines() } = {}) {
  if (!existsSync(status)) return `the ${method} owner judge was never calibrated: run inkling titles calibrate --method ${method} --out <dir>`;
  const s = JSON.parse(readFileSync(status, "utf8"));
  if (s.version !== judgeVersion(items, method)) return "the owner judge changed (prompt or training verdicts) since it was calibrated: run inkling titles calibrate again";
  return s.pass ? null : `the owner judge is below the bar on held-out verdicts: ${s.why.join("; ")}`;
}

/** Score answers against the owner's labels on one split: held-out for the bar, train for leave-one-out tuning. */
export function score({ verdicts, items, split = "heldout" }) {
  const held = items.filter((i) => i.split === split);
  let agree = 0, rejectedApproved = 0, rejected = 0, approvedRejected = 0;
  const misses = [];
  for (const it of held) {
    const v = verdicts[it.id];
    const said = v === "approve" ? "approved" : "rejected";
    if (it.label === "rejected") rejected += 1;
    if (said === it.label) agree += 1;
    else misses.push({ id: it.id, label: it.label, text: it.text });
    if (it.label === "rejected" && said === "approved") rejectedApproved += 1;
    if (it.label === "approved" && said === "rejected") approvedRejected += 1;
  }
  const n = held.length;
  const accuracy = n ? agree / n : 0;
  const rejectedApprovedRate = rejected ? rejectedApproved / rejected : 0;
  const why = [];
  if (n < BAR.minHeldout) why.push(`${n} held-out verdicts, the bar is ${BAR.minHeldout}`);
  if (accuracy < BAR.minAccuracy) why.push(`agrees on ${agree}/${n} (${Math.round(accuracy * 100)}%), the bar is ${BAR.minAccuracy * 100}%`);
  if (rejectedApprovedRate > BAR.maxRejectedApproved) why.push(`approved ${rejectedApproved} of ${rejected} lines he rejected, the bar is ${BAR.maxRejectedApproved * 100}%`);
  return { split, heldout: n, agree, accuracy, rejected, rejectedApproved, approved: n - rejected, approvedRejected, misses, pass: why.length === 0, why };
}

/**
 * One prompt per verdict of the split, label hidden. split heldout scores the bar; split train is
 * leave-one-out (each line left out of its own examples), for tuning only, and never writes the status.
 */
export function writeCalibration({ out, items = loadOwnerLines(), method = DEFAULT_METHOD, split = "heldout" }) {
  if (!["train", "heldout"].includes(split)) throw new Error(`split must be train or heldout, got ${split}`);
  mkdirSync(out, { recursive: true });
  const near = method === "nearest" ? retriever(trainShots(items)) : undefined;
  const prompts = items.filter((i) => i.split === split).map((it) => {
    const f = join(out, `${it.id}.prompt.md`);
    writeFileSync(f, promptFor({ method, line: it.text, id: it.id, kind: it.kind, product: it.product, moment: it.moment, items, near }));
    return f;
  });
  writeFileSync(join(out, "manifest.json"), JSON.stringify({ kind: "calibration", method, split, version: judgeVersion(items, method) }, null, 1));
  return prompts;
}

const pendingIn = (dir) => readdirSync(dir).filter((f) => f.endsWith(".prompt.md")).map((f) => join(dir, f)).filter((p) => !existsSync(p.replace(/\.prompt\.md$/, ".verdict.json")));

/** Score a calibration run and write the status the other commands read. */
export function finishCalibration({ dir, items = loadOwnerLines(), status }) {
  const pending = pendingIn(dir);
  if (pending.length) return { pending };
  const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));
  const method = manifest.method ?? "fewshot";
  const split = manifest.split ?? "heldout";
  if (manifest.version !== judgeVersion(items, method)) throw new Error("this calibration run was written for an older judge version: run inkling titles calibrate again");
  const verdicts = {};
  for (const it of items.filter((i) => i.split === split)) verdicts[it.id] = parseVerdict(readFileSync(join(dir, `${it.id}.verdict.json`), "utf8")).verdict;
  const result = { method, ...score({ verdicts, items, split }) };
  if (split !== "heldout") return result;
  const target = status ?? methodOf(method).status;
  mkdirSync(dirname(target), { recursive: true });
  const { misses, ...summary } = result;
  writeFileSync(target, JSON.stringify({ judge: "owner", version: manifest.version, at: new Date().toISOString(), ...summary, misses: misses.map((m) => m.id) }, null, 1) + "\n");
  return result;
}

export function formatCalibration(r) {
  const where = r.split === "train" ? "training verdicts, each left out of its own examples" : "held-out verdicts";
  const lines = [`${r.method ?? "fewshot"} owner judge on ${r.heldout} ${where}: agrees on ${r.agree} (${Math.round(r.accuracy * 100)}%), approved ${r.rejectedApproved} of ${r.rejected} rejected lines, rejected ${r.approvedRejected} of ${r.approved} approved lines`];
  if (r.misses.length) lines.push("disagreed on:", ...r.misses.map((m) => `  ${m.id} (he ${m.label}): ${JSON.stringify(m.text)}`));
  if (r.split === "train") lines.push("TUNING ONLY: a leave-one-out run on the training split never calibrates the judge.");
  else lines.push(r.pass ? "CALIBRATED: its approvals count." : `UNCALIBRATED: ${r.why.join("; ")}. No line passes this judge until it clears the bar.`);
  return lines.join("\n") + "\n";
}

/** Candidate lines, one per line of the file; list markers and heading marks are dropped. */
export function readCandidates(file) {
  return readFileSync(file, "utf8").split("\n").map((l) => l.replace(/^\s*(?:#+|[-*]|\d+[.)])\s+/, "").trim()).filter(Boolean);
}

export function productLine({ product, segments }) {
  const p = loadProduct(product);
  const segs = segments?.length ? p.segments.filter((s) => segments.includes(s.id)) : p.segments;
  return `${p.product}: ${p.who}. This piece is for: ${segs.map((s) => s.background.trim().replace(/\s+/g, " ")).join(" / ")}`;
}

/** Prompts for new lines; examples or neighbours come from the training split, the same as the calibrated judge saw. */
export function writeTitles({ file, out, product, segments, brief, moment, kind = "title", items = loadOwnerLines(), method = DEFAULT_METHOD }) {
  mkdirSync(out, { recursive: true });
  const lines = readCandidates(file);
  const who = productLine({ product, segments });
  const near = method === "nearest" ? retriever(trainShots(items)) : undefined;
  const prompts = lines.map((line, i) => {
    const f = join(out, `line-${i + 1}.prompt.md`);
    writeFileSync(f, promptFor({ method, line, kind, product: who, brief, moment, items, near }));
    return f;
  });
  writeFileSync(join(out, "manifest.json"), JSON.stringify({ kind: "titles", method, version: judgeVersion(items, method), lines }, null, 1));
  return prompts;
}

/** Verdicts on new lines. While the judge is uncalibrated nothing passes: the report says so and exits 5. */
export function gradeTitles({ dir, items = loadOwnerLines(), status }) {
  const pending = pendingIn(dir);
  if (pending.length) return { pending };
  const { lines, method = "fewshot", version } = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));
  const gap = version !== judgeVersion(items, method) ? "these prompts were written for an older judge version: run inkling titles prompts again" : uncalibrated({ method, status: status ?? methodOf(method).status, items });
  const out = [`# owner judge (${method})`, ""];
  if (gap) out.push(`UNCALIBRATED: ${gap}. These verdicts are shown for reference only; no line passes.`, "");
  let approved = 0;
  lines.forEach((line, i) => {
    const v = parseVerdict(readFileSync(join(dir, `line-${i + 1}.verdict.json`), "utf8"));
    if (v.verdict === "approve") approved += 1;
    out.push(`- ${gap ? "unverified " : ""}${v.verdict === "approve" ? "APPROVE" : "REJECT"} ${JSON.stringify(line)}: ${v.reason}`);
  });
  const report = out.join("\n") + "\n";
  writeFileSync(join(dir, "report.md"), report);
  const exit = gap ? UNCALIBRATED_EXIT : approved === lines.length ? 0 : 1;
  return { report, exit };
}
