import { useState, useCallback } from 'react';

export function useCamera() {
  const [camera, setCamera] = useState({ x: 0, y: 0, scale: 1 });

  const screenToCanvas = useCallback((clientX, clientY, container) => {
    if (!container) return { x: clientX, y: clientY };
    const rect = container.getBoundingClientRect();
    const x = (clientX - rect.left - camera.x) / camera.scale;
    const y = (clientY - rect.top - camera.y) / camera.scale;
    return { x, y };
  }, [camera]);

  const updateCamera = useCallback((updates) => {
    setCamera(prev => ({ ...prev, ...updates }));
  }, []);

  const resetCamera = useCallback(() => {
    setCamera({ x: 0, y: 0, scale: 1 });
  }, []);

  return {
    camera,
    screenToCanvas,
    updateCamera,
    resetCamera,
  };
}
