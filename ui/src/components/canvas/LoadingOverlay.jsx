export default function LoadingOverlay({ active }) {
  return (
    <div id="loading-overlay" className={active ? 'active' : ''}>
      <div className="loading-content">
        <div className="spinner"></div>
        <span>OCR処理中...</span>
      </div>
    </div>
  );
}
