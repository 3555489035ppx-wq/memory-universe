import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MusicArtwork } from './MusicArtwork';

describe('MusicArtwork', () => {
  it('retries the original remote artwork after the local proxy fails', () => {
    const original = 'https://music.test/cover.jpg';
    const proxied = `http://127.0.0.1:3000/api/cover?url=${encodeURIComponent(original)}`;
    const { container } = render(
      <MusicArtwork src={proxied} label="封面" className="art" fallbackClassName="fallback" />,
    );
    const proxiedImage = container.querySelector('img');
    expect(proxiedImage).toHaveAttribute('src', proxied);
    if (!proxiedImage) return;

    fireEvent.error(proxiedImage);
    expect(container.querySelector('img')).toHaveAttribute('src', original);
  });

  it('renders a stable fallback after every candidate fails', () => {
    const { container } = render(
      <MusicArtwork src="https://music.test/missing.jpg" label="封面" className="art" fallbackClassName="fallback" fallbackText="NE" />,
    );
    const image = container.querySelector('img');
    if (!image) return;

    fireEvent.error(image);
    expect(container.querySelector('.fallback')).toHaveTextContent('NE');
  });
});
