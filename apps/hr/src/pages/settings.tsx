import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Navigate, useNavigate, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { hrApi } from '../lib/api';
import { useReferences } from '../lib/queries';
import { useUi } from '../lib/store';
import { kinds, referenceId, referenceName, type Kind, type Reference } from '../lib/types';
import {
  referenceFields,
  referenceRequired,
  referencePayload,
  validateValues,
  serverFieldErrors,
} from '../lib/forms';
import { Field, ReferenceSelect, Loading, ErrorMessage, Success } from '../components/common';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogHeader,
} from '../components/ui/dialog';
import { Checkbox } from '../components/ui/checkbox';
import { Label } from '../components/ui/label';

export function SettingsPage() {
  const { kind } = useParams();
  if (!kinds.includes(kind as Kind)) return <Navigate to="/hr/settings/staff-categories" replace />;
  return <Settings key={kind} kind={kind as Kind} />;
}
function Settings({ kind }: { kind: Kind }) {
  const { t } = useTranslation();
  const language = useUi((s) => s.language);
  const navigate = useNavigate();
  const records = useReferences(kind);
  const categories = useReferences('staff-categories');
  const schemes = useReferences('grade-schemes');
  const [editing, setEditing] = useState<Reference | null | undefined>(undefined);
  const [done, setDone] = useState(false);
  const opener = useRef<HTMLButtonElement | null>(null);
  const open = (row: Reference | null, button: HTMLButtonElement) => {
    opener.current = button;
    setEditing(row);
    setDone(false);
  };
  const ownerName = (row: Reference) => {
    const owner =
      kind === 'positions'
        ? categories.data?.find((r) => r.categoryId === row.categoryId)
        : schemes.data?.find((r) => r.schemeId === row.schemeId);
    return owner ? referenceName(owner, language) : '—';
  };
  return (
    <div className="hr-stack">
      <div>
        <h2>{t('Reference data')}</h2>
        <p className="hr-muted">{t('Manage the lists used in employee forms.')}</p>
      </div>
      <Tabs value={kind} onValueChange={(value) => navigate(`/hr/settings/${value}`)}>
        <TabsList className="hr-settings-tabs">
          {kinds.map((item) => (
            <TabsTrigger key={item} value={item}>
              {t(item)}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value={kind} className="hr-stack">
          <div className="hr-row">
            <h3>{t(kind)}</h3>
            <Button onClick={(e) => open(null, e.currentTarget)}>{t('Add record')}</Button>
          </div>
          <Success show={done} />
          {records.isPending ? (
            <Loading />
          ) : records.error ? (
            <ErrorMessage error={records.error} retry={() => void records.refetch()} />
          ) : (
            <Card>
              <CardContent>
                {!records.data.length ? (
                  <p>{t('No records yet.')}</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('code')}</TableHead>
                        <TableHead>{t('Name')}</TableHead>
                        {['positions', 'employment-grades'].includes(kind) && (
                          <TableHead>
                            {t(kind === 'positions' ? 'categoryId' : 'schemeId')}
                          </TableHead>
                        )}
                        <TableHead>{t('Actions')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {records.data.map((record) => (
                        <TableRow key={referenceId(kind, record)}>
                          <TableCell dir="ltr">
                            {record.code ||
                              `${record.gradeNumber}${record.stepNumber ? ` / ${record.stepNumber}` : ''}`}
                          </TableCell>
                          <TableCell dir="auto">{referenceName(record, language)}</TableCell>
                          {['positions', 'employment-grades'].includes(kind) && (
                            <TableCell>{ownerName(record)}</TableCell>
                          )}
                          <TableCell>
                            <Button
                              variant="outline"
                              onClick={(event) => open(record, event.currentTarget)}
                              aria-label={`${t('Edit')} ${referenceName(record, language)}`}
                            >
                              {t('Edit')}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
      <Dialog
        open={editing !== undefined}
        onOpenChange={(open) => {
          if (!open) setEditing(undefined);
        }}
      >
        <DialogContent
          showCloseButton={false}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            opener.current?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>{t(editing ? 'Edit record' : 'Create record')}</DialogTitle>
            <DialogDescription>{t(kind)}</DialogDescription>
          </DialogHeader>
          {editing !== undefined && (
            <ReferenceForm
              kind={kind}
              record={editing}
              onCancel={() => setEditing(undefined)}
              onSaved={() => {
                setEditing(undefined);
                setDone(true);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
function ReferenceForm({
  kind,
  record,
  onCancel,
  onSaved,
}: {
  kind: Kind;
  record: Reference | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const categories = useReferences('staff-categories');
  const schemes = useReferences('grade-schemes');
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      referenceFields[kind].map((key) => [key, String(record?.[key as keyof Reference] ?? '')]),
    ),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = useMutation({
    mutationFn: () =>
      hrApi(
        record ? `${kind}/${referenceId(kind, record)}` : kind,
        record ? 'PATCH' : 'POST',
        referencePayload(kind, values),
      ),
    onError: (error) => setErrors(serverFieldErrors(error, referenceFields[kind])),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ['hr', 'references'] }),
        client.invalidateQueries({ queryKey: ['hr', 'employees'] }),
        client.invalidateQueries({ queryKey: ['hr', 'employee'] }),
      ]);
      onSaved();
    },
  });
  const set = (name: string) => (value: string) => {
    setValues((v) => ({ ...v, [name]: value }));
    setErrors((v) => ({ ...v, [name]: '' }));
    save.reset();
  };
  const dependentError =
    kind === 'positions' ? categories.error : kind === 'employment-grades' ? schemes.error : null;
  const dependentPending =
    kind === 'positions'
      ? categories.isPending
      : kind === 'employment-grades'
        ? schemes.isPending
        : false;
  return (
    <form
      className="hr-stack"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const nextErrors = validateValues(values, referenceRequired[kind]);
        for (const key of ['rankOrder', 'gradeNumber', 'stepNumber'])
          if (
            values[key] &&
            (!Number.isInteger(Number(values[key])) ||
              Number(values[key]) < 1 ||
              Number(values[key]) > (key === 'rankOrder' ? 5 : 32767))
          )
            nextErrors[key] = 'Enter a valid number.';
        setErrors(nextErrors);
        if (!Object.keys(nextErrors).length) save.mutate();
      }}
    >
      {dependentPending && <Loading />}
      <ErrorMessage error={dependentError} />
      <fieldset
        className="hr-form-grid"
        disabled={save.isPending || dependentPending || !!dependentError}
      >
        {referenceFields[kind].map((name) =>
          name === 'categoryId' || name === 'schemeId' ? (
            <ReferenceSelect
              key={name}
              name={name}
              kind={name === 'categoryId' ? 'staff-categories' : 'grade-schemes'}
              rows={name === 'categoryId' ? categories.data : schemes.data}
              value={values[name]}
              onChange={set(name)}
              required
              error={errors[name]}
            />
          ) : name === 'isAcademic' ? (
            <div className="hr-check" key={name}>
              <Checkbox
                id="isAcademic"
                checked={values[name] === '1'}
                onCheckedChange={(checked) => set(name)(checked ? '1' : '0')}
              />
              <Label htmlFor="isAcademic">{t(name)}</Label>
            </div>
          ) : (
            <Field
              key={name}
              name={name}
              value={values[name]}
              onChange={set(name)}
              required={referenceRequired[kind].includes(name)}
              error={errors[name]}
              textarea={name === 'description'}
              type={['rankOrder', 'gradeNumber', 'stepNumber'].includes(name) ? 'number' : 'text'}
              min={1}
              max={name === 'rankOrder' ? 5 : 32767}
            />
          ),
        )}
      </fieldset>
      <ErrorMessage error={save.error} />
      <div className="hr-actions">
        <Button disabled={save.isPending || dependentPending || !!dependentError}>
          {t(save.isPending ? 'Saving…' : 'Save')}
        </Button>
        <Button type="button" variant="outline" disabled={save.isPending} onClick={onCancel}>
          {t('Cancel')}
        </Button>
      </div>
    </form>
  );
}
