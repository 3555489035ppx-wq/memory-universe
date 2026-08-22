import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MusicArtwork } from './MusicArtwork';

describe('MusicArtwork', () => {
  it('falls back immediately when a bundled artwork file fails', () => {
    const { container } = render(
      <MusicArtwork src="/music/high-school/cover.jpg" label="封面" className="art" fallbackClassName="fallback" fallbackText="MU" />,
    );
    const image = container.querySelector('img');
    expect(image).toHaveAttribute('src', '/music/high-school/cover.jpg');
    if (!image) return;

    fireEvent.error(image);
    expect(container.querySelector('.fallback')).toHaveTextContent('MU');
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
