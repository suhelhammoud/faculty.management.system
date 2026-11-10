import { useState, type FormEvent, type ReactNode } from "react";
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { api } from "./api";
import { useUi } from "./store";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import "./index.css";
type User = {
  id: string;
  username: string;
  name: string;
  approved: boolean;
  enabled: boolean;
  mustChangePassword: boolean;
};
type Role = { id: string; name: string };
type RolePermission = { key: string };
type Acl = {
  id: string;
  resourceType: string;
  resourceId: string;
  permission: string;
  effect: string;
};
type AuditRecord = {
  id: string;
  actorId: string;
  actorUsername: string | null;
  actorName: string | null;
  action: string;
  targetId: string;
  createdAt: string;
};
type AuditPage = {
  records: AuditRecord[];
  page: number;
  pageSize: number;
  total: number;
};
const enc = encodeURIComponent;
function Field({
  name,
  label,
  password = false,
}: {
  name: string;
  label: string;
  password?: boolean;
}) {
  return (
    <label>
      {label}
      <Input
        name={name}
        required
        type={password ? "password" : "text"}
        minLength={password ? 12 : undefined}
        maxLength={password ? 128 : undefined}
        autoComplete={password ? "new-password" : "off"}
      />
    </label>
  );
}
function ActionForm({
  title,
  path,
  method = "POST",
  children,
  onSuccess,
}: {
  title: string;
  path: string;
  method?: string;
  children?: ReactNode;
  onSuccess?: () => void;
}) {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: (body: Record<string, FormDataEntryValue>) =>
      api(path, method, body),
    onSuccess: async () => {
      await client.invalidateQueries();
      onSuccess?.();
    },
  });
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = Object.fromEntries(new FormData(form));
    try {
      await mutation.mutateAsync(body);
      form.reset();
      mutation.reset();
      setDone(true);
    } catch {
      /* rendered below */
    }
  }
  const [done, setDone] = useState(false);
  return (
    <form onSubmit={submit} className="panel">
      <h2>{title}</h2>
      <fieldset
        disabled={mutation.isPending}
        className="form-grid border-0 p-0 m-0"
      >
        {children}
        <Button type="submit">{mutation.isPending ? "Saving…" : title}</Button>
      </fieldset>
      {mutation.error && <p role="alert">{mutation.error.message}</p>}
      {done && <p role="status">Saved successfully.</p>}
    </form>
  );
}
function Access() {
  const client = useQueryClient();
  const session = useQuery({
    queryKey: ["session"],
    queryFn: () => api<{ user: User } | null>("auth/get-session"),
    refetchInterval: 30000,
    retry: false,
  });
  const reset = () => {
    client.clear();
    useUi.getState().reset();
    void session.refetch();
  };
  const logout = useMutation({
    mutationFn: () => api("auth/sign-out", "POST", {}),
    onSuccess: reset,
  });
  const login = useMutation({
    mutationFn: (body: { username: string; password: string }) =>
      api("auth/sign-in/username", "POST", body),
    onSuccess: reset,
  });
  const change = useMutation({
    mutationFn: (body: { currentPassword: string; newPassword: string }) =>
      api("admin/change-password", "POST", body),
    onSuccess: reset,
  });
  const [validation, setValidation] = useState("");
  if (session.isPending) return <p role="status">Checking your session…</p>;
  if (session.error)
    return (
      <div className="panel">
        <p role="alert">Unable to reach the API. {session.error.message}</p>
        <Button onClick={() => void session.refetch()}>Retry</Button>
      </div>
    );
  const user = session.data?.user;
  if (!user)
    return (
      <div className="mx-auto max-w-md pt-12">
        <h1>Faculty administration</h1>
        <p>Sign in with the account provided by your administrator.</p>
        <form
          className="panel grid gap-5"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const data = new FormData(form);
            try {
              await login.mutateAsync({
                username: String(data.get("username")),
                password: String(data.get("password")),
              });
              form.reset();
              login.reset();
            } catch {}
          }}
        >
          <h2>Welcome back</h2>
          <label>
            Username
            <Input name="username" autoComplete="username" required />
          </label>
          <label>
            Password
            <Input
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          <Button disabled={login.isPending}>
            {login.isPending ? "Signing in…" : "Sign in"}
          </Button>
          {login.error && <p role="alert">{login.error.message}</p>}
          <p className="text-sm">
            Forgot your password? Contact your administrator.
          </p>
        </form>
      </div>
    );
  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1>Faculty administration</h1>
          <p>Signed in as {user.username || user.name}</p>
        </div>
        <Button
          variant="outline"
          disabled={logout.isPending}
          onClick={() => logout.mutate()}
        >
          Sign out
        </Button>
      </header>
      {logout.error && <p role="alert">{logout.error.message}</p>}
      {!user.enabled ? (
        <section className="panel">
          Your account is disabled. Contact your administrator.
        </section>
      ) : user.mustChangePassword ? (
        <form
          className="panel mx-auto max-w-lg grid gap-4"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const data = new FormData(form);
            if (data.get("newPassword") !== data.get("confirm")) {
              setValidation("Passwords do not match.");
              return;
            }
            setValidation("");
            try {
              await change.mutateAsync({
                currentPassword: String(data.get("currentPassword")),
                newPassword: String(data.get("newPassword")),
              });
              form.reset();
              change.reset();
            } catch {}
          }}
        >
          <h2>Set your new password</h2>
          <p>
            Replace your temporary password to continue. You will sign in again
            afterward.
          </p>
          <label>
            Current password
            <Input
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          <Field
            name="newPassword"
            label="New password (12–128 characters)"
            password
          />
          <Field name="confirm" label="Confirm new password" password />
          <Button disabled={change.isPending}>Change password</Button>
          {(validation || change.error) && (
            <p role="alert">{validation || change.error?.message}</p>
          )}
        </form>
      ) : !user.approved ? (
        <section className="panel">
          <h2>Awaiting approval</h2>
          <p>
            Your administrator must approve your account before you can
            continue.
          </p>
          <Button onClick={() => void session.refetch()}>Check approval</Button>
        </section>
      ) : (
        <Dashboard />
      )}
    </>
  );
}
function Dashboard() {
  const { tab, setTab, selectedUser, selectUser } = useUi();
  const client = useQueryClient();
  const [roleId, setRoleId] = useState("");
  const [auditPage, setAuditPage] = useState(1);
  const [auditAction, setAuditAction] = useState("");
  const [auditActor, setAuditActor] = useState("");
  const [auditFrom, setAuditFrom] = useState("");
  const [auditTo, setAuditTo] = useState("");
  const users = useQuery({
    queryKey: ["users"],
    queryFn: () => api<User[]>("admin/users"),
    retry: false,
  });
  const roles = useQuery({
    queryKey: ["roles"],
    queryFn: () => api<Role[]>("admin/roles"),
    retry: false,
  });
  const permissions = useQuery({
    queryKey: ["permissions"],
    queryFn: () => api<{ key: string }[]>("admin/permissions"),
    retry: false,
  });
  const rolePermissions = useQuery({
    queryKey: ["role-permissions", roleId],
    queryFn: () =>
      api<RolePermission[]>(`admin/roles/${enc(roleId)}/permissions`),
    enabled: tab === "roles" && !!roleId,
    retry: false,
  });
  const acl = useQuery({
    queryKey: ["acl", selectedUser],
    queryFn: () => api<Acl[]>(`admin/users/${enc(selectedUser)}/acl`),
    enabled: tab === "acl" && !!selectedUser,
    retry: false,
  });
  const audit = useQuery({
    queryKey: [
      "audit-log",
      auditPage,
      auditAction,
      auditActor,
      auditFrom,
      auditTo,
    ],
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(auditPage),
        pageSize: "25",
      });
      if (auditAction) params.set("action", auditAction);
      if (auditActor) params.set("actor", auditActor);
      if (auditFrom) params.set("from", new Date(auditFrom).toISOString());
      if (auditTo) params.set("to", new Date(auditTo).toISOString());
      return api<AuditPage>(`admin/audit-log?${params.toString()}`);
    },
    enabled: tab === "audit",
    retry: false,
  });
  const mutation = useMutation({
    mutationFn: ({ path, method }: { path: string; method: string }) =>
      api(path, method, method === "POST" ? {} : undefined),
    onSuccess: () => client.invalidateQueries(),
  });
  const act = (path: string, label: string, method = "POST") => {
    if (window.confirm(label)) mutation.mutate({ path, method });
  };
  const userOptions = (
    <>
      <option value="">Choose a user</option>
      {users.data?.map((u) => (
        <option key={u.id} value={u.id}>
          {u.name} (@{u.username})
        </option>
      ))}
    </>
  );
  const roleOptions = (
    <>
      <option value="">Choose a role</option>
      {roles.data?.map((r) => (
        <option key={r.id} value={r.id}>
          {r.name}
        </option>
      ))}
    </>
  );
  return (
    <>
      <nav aria-label="Administration" className="flex flex-wrap gap-2 mt-6">
        {(["users", "roles", "acl", "audit"] as const).map((t) => (
          <Button
            key={t}
            variant={tab === t ? "default" : "outline"}
            aria-pressed={tab === t}
            onClick={() => setTab(t)}
          >
            {t === "audit"
              ? "Audit log"
              : t === "acl"
                ? "Resource access"
                : t === "users"
                  ? "Accounts"
                  : "Roles & permissions"}
          </Button>
        ))}
      </nav>
      {mutation.error && <p role="alert">{mutation.error.message}</p>}
      {[users, roles, permissions].map((q, i) =>
        q.error ? (
          <p role="alert" key={i}>
            {["Accounts", "Roles", "Permissions"][i]}: {q.error.message}
          </p>
        ) : null,
      )}
      {tab === "users" && (
        <>
          <section className="panel overflow-x-auto">
            <h2>Accounts</h2>
            {users.isPending ? (
              <p>Loading accounts…</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Username</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.data?.map((u) => (
                    <tr key={u.id}>
                      <td>{u.name}</td>
                      <td>{u.username}</td>
                      <td>
                        {!u.enabled
                          ? "Disabled"
                          : !u.approved
                            ? "Pending approval"
                            : u.mustChangePassword
                              ? "Password change required"
                              : "Active"}
                      </td>
                      <td className="flex flex-wrap gap-2">
                        {!u.approved && (
                          <Button
                            disabled={mutation.isPending}
                            onClick={() =>
                              act(
                                `admin/users/${enc(u.id)}/approve`,
                                `Approve ${u.username}?`,
                              )
                            }
                          >
                            Approve
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          disabled={mutation.isPending}
                          onClick={() =>
                            act(
                              `admin/users/${enc(u.id)}/${u.enabled ? "disable" : "enable"}`,
                              `${u.enabled ? "Disable" : "Enable"} ${u.username}?`,
                            )
                          }
                        >
                          {u.enabled ? "Disable" : "Enable"}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => selectUser(u.id)}
                        >
                          Manage
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {users.data?.length === 0 && <p>No accounts found.</p>}
          </section>
          <ActionForm title="Create account" path="admin/users">
            <Field name="name" label="Full name" />
            <Field name="username" label="Username" />
            <Field name="password" label="Temporary password" password />
          </ActionForm>
          <section className="panel">
            <label>
              Manage account
              <select
                value={selectedUser}
                onChange={(e) => selectUser(e.target.value)}
              >
                {userOptions}
              </select>
            </label>
          </section>
          {selectedUser && (
            <>
              <ActionForm
                key={"reset" + selectedUser}
                title="Reset password"
                path={`admin/users/${enc(selectedUser)}/reset-password`}
              >
                <Field
                  name="password"
                  label="New temporary password"
                  password
                />
                <p>
                  All sessions will be revoked. Share the password securely.
                </p>
              </ActionForm>
              <ActionForm
                title="Assign role"
                path={`admin/users/${enc(selectedUser)}/roles`}
              >
                <label>
                  Role
                  <select name="roleId" required>
                    {roleOptions}
                  </select>
                </label>
              </ActionForm>
              <section className="panel form-grid">
                <label>
                  Role to remove
                  <select
                    value={roleId}
                    onChange={(e) => setRoleId(e.target.value)}
                  >
                    {roleOptions}
                  </select>
                </label>
                <Button
                  variant="destructive"
                  disabled={!roleId || mutation.isPending}
                  onClick={() =>
                    act(
                      `admin/users/${enc(selectedUser)}/roles/${enc(roleId)}`,
                      "Remove this role assignment and revoke sessions?",
                      "DELETE",
                    )
                  }
                >
                  Remove assignment
                </Button>
              </section>
            </>
          )}
        </>
      )}
      {tab === "roles" && (
        <>
          <ActionForm title="Create role" path="admin/roles">
            <Field name="name" label="Role name" />
          </ActionForm>
          <section className="panel">
            <h2>Manage role</h2>
            <label>
              Role
              <select
                value={roleId}
                onChange={(e) => setRoleId(e.target.value)}
              >
                {roleOptions}
              </select>
            </label>
          </section>
          {roleId && (
            <>
              <ActionForm
                title="Grant permission"
                path={`admin/roles/${enc(roleId)}/permissions`}
              >
                <label>
                  Permission
                  <select name="permission" required>
                    <option value="">Choose permission</option>
                    {permissions.data?.map((p) => (
                      <option key={p.key}>{p.key}</option>
                    ))}
                  </select>
                </label>
              </ActionForm>
              <section className="panel overflow-x-auto">
                <h2>Assigned permissions</h2>
                {rolePermissions.isPending ? (
                  <p>Loading assigned permissions…</p>
                ) : rolePermissions.error ? (
                  <p role="alert">{rolePermissions.error.message}</p>
                ) : rolePermissions.data?.length === 0 ? (
                  <p>This role has no permissions.</p>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>Permission</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rolePermissions.data?.map(({ key }) => (
                        <tr key={key}>
                          <td>
                            <code>{key}</code>
                          </td>
                          <td>
                            <Button
                              variant="destructive"
                              disabled={mutation.isPending}
                              onClick={() =>
                                act(
                                  `admin/roles/${enc(roleId)}/permissions/${enc(key)}`,
                                  `Remove ${key} from this role?`,
                                  "DELETE",
                                )
                              }
                            >
                              Remove
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>
              <section className="panel">
                <Button
                  variant="destructive"
                  disabled={mutation.isPending}
                  onClick={() =>
                    act(
                      `admin/roles/${enc(roleId)}`,
                      "Delete this role and all its assignments?",
                      "DELETE",
                    )
                  }
                >
                  Delete role
                </Button>
              </section>
            </>
          )}
          <section className="panel">
            <h2>Permission catalog</h2>
            <div className="flex flex-wrap gap-2">
              {permissions.data?.map((p) => (
                <code key={p.key} className="rounded bg-muted px-2 py-1">
                  {p.key}
                </code>
              ))}
            </div>
          </section>
        </>
      )}
      {tab === "acl" && (
        <>
          <section className="panel">
            <h2>Individual resource exceptions</h2>
            <p>
              Explicit denies take precedence over grants and role permissions.
            </p>
            <label>
              User
              <select
                value={selectedUser}
                onChange={(e) => selectUser(e.target.value)}
              >
                {userOptions}
              </select>
            </label>
          </section>
          {selectedUser && (
            <>
              <ActionForm
                title="Add access rule"
                path={`admin/users/${enc(selectedUser)}/acl`}
              >
                <label>
                  Resource type
                  <select name="resourceType">
                    <option value="users">User</option>
                    <option value="roles">Role</option>
                  </select>
                </label>
                <Field name="resourceId" label="Resource ID" />
                <label>
                  Permission
                  <select name="permission" required>
                    <option value="">Choose permission</option>
                    {permissions.data?.map((p) => (
                      <option key={p.key}>{p.key}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Effect
                  <select name="effect">
                    <option value="allow">Grant</option>
                    <option value="deny">Deny</option>
                  </select>
                </label>
              </ActionForm>
              <section className="panel overflow-x-auto">
                <h2>Access rules</h2>
                {acl.error && <p role="alert">{acl.error.message}</p>}
                {acl.isPending ? (
                  <p>Loading…</p>
                ) : acl.data?.length === 0 ? (
                  <p>No resource exceptions.</p>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>Resource</th>
                        <th>Permission</th>
                        <th>Effect</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {acl.data?.map((r) => (
                        <tr key={r.id}>
                          <td>
                            {r.resourceType}: {r.resourceId}
                          </td>
                          <td>{r.permission}</td>
                          <td>{r.effect}</td>
                          <td>
                            <Button
                              variant="destructive"
                              disabled={mutation.isPending}
                              onClick={() =>
                                act(
                                  `admin/users/${enc(selectedUser)}/acl/${enc(r.id)}`,
                                  "Remove this access rule?",
                                  "DELETE",
                                )
                              }
                            >
                              Remove
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>
            </>
          )}
        </>
      )}
      {tab === "audit" && (
        <section className="panel overflow-x-auto">
          <h2>Recent administrative activity</h2>
          <div className="form-grid my-4">
            <label>
              Action
              <input
                value={auditAction}
                onChange={(e) => {
                  setAuditAction(e.target.value);
                  setAuditPage(1);
                }}
                placeholder="e.g. users:approve"
              />
            </label>
            <label>
              Actor ID
              <input
                value={auditActor}
                onChange={(e) => {
                  setAuditActor(e.target.value);
                  setAuditPage(1);
                }}
                placeholder="User ID"
              />
            </label>
            <label>
              From
              <input
                type="datetime-local"
                value={auditFrom}
                onChange={(e) => {
                  setAuditFrom(e.target.value);
                  setAuditPage(1);
                }}
              />
            </label>
            <label>
              To
              <input
                type="datetime-local"
                value={auditTo}
                onChange={(e) => {
                  setAuditTo(e.target.value);
                  setAuditPage(1);
                }}
              />
            </label>
          </div>
          {audit.isPending ? (
            <p>Loading audit records…</p>
          ) : audit.error ? (
            <p role="alert">{audit.error.message}</p>
          ) : audit.data?.records.length === 0 ? (
            <p>No audit records yet.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Administrator</th>
                  <th>Action</th>
                  <th>Target</th>
                </tr>
              </thead>
              <tbody>
                {audit.data?.records.map((record) => (
                  <tr key={record.id}>
                    <td>{new Date(record.createdAt).toLocaleString()}</td>
                    <td>
                      {record.actorName ||
                        record.actorUsername ||
                        record.actorId}
                    </td>
                    <td>
                      <code>{record.action}</code>
                    </td>
                    <td>{record.targetId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {audit.data && (
            <div className="flex items-center justify-between gap-3 py-4">
              <span>
                Page {audit.data.page} · {audit.data.total} records
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  disabled={auditPage <= 1 || audit.isFetching}
                  onClick={() => setAuditPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  disabled={
                    auditPage * audit.data.pageSize >= audit.data.total ||
                    audit.isFetching
                  }
                  onClick={() => setAuditPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </section>
      )}
    </>
  );
}
export default function App() {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false, gcTime: 0 },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <div className="faculty-admin">
        <div className="mx-auto max-w-6xl">
          <Access />
        </div>
      </div>
    </QueryClientProvider>
  );
}
