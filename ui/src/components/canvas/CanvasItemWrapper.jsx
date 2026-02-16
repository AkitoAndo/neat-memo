export default function CanvasItemWrapper({ item, onDelete, children }) {
  function handleDelete(e) {
    e.stopPropagation();
    if (confirm('このメモを削除しますか？')) {
      onDelete(item.id);
    }
  }

  return (
    <div
      className={`canvas-item${item.type === 'image' ? ' image-item' : ''}${item.type === 'pen' ? ' pen-item' : ''}`}
      data-id={item.id}
      style={{
        left: `${item.x}px`,
        top: `${item.y}px`,
        width: `${item.width}px`,
        height: `${item.height}px`,
        zIndex: item.zIndex,
      }}
    >
      <div className="item-header">
        <button className="item-delete-btn" title="削除" onClick={handleDelete}>
          &times;
        </button>
      </div>
      {children}
      <div className="item-resize-handle" />
    </div>
  );
}
