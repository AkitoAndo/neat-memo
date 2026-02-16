export default function DropOverlay({ active }) {
  return (
    <div id="drop-overlay" className={active ? 'active' : ''}>
      <div className="drop-overlay-content">
        <span className="drop-icon">📷</span>
        <span>画像をドロップして配置</span>
      </div>
    </div>
  );
}
