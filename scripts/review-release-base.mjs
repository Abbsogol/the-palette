import { execFileSync, spawnSync } from 'node:child_process';

// Read-only review of the refs already fetched by the operator. Never fetch,
// merge, reset, modify the index, or deploy as part of this command.
const baseRef = process.argv[2] || 'origin/main';
const candidateRef = process.argv[3] || 'HEAD';
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const resolve = ref => git('rev-parse', '--verify', `${ref}^{commit}`);
const base = resolve(baseRef);
const candidate = resolve(candidateRef);
const foundation = resolve('origin/codex/phase-1-foundation');
const policy = resolve('origin/codex/privacy-policy');
const ancestor = (a, b) => {
  const result = spawnSync('git', ['merge-base', '--is-ancestor', a, b]);
  if (![0, 1].includes(result.status)) throw new Error('Unable to inspect Git ancestry');
  return result.status === 0;
};
const rehearse = other => {
  const result = spawnSync('git', ['merge-tree', '--write-tree', candidate, other], { encoding: 'utf8' });
  if (![0, 1].includes(result.status)) throw new Error('Unable to rehearse merge');
  return {
    clean: result.status === 0,
    conflicts: [...result.stdout.matchAll(/^CONFLICT.*?Merge conflict in (.+)$/gm)].map(match => match[1]),
  };
};
const [candidateOnly, baseOnly] = git('rev-list', '--left-right', '--count', `${candidate}...${base}`).split(/\s+/).map(Number);
const baseMerge = rehearse(base);
const policyMerge = rehearse(policy);
const includesBase = ancestor(base, candidate);
const includesFoundation = ancestor(foundation, candidate);
console.log(JSON.stringify({
  inspectedAt: new Date().toISOString(),
  baseRef, base, candidateRef, candidate, foundation, policy,
  mergeBase: git('merge-base', candidate, base),
  candidateOnlyCommits: candidateOnly, baseOnlyCommits: baseOnly,
  includesBase, includesFoundation, includesPolicyCommit: ancestor(policy, candidate),
  baseMerge, policyMerge,
  integrationReady: includesBase && includesFoundation && baseMerge.clean,
  note: 'Git ancestry/conflict inventory only. Human review, credential inspection, policy comparison and CI on the resolved candidate remain required.',
}, null, 2));
if (!includesBase || !includesFoundation || !baseMerge.clean) process.exitCode = 1;
