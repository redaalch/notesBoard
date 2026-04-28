interface NoteSkeletonProps {
  count?: number;
}

function NoteSkeleton({ count = 6 }: NoteSkeletonProps) {
  return (
    <div className="ds-notes-grid">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="ds-note ds-skel-card">
          <div className="ds-skel ds-skel-line w80" />
          <div className="ds-skel ds-skel-line w100" />
          <div className="ds-skel ds-skel-line w60" />
          <div className="ds-skel ds-skel-line w40" />
        </div>
      ))}
    </div>
  );
}

export default NoteSkeleton;
