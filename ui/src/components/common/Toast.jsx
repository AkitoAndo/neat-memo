import { useEffect, useState } from 'react';

export default function Toast({ toast, onRemove }) {
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    if (toast.duration > 0 && toast.actions.length === 0) {
      const timer = setTimeout(() => {
        handleRemove();
      }, toast.duration);
      return () => clearTimeout(timer);
    }
  }, [toast.duration, toast.actions.length]);

  function handleRemove() {
    setRemoving(true);
    setTimeout(() => onRemove(toast.id), 300);
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  return (
    <div className={`toast ${toast.type}${removing ? ' removing' : ''}`}>
      <div className="toast-header">
        <span className="toast-title">{toast.title}</span>
        <button className="toast-close" onClick={handleRemove}>&times;</button>
      </div>
      <div className="toast-message">{toast.message}</div>
      {toast.actions.length > 0 && (
        <div className="toast-actions">
          {toast.actions.map((action, i) => (
            <button
              key={i}
              className={`toast-btn ${action.primary ? 'primary' : 'secondary'}`}
              onClick={() => {
                action.onClick();
                if (action.closeOnClick !== false) {
                  handleRemove();
                }
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
