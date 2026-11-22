import { useState } from 'react';
import type { DesignRule } from '@project/contracts/workflow';
export function RuleEditor({
  name,
  rule,
  update,
  permissions,
  optional = false,
}: {
  name: string;
  rule?: DesignRule;
  update: (r?: DesignRule) => void;
  permissions: string[];
  optional?: boolean;
}) {
  const mode = !rule
    ? 'none'
    : rule.requester
      ? 'requester'
      : rule.position !== undefined
        ? rule.permission !== undefined
          ? 'combined'
          : 'position'
        : 'permission';
  return (
    <fieldset>
      <legend>{name}</legend>
      <label>
        {name} rule
        <select
          value={mode}
          onChange={(e) => {
            const m = e.target.value;
            update(
              m === 'none'
                ? undefined
                : m === 'requester'
                  ? { requester: true }
                  : m === 'permission'
                    ? { permission: '' }
                    : m === 'position'
                      ? { position: '' }
                      : { permission: '', position: '', match: 'all' },
            );
          }}
        >
          {(optional
            ? ['none', 'requester', 'permission']
            : ['requester', 'permission', 'position', 'combined']
          ).map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      </label>
      {(mode === 'permission' || mode === 'combined') && (
        <label>
          Permission
          <select
            value={rule?.permission ?? ''}
            onChange={(e) => update({ ...rule, permission: e.target.value })}
          >
            <option value="">Choose permission</option>
            {permissions.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
      )}
      {mode === 'combined' && (
        <label>
          Match
          <select
            value={rule?.match}
            onChange={(e) => update({ ...rule, match: e.target.value as 'all' | 'any' })}
          >
            <option>all</option>
            <option>any</option>
          </select>
        </label>
      )}
      {rule?.position !== undefined && (
        <>
          <label>
            Position routing
            <select
              value={typeof rule.position === 'string' ? 'fixed' : 'department'}
              onChange={(e) =>
                update({
                  ...rule,
                  position: e.target.value === 'fixed' ? '' : { byDepartment: {} },
                })
              }
            >
              <option value="fixed">Fixed position</option>
              <option value="department">By department</option>
            </select>
          </label>
          {typeof rule.position === 'string' ? (
            <label>
              Position code
              <input
                value={rule.position}
                onChange={(e) => update({ ...rule, position: e.target.value })}
              />
            </label>
          ) : (
            <DepartmentRules
              entries={rule.position.byDepartment}
              update={(byDepartment) => update({ ...rule, position: { byDepartment } })}
            />
          )}
        </>
      )}
    </fieldset>
  );
}
function DepartmentRules({
  entries,
  update,
}: {
  entries: Record<string, string>;
  update: (v: Record<string, string>) => void;
}) {
  const [department, setDepartment] = useState('');
  const [position, setPosition] = useState('');
  return (
    <>
      {Object.entries(entries).map(([d, p]) => (
        <div key={d}>
          {d} → {p}{' '}
          <button
            onClick={() =>
              update(Object.fromEntries(Object.entries(entries).filter(([k]) => k !== d)))
            }
          >
            Remove {d}
          </button>
        </div>
      ))}
      <label>
        Department code
        <input value={department} onChange={(e) => setDepartment(e.target.value)} />
      </label>
      <label>
        Position code
        <input value={position} onChange={(e) => setPosition(e.target.value)} />
      </label>
      <button
        disabled={!department || !position}
        onClick={() => {
          update({ ...entries, [department]: position });
          setDepartment('');
          setPosition('');
        }}
      >
        Set department position
      </button>
    </>
  );
}
