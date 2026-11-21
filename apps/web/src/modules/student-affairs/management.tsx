import { useState, type FormEvent } from 'react';
import type {
  PromotionGrant,
  PromotionGrantRecipient,
  StaffYearAssignments,
} from '@project/contracts/student-affairs';
import { useRead, useWrite } from './api';
import {
  Button,
  ErrorMessage,
  Field,
  grantState,
  Input,
  Resource,
  useGrantClock,
  years,
} from './common';
import { useLanguage } from './language';

export function StaffAssignments() {
  const { t, year } = useLanguage();
  const query = useRead<StaffYearAssignments[]>('staff-year-assignments');
  const write = useWrite();
  return (
    <section className="sta-stack">
      <h2>{t('Staff assignments')}</h2>
      <ErrorMessage error={write.error} />
      {write.isSuccess && <p role="status">{t('Updated.')}</p>}
      <Resource query={query}>
        {(staff) =>
          staff.length ? (
            <div className="sta-table">
              <table>
                <thead>
                  <tr>
                    <th>{t('Staff member')}</th>
                    {years.map((value) => (
                      <th key={value}>{year(value)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {staff.map((member) => (
                    <tr key={member.userId}>
                      <th scope="row">
                        <bdi>{member.name}</bdi>
                      </th>
                      {years.map((value) => {
                        const assigned = member.years.includes(value);
                        return (
                          <td key={value}>
                            <Button
                              type="button"
                              variant={assigned ? 'secondary' : 'outline'}
                              aria-label={`${t(assigned ? 'Remove' : 'Assign')} ${year(value)} · ${member.name}`}
                              disabled={write.isPending}
                              onClick={() =>
                                write.mutate({
                                  path: `staff-year-assignments/${encodeURIComponent(member.userId)}/${value}`,
                                  method: assigned ? 'DELETE' : 'PUT',
                                })
                              }
                            >
                              {t(assigned ? 'Remove' : 'Assign')}
                            </Button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>{t('No staff to assign.')}</p>
          )
        }
      </Resource>
    </section>
  );
}

export function Grants() {
  const { t, dateTime } = useLanguage();
  const list = useRead<PromotionGrant[]>('promotion-grants', 30_000);
  const recipients = useRead<PromotionGrantRecipient[]>('promotion-grants/recipients');
  const issue = useWrite<PromotionGrant>();
  const revoke = useWrite();
  const [recipient, setRecipient] = useState('');
  const [expiry, setExpiry] = useState('');
  const [confirmation, setConfirmation] = useState<{ userId: string; expiresAt: string }>();
  const [revoking, setRevoking] = useState<PromotionGrant>();
  const [invalidExpiry, setInvalidExpiry] = useState(false);
  const nextExpiry = list.data
    ?.filter((grant) => grantState(grant, Date.now()) === 'Active')
    .map(({ expiresAt }) => expiresAt)
    .sort()[0];
  const now = useGrantClock(nextExpiry);
  const names = new Map(recipients.data?.map(({ userId, name }) => [userId, name]));
  const recipientName = (id: string) => names.get(id) ?? id;
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const date = new Date(expiry);
    if (!Number.isFinite(date.getTime()) || date.getTime() <= Date.now()) {
      setInvalidExpiry(true);
      setConfirmation(undefined);
      return;
    }
    setInvalidExpiry(false);
    if (!confirmation) {
      setConfirmation({ userId: recipient, expiresAt: date.toISOString() });
      return;
    }
    issue.mutate(
      { method: 'POST', path: 'promotion-grants', body: confirmation },
      {
        onSuccess: () => {
          setRecipient('');
          setExpiry('');
          setConfirmation(undefined);
        },
      },
    );
  }
  return (
    <section className="sta-stack">
      <h2>{t('Promotion grants')}</h2>
      <section className="sta-panel sta-stack">
        <h3>{t('Issue grant')}</h3>
        <Resource query={recipients}>
          {(options) =>
            options.length ? (
              <form className="sta-stack" onSubmit={submit}>
                <div className="sta-fields">
                  <Field label={t('Recipient')}>
                    <select
                      data-slot="native-select"
                      required
                      value={recipient}
                      disabled={!!confirmation || issue.isPending}
                      onChange={(event) => setRecipient(event.target.value)}
                    >
                      <option value="">{t('Choose a recipient')}</option>
                      {options.map(({ userId, name }) => (
                        <option key={userId} value={userId}>
                          {name} · {userId}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label={t('Expiry date and time')}>
                    <Input
                      type="datetime-local"
                      required
                      value={expiry}
                      disabled={!!confirmation || issue.isPending}
                      onChange={(event) => setExpiry(event.target.value)}
                      dir="ltr"
                    />
                  </Field>
                </div>
                <p className="sta-muted">
                  {t('Time zone')} <bdi>{timeZone}</bdi>
                </p>
                {invalidExpiry && <p role="alert">{t('Enter a valid expiry in the future.')}</p>}
                {confirmation && (
                  <p role="status">
                    <bdi>{recipientName(confirmation.userId)}</bdi> ·{' '}
                    <bdi>{dateTime(confirmation.expiresAt)}</bdi>
                  </p>
                )}
                <ErrorMessage error={issue.error} />
                {issue.isSuccess && <p role="status">{t('Updated.')}</p>}
                <div className="sta-actions">
                  <Button disabled={issue.isPending || !recipient || !expiry}>
                    {t(confirmation ? 'Confirm grant' : 'Issue grant')}
                  </Button>
                  {confirmation && (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={issue.isPending}
                      onClick={() => {
                        issue.reset();
                        setConfirmation(undefined);
                      }}
                    >
                      {t('Cancel')}
                    </Button>
                  )}
                </div>
              </form>
            ) : (
              <p>{t('No eligible admin accounts.')}</p>
            )
          }
        </Resource>
      </section>
      {revoking && (
        <section className="sta-panel sta-stack">
          <h3>{t('Confirm revocation')}</h3>
          <p>
            <bdi>{recipientName(revoking.userId)}</bdi> · <bdi>{dateTime(revoking.expiresAt)}</bdi>
          </p>
          <p>{t('Revoking ends the admin’s promotion access immediately.')}</p>
          <div className="sta-actions">
            <Button
              type="button"
              variant="destructive"
              disabled={revoke.isPending}
              onClick={() =>
                revoke.mutate(
                  { method: 'DELETE', path: `promotion-grants/${encodeURIComponent(revoking.id)}` },
                  { onSuccess: () => setRevoking(undefined) },
                )
              }
            >
              {t('Confirm revocation')}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={revoke.isPending}
              onClick={() => {
                revoke.reset();
                setRevoking(undefined);
              }}
            >
              {t('Cancel')}
            </Button>
          </div>
        </section>
      )}
      <ErrorMessage error={revoke.error} />
      {revoke.isSuccess && <p role="status">{t('Updated.')}</p>}
      <Resource query={list}>
        {(grants) =>
          grants.length ? (
            <div className="sta-table">
              <table>
                <thead>
                  <tr>
                    <th>{t('Recipient')}</th>
                    <th>{t('Issued at')}</th>
                    <th>{t('Expires at')}</th>
                    <th>{t('Status')}</th>
                    <th aria-label={t('Revoke grant')} />
                  </tr>
                </thead>
                <tbody>
                  {grants.map((grant) => {
                    const status = grantState(grant, now);
                    return (
                      <tr key={grant.id}>
                        <td>
                          <bdi>{recipientName(grant.userId)}</bdi>
                        </td>
                        <td>
                          <bdi>{dateTime(grant.issuedAt)}</bdi>
                        </td>
                        <td>
                          <bdi>{dateTime(grant.expiresAt)}</bdi>
                        </td>
                        <td>
                          <span className={status === 'Active' ? 'sta-active' : 'sta-muted'}>
                            {t(status)}
                          </span>
                        </td>
                        <td>
                          {status === 'Active' && (
                            <Button
                              type="button"
                              variant="outline"
                              disabled={revoke.isPending}
                              onClick={() => setRevoking(grant)}
                            >
                              {t('Revoke grant')}
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p>{t('No promotion grants yet.')}</p>
          )
        }
      </Resource>
    </section>
  );
}
