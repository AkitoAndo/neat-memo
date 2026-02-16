import { useRef, useEffect } from 'react';

export function useDrag(containerRef, onDragEnd, scale = 1) {
  const dragStateRef = useRef(null);
  const scaleRef = useRef(scale);

  // Keep scale ref updated
  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function handleMouseDown(e) {
      const header = e.target.closest('.item-header');
      if (!header) return;
      // Don't start drag if clicking delete button
      if (e.target.closest('.item-delete-btn')) return;

      const itemEl = header.closest('.canvas-item');
      if (!itemEl) return;

      e.preventDefault();
      itemEl.classList.add('dragging');

      dragStateRef.current = {
        itemId: itemEl.dataset.id,
        itemEl: itemEl,
        startX: e.clientX,
        startY: e.clientY,
        origX: parseInt(itemEl.style.left),
        origY: parseInt(itemEl.style.top),
      };
    }

    function handleMouseMove(e) {
      if (!dragStateRef.current) return;
      const { startX, startY, origX, origY, itemEl } = dragStateRef.current;
      const dx = (e.clientX - startX) / scaleRef.current;
      const dy = (e.clientY - startY) / scaleRef.current;
      itemEl.style.left = `${origX + dx}px`;
      itemEl.style.top = `${origY + dy}px`;
    }

    function handleMouseUp() {
      if (!dragStateRef.current) return;
      const { itemId, itemEl } = dragStateRef.current;
      itemEl.classList.remove('dragging');
      const newX = parseInt(itemEl.style.left);
      const newY = parseInt(itemEl.style.top);
      onDragEnd(itemId, newX, newY);
      dragStateRef.current = null;
    }

    container.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      container.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [containerRef, onDragEnd]);
}
