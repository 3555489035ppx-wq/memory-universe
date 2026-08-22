import { useState, type ReactNode } from 'react';

interface MusicArtworkProps {
  src: string | undefined;
  label: string;
  className: string;
  fallbackClassName?: string;
  fallbackText?: string;
  priority?: boolean;
}

/** Uses bundled artwork when provided and keeps the fallback deterministic. */
export function MusicArtwork({
  src,
  label,
  className,
  fallbackClassName = className,
  fallbackText,
  priority = true,
}: MusicArtworkProps): ReactNode {
  const [failedSrc, setFailedSrc] = useState<string | undefined>(undefined);
  if (!src || failedSrc === src) {
    return (
      <span className={fallbackClassName} title={label} aria-hidden="true">
        {fallbackText}
      </span>
    );
  }

  return (
    <img
      className={className}
      src={src}
      alt=""
      title={label}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={priority ? 'high' : 'auto'}
      onError={() => setFailedSrc(src)}
    />
  );
}
