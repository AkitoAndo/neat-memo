import { useRef, useEffect } from 'react';

export function useResize(containerRef, onResizeEnd, scale = 1) {
  const resizeStateRef = useRef(null);
  const scaleRef = useRef(scale);

  // Keep scale ref updated
  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function handleMouseDown(e) {
      if (!e.target.classList.contains('item-resize-handle')) return;

      const itemEl = e.target.closest('.canvas-item');
      if (!itemEl) return;

      e.preventDefault();
      itemEl.classList.add('resizing');

      resizeStateRef.current = {
        itemId: itemEl.dataset.id,
        itemEl: itemEl,
        startX: e.clientX,
        startY: e.clientY,
        origWidth: parseInt(itemEl.style.width),
        origHeight: parseInt(itemEl.style.height),
      };
    }

    function handleMouseMove(e) {
      if (!resizeStateRef.current) return;
      const { startX, startY, origWidth, origHeight, itemEl } = resizeStateRef.current;
      const dx = (e.clientX - startX) / scaleRef.current;
      const dy = (e.clientY - startY) / scaleRef.current;
      const newWidth = Math.max(100, origWidth + dx);
      const newHeight = Math.max(60, origHeight + dy);
      itemEl.style.width = `${newWidth}px`;
      itemEl.style.height = `${newHeight}px`;
    }

    function handleMouseUp() {
      if (!resizeStateRef.current) return;
      const { itemId, itemEl } = resizeStateRef.current;
      itemEl.classList.remove('resizing');
      const newWidth = parseInt(itemEl.style.width);
      const newHeight = parseInt(itemEl.style.height);
      onResizeEnd(itemId, newWidth, newHeight);
      resizeStateRef.current = null;
    }

    container.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      container.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [containerRef, onResizeEnd]);
}
