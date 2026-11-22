import { BadRequestException } from '@nestjs/common';
import { PERMISSION_CATALOG } from '@project/authorization';
import { z } from 'zod';
import type { DesignDocument, DesignRule } from '@project/contracts/workflow';
import type { WorkflowDefinition } from './workflow-definition.js';

const word = z.string().max(100);
const rule = z.strictObject({
  requester: z.literal(true).optional(),
  permission: word.optional(),
  position: z.union([word, z.strictObject({ byDepartment: z.record(word, word) })]).optional(),
  match: z.enum(['any', 'all']).optional(),
});
const transition = z.union([
  z.strictObject({ next: word }),
  z.strictObject({ finish: z.enum(['completed', 'rejected', 'cancelled']) }),
]);
export const designSchema = z
  .strictObject({
    title: z.string().max(200),
    description: z.string().max(4000),
    key: word,
    version: z.number().int().positive().max(2147483647),
    initialStep: word,
    steps: z
      .array(
        z.strictObject({
          id: word.min(1),
          key: word,
          title: z.string().max(200),
          instructions: z.string().max(4000),
          eligible: rule,
          withdraw: rule.optional(),
          actions: z.array(z.strictObject({ key: word, target: transition })).max(50),
          x: z.number().min(0).max(20000),
          y: z.number().min(0).max(20000),
        }),
      )
      .max(100),
  })
  .refine(
    (d) => new Set(d.steps.map((s) => s.id)).size === d.steps.length,
    'Step IDs must be unique',
  );
export function templateDraft(d: WorkflowDefinition): DesignDocument {
  return {
    ...d,
    steps: Object.entries(d.steps).map(([key, s], i) => ({
      ...s,
      id: key,
      key,
      x: 30 + (i % 3) * 260,
      y: 40 + Math.floor(i / 3) * 180,
      actions: Object.entries(s.actions).map(([key, target]) => ({ key, target })),
    })),
  };
}
const codes = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const permissions = new Set<string>(PERMISSION_CATALOG.map((p) => p.key));
function validRule(r: DesignRule, withdraw = false) {
  if (r.requester) return Object.keys(r).length === 1;
  if (r.permission !== undefined && !permissions.has(r.permission)) return false;
  if (r.position === undefined) return !!r.permission && !r.match;
  if (withdraw || (r.permission ? !r.match : !!r.match)) return false;
  if (typeof r.position === 'string') return codes.test(r.position) && r.position.length <= 80;
  const entries = Object.entries(r.position.byDepartment);
  return (
    entries.length > 0 &&
    entries.every((pair) => pair.every((v) => v.length <= 80 && codes.test(v)))
  );
}
export function exportDesign(d: DesignDocument) {
  const issues: string[] = [];
  const byId = new Map(d.steps.map((s) => [s.id, s]));
  if (!/^[a-z][a-z0-9-]*\.[a-z][a-z0-9.-]*$/.test(d.key) || !d.title.trim())
    issues.push('Enter a workflow key (module.name) and title.');
  if (!byId.has(d.initialStep)) issues.push('Choose an initial step.');
  const reached = new Set<string>();
  const pending = [d.initialStep];
  while (pending.length) {
    const id = pending.pop()!;
    if (reached.has(id)) continue;
    reached.add(id);
    for (const a of byId.get(id)?.actions ?? [])
      if ('next' in a.target) pending.push(a.target.next);
  }
  const keys = new Set<string>();
  for (const s of d.steps) {
    const problems: string[] = [];
    if (!codes.test(s.key) || keys.has(s.key)) problems.push('use a unique step key');
    keys.add(s.key);
    if (!s.title.trim()) problems.push('enter a title');
    if (!reached.has(s.id)) problems.push('unreachable from the initial step');
    if (!validRule(s.eligible) || (s.withdraw && !validRule(s.withdraw, true)))
      problems.push('check eligibility and withdrawal rules');
    if (
      !s.actions.length ||
      new Set(s.actions.map((a) => a.key)).size !== s.actions.length ||
      s.actions.some((a) => !codes.test(a.key) || ('next' in a.target && !byId.has(a.target.next)))
    )
      problems.push('give each action a unique key and valid destination');
    if (problems.length) issues.push((s.title || s.key || s.id) + ': ' + problems.join(', '));
  }
  if (issues.length) throw new BadRequestException(issues);
  return {
    ...d,
    initialStep: byId.get(d.initialStep)!.key,
    steps: Object.fromEntries(
      d.steps.map((s) => [
        s.key,
        {
          title: s.title,
          instructions: s.instructions,
          eligible: s.eligible,
          withdraw: s.withdraw,
          actions: Object.fromEntries(
            s.actions.map((a) => [
              a.key,
              'next' in a.target ? { next: byId.get(a.target.next)!.key } : a.target,
            ]),
          ),
        },
      ]),
    ),
  };
}
