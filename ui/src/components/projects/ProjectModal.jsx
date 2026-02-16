import { useState, useEffect, useRef } from 'react';

export default function ProjectModal({ active, mode, project, onConfirm, onCancel }) {
  const [name, setName] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (active) {
      setName(project ? project.name : '');
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [active, project]);

  function handleConfirm() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleConfirm();
    if (e.key === 'Escape') onCancel();
  }

  if (!active) return null;

  return (
    <div id="project-modal" className="modal active" onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal-content">
        <h2 id="modal-title">{mode === 'create' ? '新規プロジェクト' : 'プロジェクト名を変更'}</h2>
        <input
          ref={inputRef}
          type="text"
          id="project-name-input"
          placeholder="プロジェクト名を入力"
          autoComplete="off"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <div className="modal-actions">
          <button className="modal-btn" onClick={onCancel}>キャンセル</button>
          <button className="modal-btn primary" onClick={handleConfirm}>
            {mode === 'create' ? '作成' : '変更'}
          </button>
        </div>
      </div>
    </div>
  );
}
