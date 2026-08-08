import { useEffect, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

import { useSceneStore } from '../../stores/sceneStore';

export function SceneNavigationBridge(): ReactNode {
  const navigate = useNavigate();
  const request = useSceneStore((state) => state.navigationRequest);
  const clearRequest = useSceneStore((state) => state.clearNavigationRequest);

  useEffect(() => {
    if (!request) return;
    void navigate(request.path, { replace: request.replace });
    clearRequest(request.id);
  }, [clearRequest, navigate, request]);

  return null;
}
