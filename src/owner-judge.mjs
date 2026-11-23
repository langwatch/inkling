// The owner judge: predicts whether the person who signs off copy would approve a title, heading,
// subtitle or line. LLM judges prefer machine prose until they are calibrated on that person's own
// verdicts (docs/research/judge-bias.md), so this judge passes nothing until it agrees with the owner's
// labels on held-out lines. Labels: calibration/owner-lines.jsonl. Status: calibration/judges/owner-judge.json.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadProduct } from "./audience.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const OWNER_LINES = join(ROOT, "calibration", "owner-lines.jsonl");
export const STATUS = join(ROOT, "calibration", "judges", "owner-judge.json");
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

/** What the calibration covers: the prompt template and the training verdicts. A change to either needs a new calibration. */
export function judgeVersion(items = loadOwnerLines()) {
  return createHash("sha256").update(ownerPrompt.toString()).update(JSON.stringify(trainShots(items))).digest("hex").slice(0, 16);
}

export function parseVerdict(text) {
  const m = String(text).match(/\{[\s\S]*\}/);
  if (!m) throw new Error("verdict has no JSON object");
  const v = JSON.parse(m[0]);
  if (!["approve", "reject"].includes(v.verdict)) throw new Error(`verdict must be approve or reject, got ${v.verdict}`);
  return v;
}

/** Null when the judge is calibrated for its current version, else why its verdicts don't count. */
export function uncalibrated({ status = STATUS, items = loadOwnerLines() } = {}) {
  if (!existsSync(status)) return "the owner judge was never calibrated: run inkling titles calibrate --out <dir>";
  const s = JSON.parse(readFileSync(status, "utf8"));
  if (s.version !== judgeVersion(items)) return "the owner judge changed (prompt or training verdicts) since it was calibrated: run inkling titles calibrate again";
  return s.pass ? null : `the owner judge is below the bar on held-out verdicts: ${s.why.join("; ")}`;
}

/** Score held-out answers against the owner's labels. */
export function score({ verdicts, items }) {
  const held = items.filter((i) => i.split === "heldout");
  let agree = 0, rejectedApproved = 0, rejected = 0;
  const misses = [];
  for (const it of held) {
    const v = verdicts[it.id];
    const said = v === "approve" ? "approved" : "rejected";
    if (it.label === "rejected") rejected += 1;
    if (said === it.label) agree += 1;
    else misses.push({ id: it.id, label: it.label, text: it.text });
    if (it.label === "rejected" && said === "approved") rejectedApproved += 1;
  }
  const n = held.length;
  const accuracy = n ? agree / n : 0;
  const rejectedApprovedRate = rejected ? rejectedApproved / rejected : 0;
  const why = [];
  if (n < BAR.minHeldout) why.push(`${n} held-out verdicts, the bar is ${BAR.minHeldout}`);
  if (accuracy < BAR.minAccuracy) why.push(`agrees on ${agree}/${n} (${Math.round(accuracy * 100)}%), the bar is ${BAR.minAccuracy * 100}%`);
  if (rejectedApprovedRate > BAR.maxRejectedApproved) why.push(`approved ${rejectedApproved} of ${rejected} lines he rejected, the bar is ${BAR.maxRejectedApproved * 100}%`);
  return { heldout: n, agree, accuracy, rejected, rejectedApproved, misses, pass: why.length === 0, why };
}

/** One prompt per held-out verdict, label hidden, few-shot from the training split. */
export function writeCalibration({ out, items = loadOwnerLines() }) {
  mkdirSync(out, { recursive: true });
  const shots = trainShots(items);
  const prompts = items.filter((i) => i.split === "heldout").map((it) => {
    const f = join(out, `${it.id}.prompt.md`);
    writeFileSync(f, ownerPrompt({ line: it.text, kind: it.kind, product: it.product, moment: it.moment, shots }));
    return f;
  });
  writeFileSync(join(out, "manifest.json"), JSON.stringify({ kind: "calibration", version: judgeVersion(items) }, null, 1));
  return prompts;
}

const pendingIn = (dir) => readdirSync(dir).filter((f) => f.endsWith(".prompt.md")).map((f) => join(dir, f)).filter((p) => !existsSync(p.replace(/\.prompt\.md$/, ".verdict.json")));

/** Score a calibration run and write the status the other commands read. */
export function finishCalibration({ dir, items = loadOwnerLines(), status = STATUS }) {
  const pending = pendingIn(dir);
  if (pending.length) return { pending };
  const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));
  if (manifest.version !== judgeVersion(items)) throw new Error("this calibration run was written for an older judge version: run inkling titles calibrate again");
  const verdicts = {};
  for (const it of items.filter((i) => i.split === "heldout")) verdicts[it.id] = parseVerdict(readFileSync(join(dir, `${it.id}.verdict.json`), "utf8")).verdict;
  const result = score({ verdicts, items });
  mkdirSync(dirname(status), { recursive: true });
  const { misses, ...summary } = result;
  writeFileSync(status, JSON.stringify({ judge: "owner", version: manifest.version, at: new Date().toISOString(), ...summary, misses: misses.map((m) => m.id) }, null, 1) + "\n");
  return result;
}

export function formatCalibration(r) {
  const lines = [`owner judge on ${r.heldout} held-out verdicts: agrees on ${r.agree} (${Math.round(r.accuracy * 100)}%), approved ${r.rejectedApproved} of ${r.rejected} rejected lines`];
  if (r.misses.length) lines.push("disagreed on:", ...r.misses.map((m) => `  ${m.id} (he ${m.label}): ${JSON.stringify(m.text)}`));
  lines.push(r.pass ? "CALIBRATED: its approvals count." : `UNCALIBRATED: ${r.why.join("; ")}. No line passes this judge until it clears the bar.`);
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

export function writeTitles({ file, out, product, segments, brief, moment, kind = "title", items = loadOwnerLines() }) {
  mkdirSync(out, { recursive: true });
  const shots = items; // every verdict he gave is an example when judging new lines
  const lines = readCandidates(file);
  const who = productLine({ product, segments });
  const prompts = lines.map((line, i) => {
    const f = join(out, `line-${i + 1}.prompt.md`);
    writeFileSync(f, ownerPrompt({ line, kind, product: who, brief, moment, shots: trainShots(shots) }));
    return f;
  });
  writeFileSync(join(out, "manifest.json"), JSON.stringify({ kind: "titles", version: judgeVersion(items), lines }, null, 1));
  return prompts;
}

/** Verdicts on new lines. While the judge is uncalibrated nothing passes: the report says so and exits 5. */
export function gradeTitles({ dir, items = loadOwnerLines(), status = STATUS }) {
  const pending = pendingIn(dir);
  if (pending.length) return { pending };
  const { lines } = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));
  const gap = uncalibrated({ status, items });
  const out = ["# owner judge", ""];
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
