/** Flower mark in a peach circle, with the name in the display serif. */
export function Logo({ withName = true }: { withName?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <svg width="36" height="36" viewBox="0 0 36 36" aria-hidden>
        <circle cx="18" cy="18" r="18" fill="#f0a48a" />
        {[0, 72, 144, 216, 288].map((a) => (
          <ellipse key={a} cx="18" cy="11.5" rx="4.2" ry="5.2" fill="#fffbf7" transform={`rotate(${a} 18 18)`} />
        ))}
        <circle cx="18" cy="18" r="3.4" fill="#f3d27a" />
      </svg>
      {withName && <span className="font-display text-xl font-semibold tracking-tight">Move &amp; Nourish</span>}
    </span>
  );
}
