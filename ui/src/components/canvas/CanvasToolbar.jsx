export default function CanvasToolbar({ onOcr, onImage, onPen, onSave }) {
  return (
    <div id="toolbar">
      <button className="tool-btn active" id="btn-text" title="ダブルクリックで配置">テキスト</button>
      <button className="tool-btn" id="btn-ocr" title="画像からテキスト抽出" onClick={onOcr}>OCR</button>
      <button className="tool-btn" id="btn-image" title="画像をそのまま配置" onClick={onImage}>画像</button>
      <button className="tool-btn" id="btn-pen" title="ペンで描画" onClick={onPen}>ペン</button>
      <button className="tool-btn" id="btn-save" onClick={onSave}>保存</button>
    </div>
  );
}
