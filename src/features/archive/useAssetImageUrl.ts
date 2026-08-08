import { useEffect, useState } from 'react';

import { getAsset } from '../../data/repositories/memoryRepository';

interface LoadedUrl {
  key: string;
  url: string;
}

export function useAssetImageUrl(assetKey: string): string {
  const [loaded, setLoaded] = useState<LoadedUrl>({ key: '', url: '' });

  useEffect(() => {
    if (!assetKey || assetKey.startsWith('/') || /^https?:\/\//u.test(assetKey)) return;
    let active = true;
    let objectUrl = '';
    void getAsset(assetKey)
      .then((asset) => {
        if (!asset || !active) return;
        objectUrl = URL.createObjectURL(asset.blob);
        setLoaded({ key: assetKey, url: objectUrl });
      })
      .catch(() => undefined);
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [assetKey]);

  if (assetKey.startsWith('/') || /^https?:\/\//u.test(assetKey)) return assetKey;
  return loaded.key === assetKey ? loaded.url : '';
}
