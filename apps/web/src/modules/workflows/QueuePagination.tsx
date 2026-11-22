import { useSearchParams } from 'react-router';

export function QueuePagination({
  nextCursor,
  firstLabel = 'First page',
  nextLabel = 'Next page',
}: {
  nextCursor: string | null;
  firstLabel?: string;
  nextLabel?: string;
}) {
  const [params, setParams] = useSearchParams();
  const hasCursor = params.has('cursor');
  if (!hasCursor && !nextCursor) return null;

  const go = (cursor: string | null) => {
    const next = new URLSearchParams(params);
    if (cursor) next.set('cursor', cursor);
    else next.delete('cursor');
    setParams(next);
  };

  return (
    <div className="module-navigation">
      {hasCursor && (
        <button data-slot="button" data-variant="outline" type="button" onClick={() => go(null)}>
          {firstLabel}
        </button>
      )}
      {nextCursor && (
        <button
          data-slot="button"
          data-variant="outline"
          type="button"
          onClick={() => go(nextCursor)}
        >
          {nextLabel}
        </button>
      )}
    </div>
  );
}
