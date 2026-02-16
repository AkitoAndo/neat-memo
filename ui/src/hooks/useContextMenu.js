import { useState, useCallback, useEffect } from 'react';

export function useContextMenu() {
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0 });

  const show = useCallback((x, y) => {
    setContextMenu({ visible: true, x, y });
  }, []);

  const hide = useCallback(() => {
    setContextMenu(prev => prev.visible ? { visible: false, x: 0, y: 0 } : prev);
  }, []);

  useEffect(() => {
    function handleClick(e) {
      // Hide unless clicking inside the context menu itself
      if (!e.target.closest('.context-menu')) {
        hide();
      }
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape') hide();
    }
    document.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [hide]);

  return { contextMenu, show, hide };
}
