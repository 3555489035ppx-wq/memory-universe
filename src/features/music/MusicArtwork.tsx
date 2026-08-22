import { useState, type ReactNode } from 'react';

interface MusicArtworkProps {
  src: string | undefined;
  label: string;
  className: string;
  fallbackClassName?: string;
  priority?: boolean;
}

/** Uses bundled artwork when provided and keeps a branded starfield fallback deterministic. */
export function MusicArtwork({
  src,
  label,
  className,
  fallbackClassName = className,
  priority = true,
}: MusicArtworkProps): ReactNode {
  const [failedSrc, setFailedSrc] = useState<string | undefined>(undefined);
  if (!src || failedSrc === src) {
    return (
      <span className={`${fallbackClassName} music-artwork--starfield`} title={label} aria-hidden="true" />
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
