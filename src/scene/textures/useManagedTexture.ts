import { useEffect, useState } from 'react';
import type { Texture } from 'three';

import {
  localTextureManager,
  type TextureVariant,
} from './LocalTextureManager';

export function useManagedTexture(
  assetKey: string,
  variant: TextureVariant | null,
  priority: number,
): Texture | null {
  const requestKey = variant ? `${variant}::${assetKey}` : '';
  const [loaded, setLoaded] = useState<{ key: string; texture: Texture | null }>({
    key: '',
    texture: null,
  });

  useEffect(() => {
    if (!variant || !assetKey) return;
    let active = true;
    void localTextureManager
      .acquire(assetKey, variant, priority)
      .then((loaded) => {
        if (active) setLoaded({ key: requestKey, texture: loaded });
      })
      .catch(() => {
        if (active) setLoaded({ key: requestKey, texture: null });
      });
    return () => {
      active = false;
      localTextureManager.release(assetKey, variant);
    };
  }, [assetKey, priority, requestKey, variant]);

  return loaded.key === requestKey ? loaded.texture : null;
}
