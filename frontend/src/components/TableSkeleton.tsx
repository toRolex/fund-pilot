interface Props {
  rows?: number;
}

// ponytail: 6-column skeleton matching Dashboard/Watchlists table layout
export function TableSkeleton({ rows = 5 }: Props) {
  return (
    <>
      <div className="skel skel-title-bar" style={{ width: "100%", height: 22, marginBottom: 12 }} />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skel-row flex gap-3 py-2 border-b border-[var(--border)]">
          <div className="skel flex-[2]" />
          <div className="skel flex-1" />
          <div className="skel flex-1" />
          <div className="skel flex-[1.5]" />
          <div className="skel flex-1" />
          <div className="skel" style={{ width: 80 }} />
        </div>
      ))}
    </>
  );
}
