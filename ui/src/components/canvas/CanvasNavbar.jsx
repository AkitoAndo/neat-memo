export default function CanvasNavbar({ projectName, onBack }) {
  return (
    <div id="canvas-navbar">
      <button className="nav-btn" onClick={onBack}>← 戻る</button>
      <span id="current-project-name">{projectName}</span>
    </div>
  );
}
