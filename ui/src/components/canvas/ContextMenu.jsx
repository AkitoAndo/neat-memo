export default function ContextMenu({ visible, x, y, targetItemId, onAction }) {
  if (!visible) return null;

  return (
    <div
      id="context-menu"
      className="context-menu active"
      style={{ left: `${x}px`, top: `${y}px` }}
    >
      {!targetItemId ? (
        <>
          <button className="context-menu-item" data-action="add-text" onClick={() => onAction('add-text', x, y)}>
            テキストを追加
          </button>
          <button className="context-menu-item" data-action="add-ocr" onClick={() => onAction('add-ocr', x, y)}>
            OCRで画像からテキスト抽出
          </button>
          <button className="context-menu-item" data-action="add-image" onClick={() => onAction('add-image', x, y)}>
            画像を追加
          </button>
          <button className="context-menu-item" data-action="add-pen" onClick={() => onAction('add-pen', x, y)}>
            ペンで描画
          </button>
        </>
      ) : (
        <>
          <button className="context-menu-item" data-action="bring-to-front" onClick={() => onAction('bring-to-front', x, y, targetItemId)}>
            最前面に移動
          </button>
          <button className="context-menu-item" data-action="send-to-back" onClick={() => onAction('send-to-back', x, y, targetItemId)}>
            最背面に移動
          </button>
          <hr />
          <button className="context-menu-item delete" data-action="delete" onClick={() => onAction('delete', x, y, targetItemId)}>
            削除
          </button>
        </>
      )}
    </div>
  );
}
