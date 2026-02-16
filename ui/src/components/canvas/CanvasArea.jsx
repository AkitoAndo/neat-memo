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
  camera,
  onUpdateCamera,
  screenToCanvas,
}) {
  const viewportRef = useRef(null);
  const contentRef = useRef(null);

  const handleDragEnd = useCallback((itemId, x, y) => {
    onDragEnd(itemId, x, y);
  }, [onDragEnd]);

  const handleResizeEnd = useCallback((itemId, w, h) => {
    onResizeEnd(itemId, w, h);
  }, [onResizeEnd]);

  useDrag(contentRef, handleDragEnd, camera.scale);
  useResize(contentRef, handleResizeEnd, camera.scale);

  // Zoom logic
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const delta = -e.deltaY;
    const factor = Math.pow(1.1, delta / 100);
    
    const newScale = Math.min(Math.max(camera.scale * factor, 0.1), 5);
    
    const rect = viewportRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const newX = mouseX - (mouseX - camera.x) * (newScale / camera.scale);
    const newY = mouseY - (mouseY - camera.y) * (newScale / camera.scale);
    
    onUpdateCamera({ x: newX, y: newY, scale: newScale });
  }, [camera, onUpdateCamera]);

  // Pan logic
  const handleMouseDown = useCallback((e) => {
    if (e.target !== contentRef.current) return;
    
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const startCamX = camera.x;
    const startCamY = camera.y;
    
    const onMouseMove = (ev) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        onUpdateCamera({ x: startCamX + dx, y: startCamY + dy });
    };
    
    const onMouseUp = () => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
    };
    
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, [camera, onUpdateCamera]);

  function handleDblClick(e) {
    if (e.target !== contentRef.current) return;
    const { x, y } = screenToCanvas(e.clientX, e.clientY, viewportRef.current);
    onDoubleClick(x, y);
  }

  function handleContextMenu(e) {
    e.preventDefault();
    const itemEl = e.target.closest('.canvas-item');
    const itemId = itemEl?.dataset.id;
    onContextMenu(e.clientX, e.clientY, itemId);
  }

  const itemsArray = Array.from(items.values());

  return (
    <div
      id="canvas-area"
      ref={viewportRef}
      onWheel={handleWheel}
      onDoubleClick={handleDblClick}
      onContextMenu={handleContextMenu}
      onMouseDown={handleMouseDown}
      style={{ overflow: 'hidden', position: 'relative' }}
    >
      <div
        id="canvas-content"
        ref={contentRef}
        style={{
          transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.scale})`,
          transformOrigin: '0 0',
          width: '100%',
          height: '100%',
          position: 'absolute',
          top: 0,
          left: 0,
        }}
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
    </div>
  );
}
