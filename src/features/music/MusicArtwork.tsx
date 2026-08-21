import { useMemo, useState, type ReactNode } from 'react';

interface MusicArtworkProps {
  src: string | undefined;
  label: string;
  className: string;
  fallbackClassName?: string;
  fallbackText?: string;
  priority?: boolean;
}

function artworkCandidates(src?: string): string[] {
  if (!src) return [];
  const candidates = [src];
  try {
    const parsed = new URL(src, window.location.href);
    if (parsed.pathname.endsWith('/api/cover')) {
      const original = parsed.searchParams.get('url');
      if (original && original !== src) candidates.push(original);
    }
  } catch {
    // A malformed remote artwork URL is handled by the visible fallback.
  }
  return [...new Set(candidates)];
}

/** Uses the local cover proxy first, then the original artwork before falling back. */
export function MusicArtwork({
  src,
  label,
  className,
  fallbackClassName = className,
  fallbackText,
  priority = true,
}: MusicArtworkProps): ReactNode {
  const candidates = useMemo(() => artworkCandidates(src), [src]);
  const [failure, setFailure] = useState<{ src: string | undefined; candidateIndex: number }>({
    src,
    candidateIndex: 0,
  });
  const candidateIndex = failure.src === src ? failure.candidateIndex : 0;

  const activeSrc = candidates[candidateIndex];
  if (!activeSrc) {
    return (
      <span className={fallbackClassName} title={label} aria-hidden="true">
        {fallbackText}
      </span>
    );
  }

  return (
    <img
      key={activeSrc}
      className={className}
      src={activeSrc}
      alt=""
      title={label}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={priority ? 'high' : 'auto'}
      onError={() => setFailure({ src, candidateIndex: candidateIndex + 1 })}
    />
  );
}
