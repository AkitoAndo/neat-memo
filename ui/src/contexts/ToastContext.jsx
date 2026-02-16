import { createContext, useReducer, useCallback } from 'react';

export const ToastContext = createContext(null);

let toastId = 0;

function toastReducer(state, action) {
  switch (action.type) {
    case 'ADD':
      return [...state, action.toast];
    case 'REMOVE':
      return state.filter(t => t.id !== action.id);
    default:
      return state;
  }
}

export function ToastProvider({ children }) {
  const [toasts, dispatch] = useReducer(toastReducer, []);

  const addToast = useCallback(({ title, message, type = 'info', duration = 5000, actions = [] }) => {
    const id = ++toastId;
    dispatch({ type: 'ADD', toast: { id, title, message, type, duration, actions } });
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    dispatch({ type: 'REMOVE', id });
  }, []);

  const success = useCallback((title, message) => {
    return addToast({ title, message, type: 'success', duration: 3000 });
  }, [addToast]);

  const error = useCallback((title, message, errorDetails = null) => {
    const actions = [];
    if (errorDetails) {
      actions.push({
        label: 'エラー詳細をダウンロード',
        primary: false,
        closeOnClick: false,
        onClick: () => {
          const content = JSON.stringify(errorDetails, null, 2);
          const blob = new Blob([content], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `error-details-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        },
      });
    }
    actions.push({
      label: '閉じる',
      primary: true,
      onClick: () => {},
    });
    return addToast({ title, message, type: 'error', duration: 0, actions });
  }, [addToast]);

  const info = useCallback((title, message) => {
    return addToast({ title, message, type: 'info', duration: 4000 });
  }, [addToast]);

  const value = {
    toasts,
    addToast,
    removeToast,
    success,
    error,
    info,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
    </ToastContext.Provider>
  );
}
