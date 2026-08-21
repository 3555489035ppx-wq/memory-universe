import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Cover } from './MusicLibraryPopover';

describe('MusicLibraryPopover cover', () => {
  it('starts visible music artwork immediately inside the transformed library panel', () => {
    const { container } = render(<Cover src="http://127.0.0.1:3000/api/cover?url=cover.jpg" label="Help me" provider="netease" />);

    expect(container.querySelector('img')).toHaveAttribute('loading', 'eager');
  });

  it('keeps a labelled fallback when artwork loading fails', () => {
    const { container } = render(<Cover src="https://invalid.test/cover.jpg" label="Help me" provider="netease" />);
    const image = container.querySelector('img');
    expect(image).not.toBeNull();
    if (!image) return;

    fireEvent.error(image);

    expect(container.querySelector('img')).not.toBeInTheDocument();
    expect(container.querySelector('[title="Help me"]')).toBeInTheDocument();
  });
});
