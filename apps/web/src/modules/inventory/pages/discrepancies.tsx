import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { Dialog } from 'radix-ui';
import { useTranslation } from 'react-i18next';
import {
  bidi,
  Choice,
  ErrorMessage,
  Field,
  Grid,
  Pager,
  Resource,
  useDate,
  useFilters,
} from '../components/common';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { asQuery, useResource, useWrite } from '../lib/api';
import { useLanguage } from '../lib/i18n';

const categories = ['assignment', 'room', 'condition'] as const;
type Category = (typeof categories)[number];
type Report = {
  id: string;
  assetId: string;
  assetTag: string;
  assetName: string;
  reportedBy: string;
  reportedAt: string;
  category: Category;
  details: string;
  room: string | null;
  condition: string;
  assetRevision: number;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
};

function DiscrepancyDialog({
  asset,
  reviewId,
}: {
  asset: { id: string; tag: string; name: string };
  reviewId?: string;
}) {
  const { t } = useTranslation();
  const dir = useLanguage((s) => (s.language === 'ar' ? 'rtl' : 'ltr'));
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [category, setCategory] = useState('');
  const [message, setMessage] = useState('');
  const write = useWrite(
    reviewId ? `inventory/discrepancies/${reviewId}/review` : 'inventory/discrepancies',
  );
  const title = reviewId ? 'Review report' : 'Report a discrepancy';
  const setDialogOpen = (next: boolean) => {
    if (write.isPending) return;
    if (!next) {
      setCategory('');
      setMessage('');
      write.reset();
    }
    setOpen(next);
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const note = message.trim();
    if (write.isPending || !note || (!reviewId && !category)) return;
    write.mutate(reviewId ? { note } : { assetId: asset.id, category, details: note }, {
      onSuccess: () => {
        if (!reviewId) setSent(true);
        setOpen(false);
        setCategory('');
        setMessage('');
      },
    });
  };

  return (
    <>
      <Dialog.Root open={open} onOpenChange={setDialogOpen}>
        <Dialog.Trigger asChild>
          <Button type="button" variant="outline">
            {t(title)}
          </Button>
        </Dialog.Trigger>
        <Dialog.Portal container={document.querySelector<HTMLElement>('.faculty-inventory')}>
          <Dialog.Overlay className="inv-dialog-overlay" />
          <Dialog.Content dir={dir} className="inv-panel inv-dialog inv-stack">
            <Dialog.Title>{t(title)}</Dialog.Title>
            <Dialog.Description>
              {bidi(asset.tag)} · {bidi(asset.name)}
            </Dialog.Description>
            <form onSubmit={submit} className="inv-stack">
              <fieldset className="inv-stack" disabled={write.isPending}>
                {!reviewId && (
                  <Choice
                    label="Issue"
                    value={category}
                    choices={categories}
                    onChange={setCategory}
                  />
                )}
                <Field label={reviewId ? 'Review note' : 'Describe the discrepancy'}>
                  <Textarea
                    rows={4}
                    maxLength={2000}
                    value={message}
                    required
                    onChange={(event) => setMessage(event.target.value)}
                  />
                </Field>
              </fieldset>
              <ErrorMessage error={write.error} />
              <div className="inv-actions">
                <Button disabled={write.isPending || !message.trim() || (!reviewId && !category)}>
                  {t(write.isPending ? 'Saving…' : reviewId ? 'Mark reviewed' : 'Submit report')}
                </Button>
                <Dialog.Close asChild>
                  <Button type="button" variant="outline" disabled={write.isPending}>
                    {t('Cancel')}
                  </Button>
                </Dialog.Close>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      {sent && <span role="status">{t('Report sent to Inventory')}</span>}
    </>
  );
}

export function ReportDiscrepancy({ asset }: { asset: { id: string; tag: string; name: string } }) {
  return <DiscrepancyDialog asset={asset} />;
}

export function DiscrepanciesPage() {
  const { t } = useTranslation();
  const date = useDate();
  const filters = useFilters();
  const status = filters.get('status') === 'reviewed' ? 'reviewed' : 'open';
  const query = useResource<Report[]>(
    asQuery('inventory/discrepancies', { status, limit: 50, offset: filters.offset }),
    true,
    true,
  );
  return (
    <section className="inv-stack">
      <h2>{t('Discrepancy reports')}</h2>
      <Choice
        label="Report status"
        value={status}
        choices={['open', 'reviewed']}
        onChange={(value) => filters.update('status', value)}
      />
      <Resource query={query}>
        {(reports) => (
          <>
            <Grid
              columns={['Asset', 'Reported by', 'Issue', 'Recorded asset details', 'Review']}
              rows={reports.map((report) => ({
                id: report.id,
                cells: [
                  <div key="asset" className="inv-stack">
                    <span>
                      {bidi(report.assetTag)} · {bidi(report.assetName)}
                    </span>
                    <Link to={asQuery('/inventory/transactions', { assetId: report.assetId })}>
                      {t('View history')}
                    </Link>
                  </div>,
                  <div key="reporter">
                    {bidi(report.reportedBy)}
                    <div>{date(report.reportedAt)}</div>
                  </div>,
                  <div key="issue">
                    <strong>{t(report.category)}</strong>
                    <div>{bidi(report.details)}</div>
                  </div>,
                  <div key="recorded">
                    {bidi(report.room ?? t('No room'))} · {t(report.condition)}
                    <div>{t('Revision {{number}}', { number: report.assetRevision })}</div>
                  </div>,
                  report.reviewedAt ? (
                    <div key="reviewed">
                      {bidi(report.reviewedBy)} · {date(report.reviewedAt)}
                      <div>{bidi(report.reviewNote)}</div>
                    </div>
                  ) : (
                    <DiscrepancyDialog
                      key="review"
                      reviewId={report.id}
                      asset={{ id: report.assetId, tag: report.assetTag, name: report.assetName }}
                    />
                  ),
                ],
              }))}
            />
            <Pager
              offset={filters.offset}
              next={reports.length === 50}
              change={(offset) => filters.update('offset', String(offset))}
            />
          </>
        )}
      </Resource>
    </section>
  );
}
