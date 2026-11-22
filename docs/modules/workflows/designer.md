# Workflow designer

Sign in through a faculty module and open **Workflow designer** from the task inbox. All designers share the same draft list. [Open the local designer](http://localhost:3000/workflow/designer)

## Create and review a draft

1. Choose **Blank workflow** or a registered template, then **Create draft**. A template copies the active definition, including revision loops and withdrawal rules.
2. Enter the workflow key (for example, `faculty.review`), title, and definition version. Add steps, select the initial step, and drag cards to arrange the canvas.
3. Select a card to set its key, instructions, eligibility, and optional withdrawal rule. For each action, choose another step or a terminal outcome. Eligibility can use the requester, a permission, a faculty position, or a permission combined with a position.
4. Choose **Save draft** to share changes, including incomplete work. If someone saved first, **Reload latest** discards your unsaved edits and opens their revision. **Save as new draft** keeps your edits in a separate shared copy.
5. Choose **Export definition** on a saved draft. Resolve any reported validation errors and save again. The JSON contains the workflow definition. Developers register it with the module's domain handlers to make a version runnable.

## Enable access on an existing installation

Apply the database migration and synchronize the permission catalog from the repository root.

```sh
pnpm --filter @project/db migrate
pnpm --filter @project/db seed:permissions
```

Migration `0011_workflow_drafts` creates the shared draft table. Grant `workflow:design-read` to roles that review and export. Grant `workflow:design-edit` to roles that also create and edit. The catalog sync preserves existing role grants, so an Administrator role created before this feature may need a grant.

For an existing installation where nobody can delegate the new keys, a database operator can bootstrap the designated Administrator role after catalog synchronization. Each permission the administrator delegates must also be held by that administrator. Run the following in the intended application database and check that the final query returns both keys.

```sql
INSERT INTO role_permissions (role_id, permission)
SELECT r.id, p.key
FROM roles AS r
CROSS JOIN permissions AS p
WHERE r.name = 'Administrator'
  AND p.key IN ('workflow:design-read', 'workflow:design-edit')
ON CONFLICT DO NOTHING;

SELECT rp.permission
FROM role_permissions AS rp
JOIN roles AS r ON r.id = rp.role_id
WHERE r.name = 'Administrator'
  AND rp.permission IN ('workflow:design-read', 'workflow:design-edit');
```

Refresh the designer after changing access. A signed-out request to `GET /api/workflow/designer/capabilities` returns 401. A signed-in user can check the returned `canRead` and `canEdit` values. If that endpoint returns 404, verify that the API process is running the build that includes the designer.
