import { useRef, useCallback } from 'react';
import { useDrag } from '../../hooks/useDrag.js';
import { useResize } from '../../hooks/useResize.js';
import CanvasItemWrapper from './CanvasItemWrapper.jsx';
import TextItemComponent from './TextItemComponent.jsx';
import ImageItemComponent from './ImageItemComponent.jsx';
import PenItemComponent from './PenItemComponent.jsx';

export default function CanvasArea({
  items,
  onDeleteItem,
  onDragEnd,
  onResizeEnd,
  onDoubleClick,
  onContextMenu,
  onContentChange,
}) {
  const containerRef = useRef(null);

  const handleDragEnd = useCallback((itemId, x, y) => {
    onDragEnd(itemId, x, y);
  }, [onDragEnd]);

  const handleResizeEnd = useCallback((itemId, w, h) => {
    onResizeEnd(itemId, w, h);
  }, [onResizeEnd]);

  useDrag(containerRef, handleDragEnd);
  useResize(containerRef, handleResizeEnd);

  function handleDblClick(e) {
    if (e.target !== containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    onDoubleClick(x, y);
  }

  function handleContextMenu(e) {
    const isOnItem = e.target.closest('.canvas-item');
    if (!isOnItem) {
      e.preventDefault();
      onContextMenu(e.clientX, e.clientY);
    }
  }

  const itemsArray = Array.from(items.values());

  return (
    <div
      id="canvas-area"
      ref={containerRef}
      onDoubleClick={handleDblClick}
      onContextMenu={handleContextMenu}
    >
      {itemsArray.map(item => (
        <CanvasItemWrapper key={item.id} item={item} onDelete={onDeleteItem}>
          {item.type === 'text' && (
            <TextItemComponent item={item} onContentChange={onContentChange} />
          )}
          {item.type === 'image' && (
            <ImageItemComponent item={item} />
          )}
          {item.type === 'pen' && (
            <PenItemComponent item={item} onPathAdded={onContentChange} />
          )}
        </CanvasItemWrapper>
      ))}
    </div>
  );
}
