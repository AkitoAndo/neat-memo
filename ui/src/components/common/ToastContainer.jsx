import { useToast } from '../../hooks/useToast.js';
import Toast from './Toast.jsx';

export default function ToastContainer() {
  const { toasts, removeToast } = useToast();

  return (
    <div id="toast-container">
      {toasts.map(toast => (
        <Toast key={toast.id} toast={toast} onRemove={removeToast} />
      ))}
    </div>
  );
}
