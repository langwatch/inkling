// The average detector: a fresh model that sees only the brief writes the headline and claim it
// would lead with. A draft whose headline or claim is close to that prediction says what any model
// would say. Advisory. See docs/tools/predict.md.
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { parse } from "./markdown.mjs";
import { ClaudeCli, claudeLogin } from "./subscription.mjs";

export const AVERAGE_AT = 1.5;

export const predictPrompt = (brief) => `Here is a brief for a piece of writing. Write what you would most likely write for it: five headlines, the ones that come to mind first, and the one-sentence claim you would lead with.

Brief:
${brief.trim()}

Reply with JSON only: {"headlines": ["...", "...", "...", "...", "..."], "claim": "..."}`;

export const comparePrompt = ({ predicted, headline, claim }) => `A model that saw only the brief for a piece predicted these headlines and this lead claim:
${predicted.headlines.map((h) => `- ${h}`).join("\n")}
Claim: ${predicted.claim}

The piece's real headline: ${headline}
The piece's real lead: ${claim || "(none)"}

Score how close the real headline, and separately the real lead, is to the predictions:
0 = says something none of the predictions say, or takes a side they don't
1 = same topic, but a different claim or angle
2 = the same claim in different words
3 = nearly the same words

Reply with JSON only: {"headline": 0, "claim": 0, "closest": "the prediction nearest the headline", "why": "one plain sentence"}`;

const json = (text) => {
  const m = String(text).match(/\{[\s\S]*\}/);
  if (!m) throw new Error("reply has no JSON object");
  return JSON.parse(m[0]);
};

/** The draft's headline and lead: its title, then its subtitle or first paragraph. */
export function headlineOf(draft) {
  const doc = parse(draft);
  const first = doc.title ?? doc.blocks.find((b) => b.type !== "heading") ?? null;
  const lead = doc.subtitle ?? doc.blocks.find((b) => b.type === "paragraph" && b !== first) ?? null;
  return { headline: first?.text.trim() ?? "", claim: lead?.sentences?.[0]?.raw?.trim() ?? lead?.text.trim() ?? "" };
}

export async function predict({ draft, brief, runs = 1, model = "opus" }) {
  const login = claudeLogin();
  if (!login.kind) throw new Error(`claude -p can't run: ${login.why}`);
  const { headline, claim } = headlineOf(draft);
  if (!headline) throw new Error("the draft has no headline to compare");
  const base = join(homedir(), ".cache", "inkling");
  mkdirSync(base, { recursive: true });
  const workdir = mkdtempSync(join(base, "predict-"));
  try {
    const cli = new ClaudeCli({ model, workdir });
    const one = async () => {
      const predicted = json(await cli.askAsync("You write. Reply with JSON only.", predictPrompt(brief)));
      const score = json(await cli.askAsync("You compare writing. Reply with JSON only.", comparePrompt({ predicted, headline, claim })));
      return { predicted, score };
    };
    const rounds = await Promise.all(Array.from({ length: runs }, one));
    const mean = (k) => rounds.reduce((s, r) => s + Number(r.score[k] ?? 0), 0) / rounds.length;
    const h = mean("headline");
    const c = mean("claim");
    return { headline, claim, rounds, headlineScore: h, claimScore: c, average: h >= AVERAGE_AT || c >= AVERAGE_AT };
  } finally {
    rmSync(workdir, { recursive: true, force: true });
  }
}

export function formatPrediction(r) {
  const lines = ["# predictability", "", `headline: ${r.headline}`, `lead: ${r.claim || "(none)"}`, ""];
  r.rounds.forEach((x, i) => {
    lines.push(`run ${i + 1}: headline ${x.score.headline}, lead ${x.score.claim}; closest "${x.score.closest}". ${x.score.why}`);
    lines.push(...x.predicted.headlines.map((h) => `  predicted: ${h}`), `  predicted claim: ${x.predicted.claim}`);
  });
  lines.push("", `mean: headline ${r.headlineScore.toFixed(1)}, lead ${r.claimScore.toFixed(1)} (0 surprising, 3 the same words)`);
  lines.push(r.average ? "advisory: the AVERAGE. A model with only the brief writes this; find the line it would not write (step 5, directions)." : "advisory: not the average.");
  return lines.join("\n") + "\n";
}
