export function detectWebGLSupport(): boolean {
  if (typeof document === 'undefined') return true;
  try {
    const canvas = document.createElement('canvas');
    // Do not reject a browser just because its GPU driver reports a
    // performance caveat. The scene already has a quality governor and a
    // static photo fallback; failIfMajorPerformanceCaveat made otherwise
    // usable browsers take the empty WebGL fallback path.
    const context = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    return context !== null;
  } catch {
    return false;
  }
}
