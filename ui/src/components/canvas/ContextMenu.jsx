export default function ContextMenu({ visible, x, y, onAction }) {
  if (!visible) return null;

  return (
    <div
      id="context-menu"
      className="context-menu active"
      style={{ left: `${x}px`, top: `${y}px` }}
    >
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
    </div>
  );
}
