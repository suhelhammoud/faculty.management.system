import type { DesignDocument } from '@project/contracts/workflow';
export const ends = ['completed', 'rejected', 'cancelled'] as const;
export function Canvas({
  doc,
  selected,
  select,
  move,
}: {
  doc: DesignDocument;
  selected: string;
  select: (id: string) => void;
  move?: (id: string, x: number, y: number) => void;
}) {
  const right = Math.max(350, ...doc.steps.map((s) => s.x + 280));
  const height = Math.max(330, ...doc.steps.map((s) => s.y + 130));
  return (
    <div className="design-scroll">
      <div
        className="design-canvas"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => e.preventDefault()}
        style={{ width: right + 190, height }}
      >
        <svg width="100%" height="100%" aria-hidden="true">
          <defs>
            <marker
              id="design-arrow"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
            </marker>
          </defs>
          {doc.steps.flatMap((s) =>
            s.actions.map((a, i) => {
              const t = a.target;
              const dest =
                'next' in t
                  ? doc.steps.find((d) => d.id === t.next)
                  : { x: right, y: 30 + ends.indexOf(t.finish) * 95 };
              if (!dest) return null;
              const x = s.x + 150,
                y = s.y + 25,
                ex = dest.x,
                ey = dest.y + 25;
              const bend = 40 + i * 12;
              return (
                <g key={s.id + i}>
                  <path
                    d={`M ${x} ${y} C ${x + bend} ${y + bend} ${ex - bend} ${ey + bend} ${ex} ${ey}`}
                    fill="none"
                    stroke="currentColor"
                    markerEnd="url(#design-arrow)"
                  />
                  <text x={(x + ex) / 2} y={(y + ey) / 2 + bend * 0.75} textAnchor="middle">
                    {a.key}
                  </text>
                </g>
              );
            }),
          )}
        </svg>
        {ends.map((v, i) => (
          <span className="design-end" key={v} style={{ left: right, top: 30 + i * 95 }}>
            {v}
          </span>
        ))}
        {doc.steps.map((s) => (
          <button
            key={s.id}
            aria-pressed={s.id === selected}
            style={{ left: s.x, top: s.y }}
            draggable={!!move}
            onDragStart={(e) => {
              e.dataTransfer.setData('text/plain', s.id);
              e.currentTarget.dataset.start = JSON.stringify([e.clientX, e.clientY]);
            }}
            onDragEnd={(e) => {
              const start = e.currentTarget.dataset.start;
              if (start && e.dataTransfer.dropEffect !== 'none') {
                const [x, y] = JSON.parse(start);
                move?.(
                  s.id,
                  Math.min(20000, Math.max(0, s.x + e.clientX - x)),
                  Math.min(20000, Math.max(0, s.y + e.clientY - y)),
                );
              }
            }}
            onClick={() => select(s.id)}
          >
            {s.id === doc.initialStep && <small>Initial step</small>}
            {s.title || s.key}
          </button>
        ))}
      </div>
    </div>
  );
}
