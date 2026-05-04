#!/usr/bin/env bun
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";

type Deploy = {
  id: number;
  sha: string;
  environment: string;
  created_at: string;
};
type Status = { state: string; environment_url: string };

const REPO = "redlamp/narrative-chess";
const PAGE = "wiki/notes/vercel-deployments-index.md";

function gh<T>(path: string): T {
  const out = execSync(`gh api "${path}"`, { encoding: "utf8" });
  return JSON.parse(out) as T;
}

function git(args: string): string {
  try {
    return execSync(`git ${args}`, { encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

const deploys = gh<Array<Deploy & { sha: string }>>(
  `repos/${REPO}/deployments?per_page=100`,
).map((d) => ({
  id: d.id,
  sha: d.sha.slice(0, 10),
  fullSha: d.sha,
  environment: d.environment,
  created_at: d.created_at,
}));

console.log(`Fetched ${deploys.length} deployments. Pulling statuses...`);

const rows: Array<{
  date: string;
  env: string;
  shaShort: string;
  fullSha: string;
  status: string;
  url: string;
  subject: string;
  prNum: string | null;
  commitUrl: string;
  prUrl: string | null;
}> = [];

for (const d of deploys) {
  const statuses = gh<Status[]>(`repos/${REPO}/deployments/${d.id}/statuses`);
  const latest = statuses[0] ?? { state: "unknown", environment_url: "" };
  const subject = git(`log --format=%s -1 ${d.fullSha}`).slice(0, 80);
  const prMatch = subject.match(/\(#(\d+)\)/);
  const prNum = prMatch?.[1] ?? null;
  rows.push({
    date: d.created_at.slice(0, 16).replace("T", " "),
    env: d.environment,
    shaShort: d.sha.slice(0, 8),
    fullSha: d.fullSha,
    status: latest.state,
    url: latest.environment_url,
    subject,
    prNum,
    commitUrl: `https://github.com/${REPO}/commit/${d.fullSha}`,
    prUrl: prNum ? `https://github.com/${REPO}/pull/${prNum}` : null,
  });
}

const statusEmoji = (s: string) =>
  s === "success" ? "✓" : s === "failure" ? "✗" : s === "pending" ? "…" : "?";

const lines: string[] = [
  "---",
  "tags:",
  "  - domain/vercel",
  "  - domain/ci-cd",
  "  - status/adopted",
  "---",
  "",
  "# Vercel Deployments Index",
  "",
  `Generated ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC. Snapshot of all Vercel deployments for [redlamp/narrative-chess](https://github.com/redlamp/narrative-chess). Re-run \`bun scripts/build-deploys-page.ts\` to refresh.`,
  "",
  "Production deploys land on `main`. Preview deploys fire on every branch (since [[decision-vercel-default-previews]]). The stable dev alias `https://narrative-chess-git-dev-taylor-8571s-projects.vercel.app` always points at the dev tip.",
  "",
  "## Deployments",
  "",
  "| Date (UTC) | Env | Status | Commit | PR | Subject | Preview URL |",
  "|---|---|:-:|---|---|---|---|",
];

for (const r of rows) {
  const commitCell = `[\`${r.shaShort}\`](${r.commitUrl})`;
  const prCell = r.prUrl ? `[#${r.prNum}](${r.prUrl})` : "—";
  const urlCell = r.url ? `[open](${r.url})` : "—";
  const subjEsc = r.subject.replace(/\|/g, "\\|");
  lines.push(
    `| ${r.date} | ${r.env} | ${statusEmoji(r.status)} ${r.status} | ${commitCell} | ${prCell} | ${subjEsc} | ${urlCell} |`,
  );
}

lines.push("");
lines.push("## Notes");
lines.push("");
lines.push("- ✓ = success · ✗ = failure · … = pending · ? = unknown.");
lines.push(
  '- "Canceled by Ignored Build Step" status is what the now-removed branch filter (`vercel.json` `ignoreCommand`) used to do. After [[decision-vercel-default-previews]], all branches deploy.',
);
lines.push(
  "- Sha → commit URL on GitHub. PR cell links to the merge / open PR if the commit subject includes `(#N)`. Squash-merges typically carry the PR number; merge commits and direct pushes do not.",
);
lines.push(
  "- Preview URLs are immutable per-sha. The dev branch has a stable alias (above); other branches don't.",
);
lines.push("");
lines.push("## Related");
lines.push("");
lines.push(
  "- [[decision-vercel-default-previews]] — current branch-deploy posture",
);
lines.push(
  "- [[decision-vercel-branch-filter]] — superseded; original `main` + `dev` filter",
);
lines.push("- `vercel.json` — schema-only, no filter");

writeFileSync(PAGE, lines.join("\n") + "\n");
console.log(`Wrote ${PAGE} (${rows.length} rows).`);
