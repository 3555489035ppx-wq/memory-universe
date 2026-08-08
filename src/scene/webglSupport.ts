export function detectWebGLSupport(): boolean {
  if (typeof document === 'undefined') return true;
  try {
    const canvas = document.createElement('canvas');
    const context =
      canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: true }) ??
      canvas.getContext('webgl', { failIfMajorPerformanceCaveat: true });
    return context !== null;
  } catch {
    return false;
  }
}
