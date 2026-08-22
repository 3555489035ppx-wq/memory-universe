import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Cover } from './MusicLibraryPopover';

describe('MusicLibraryPopover cover', () => {
  it('starts visible music artwork immediately inside the transformed library panel', () => {
    const { container } = render(<Cover src="/music/high-school/cover.jpg" label="Help me" source="system" />);

    expect(container.querySelector('img')).toHaveAttribute('loading', 'eager');
  });

  it('keeps a labelled fallback when artwork loading fails', () => {
    const { container } = render(<Cover src="/music/high-school/missing.jpg" label="Help me" source="system" />);
    const image = container.querySelector('img');
    expect(image).not.toBeNull();
    if (!image) return;

    fireEvent.error(image);

    expect(container.querySelector('img')).not.toBeInTheDocument();
    expect(container.querySelector('[title="Help me"]')).toBeInTheDocument();
    expect(container.querySelector('.music-artwork--starfield')).toBeInTheDocument();
  });

  it('uses the starfield for uploaded tracks without a cover file', () => {
    const { container } = render(<Cover src={undefined} label="我的上传" source="upload" />);

    expect(container.querySelector('.music-library__cover--upload.music-artwork--starfield')).toBeInTheDocument();
  });
});
