import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MusicArtwork } from './MusicArtwork';

describe('MusicArtwork', () => {
  it('falls back immediately when a bundled artwork file fails', () => {
    const { container } = render(
      <MusicArtwork src="/music/high-school/cover.jpg" label="封面" className="art" fallbackClassName="fallback" />,
    );
    const image = container.querySelector('img');
    expect(image).toHaveAttribute('src', '/music/high-school/cover.jpg');
    if (!image) return;

    fireEvent.error(image);
    expect(container.querySelector('.fallback')).toHaveClass('music-artwork--starfield');
    expect(container.querySelector('.fallback')).toBeEmptyDOMElement();
  });

  it('renders a stable fallback after every candidate fails', () => {
    const { container } = render(
      <MusicArtwork src="https://music.test/missing.jpg" label="封面" className="art" fallbackClassName="fallback" />,
    );
    const image = container.querySelector('img');
    if (!image) return;

    fireEvent.error(image);
    expect(container.querySelector('.fallback')).toHaveClass('music-artwork--starfield');
  });

  it('uses the same starfield for a missing upload cover', () => {
    const { container } = render(<MusicArtwork src={undefined} label="我的上传" className="art" fallbackClassName="fallback" />);

    expect(container.querySelector('.music-artwork--starfield')).toBeInTheDocument();
  });
});
