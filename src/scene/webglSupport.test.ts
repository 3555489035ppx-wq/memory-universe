import { afterEach, describe, expect, it, vi } from 'vitest';

import { detectWebGLSupport } from './webglSupport';

describe('detectWebGLSupport', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('accepts a usable WebGL2 context without rejecting performance caveats', () => {
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockImplementation((contextId: string) => {
        if (contextId === 'webgl2') return {} as WebGL2RenderingContext;
        return null;
      });

    expect(detectWebGLSupport()).toBe(true);
    expect(getContext).toHaveBeenCalledWith('webgl2');
  });

  it('falls back cleanly when the browser cannot create a WebGL context', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);

    expect(detectWebGLSupport()).toBe(false);
  });
});
