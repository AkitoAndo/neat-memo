import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCanvas } from '../../hooks/useCanvas.js';
import { useCamera } from '../../hooks/useCamera.js';
import { useAutoSave } from '../../hooks/useAutoSave.js';
import { useContextMenu } from '../../hooks/useContextMenu.js';
import { useToast } from '../../hooks/useToast.js';
import { TextItem } from '../../models/TextItem.js';
import { ImageItem } from '../../models/ImageItem.js';
import { PenItem } from '../../models/PenItem.js';
import { OcrService, OcrError } from '../../services/ocr.js';
import { fileToDataUrl } from '../../utils/fileHelpers.js';
import CanvasNavbar from './CanvasNavbar.jsx';
import CanvasToolbar from './CanvasToolbar.jsx';
import CanvasArea from './CanvasArea.jsx';
import ContextMenu from './ContextMenu.jsx';
import DropOverlay from './DropOverlay.jsx';
import LoadingOverlay from './LoadingOverlay.jsx';

export default function CanvasView() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { items, projectMeta, loadProject, addItem, removeItem, updateItem, bringToFront, sendToBack, save, itemsRef } = useCanvas();
  const { camera, screenToCanvas, updateCamera, resetCamera } = useCamera();
  const { contextMenu, show: showContextMenu, hide: hideContextMenu } = useContextMenu();

  const [dropActive, setDropActive] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const ocrInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const dropPositionRef = useRef({ x: 100, y: 150 });
  const dragCounterRef = useRef(0);

  const triggerAutoSave = useAutoSave(() => {
    save(projectId);
  });

  useEffect(() => {
    if (projectId) {
      loadProject(projectId).then(() => {
        setLoaded(true);
        resetCamera();
      });
    }
  }, [projectId, loadProject, resetCamera]);

  const handleBack = useCallback(() => {
    save(projectId);
    navigate('/');
  }, [save, projectId, navigate]);

  const handleSave = useCallback(() => {
    save(projectId);
    toast.success('保存完了', 'キャンバスを保存しました');
  }, [save, projectId, toast]);

  const handleContentChange = useCallback(() => {
    triggerAutoSave();
  }, [triggerAutoSave]);

  const handleDeleteItem = useCallback((itemId) => {
    removeItem(itemId);
    save(projectId);
  }, [removeItem, save, projectId]);

  const handleDragEnd = useCallback((itemId, x, y) => {
    updateItem(itemId, { x, y });
    save(projectId);
  }, [updateItem, save, projectId]);

  const handleResizeEnd = useCallback((itemId, width, height) => {
    updateItem(itemId, { width, height });
    save(projectId);
  }, [updateItem, save, projectId]);

  const handleDoubleClick = useCallback((x, y) => {
    const newItem = new TextItem({ x, y, content: '' });
    addItem(newItem);
    triggerAutoSave();
    setTimeout(() => {
      const el = document.querySelector(`[data-id="${newItem.id}"] textarea`);
      if (el) el.focus();
    }, 0);
  }, [addItem, triggerAutoSave]);

  const handleContextMenuAction = useCallback((action, x, y, targetItemId) => {
    hideContextMenu();
    
    // Convert screen coordinates to canvas coordinates if it's an "add" action
    const canvasPos = (action.startsWith('add-')) 
      ? screenToCanvas(x, y, document.getElementById('canvas-area'))
      : { x, y };

    switch (action) {
      case 'add-text': {
        const newItem = new TextItem({ x: canvasPos.x, y: canvasPos.y, width: 200, height: 100, content: '' });
        addItem(newItem);
        triggerAutoSave();
        setTimeout(() => {
          const el = document.querySelector(`[data-id="${newItem.id}"] textarea`);
          if (el) el.focus();
        }, 0);
        break;
      }
      case 'add-ocr':
        dropPositionRef.current = { x: canvasPos.x, y: canvasPos.y };
        ocrInputRef.current?.click();
        break;
      case 'add-image':
        dropPositionRef.current = { x: canvasPos.x, y: canvasPos.y };
        imageInputRef.current?.click();
        break;
      case 'add-pen': {
        const penItem = new PenItem({ x: canvasPos.x, y: canvasPos.y, width: 300, height: 200 });
        addItem(penItem);
        triggerAutoSave();
        break;
      }
      case 'bring-to-front':
        bringToFront(targetItemId);
        triggerAutoSave();
        break;
      case 'send-to-back':
        sendToBack(targetItemId);
        triggerAutoSave();
        break;
      case 'delete':
        handleDeleteItem(targetItemId);
        break;
    }
  }, [addItem, triggerAutoSave, hideContextMenu, screenToCanvas, bringToFront, sendToBack, handleDeleteItem]);

  // OCR handling
  async function handleOcrUpload(file, x, y) {
    if (!file.type.startsWith('image/')) {
      toast.error('ファイル形式エラー', '画像ファイル（PNG、JPEG）を選択してください');
      return;
    }
    setOcrLoading(true);
    try {
      const result = await OcrService.processImage(file);
      const newItem = new TextItem({ x, y, width: 300, height: 150, content: result.text });
      addItem(newItem);
      triggerAutoSave();
      setTimeout(() => {
        const el = document.querySelector(`[data-id="${newItem.id}"] textarea`);
        if (el) el.focus();
      }, 0);
    } catch (error) {
      console.error('OCR処理エラー:', error);
      const errorDetails = error instanceof OcrError ? error.details : {
        type: 'UNKNOWN_ERROR',
        timestamp: new Date().toISOString(),
        error: error.message,
      };
      toast.error('OCR処理エラー', error.message || 'OCR処理中にエラーが発生しました', errorDetails);
    } finally {
      setOcrLoading(false);
    }
  }

  // Image handling
  async function handleImageUpload(file, x, y) {
    if (!file.type.startsWith('image/')) {
      toast.error('ファイル形式エラー', '画像ファイル（PNG、JPEG）を選択してください');
      return;
    }
    const dataUrl = await fileToDataUrl(file);
    const newItem = new ImageItem({ x, y, width: 300, height: 200, src: dataUrl });
    addItem(newItem);
    triggerAutoSave();
  }

  // Toolbar actions
  function handleOcrButton() {
    const center = screenToCanvas(window.innerWidth / 2, window.innerHeight / 2, document.getElementById('canvas-area'));
    dropPositionRef.current = {
      x: center.x - 150,
      y: center.y - 75,
    };
    ocrInputRef.current?.click();
  }

  function handleImageButton() {
    const center = screenToCanvas(window.innerWidth / 2, window.innerHeight / 2, document.getElementById('canvas-area'));
    dropPositionRef.current = {
      x: center.x - 150,
      y: center.y - 100,
    };
    imageInputRef.current?.click();
  }

  function handlePenButton() {
    const center = screenToCanvas(window.innerWidth / 2, window.innerHeight / 2, document.getElementById('canvas-area'));
    const penItem = new PenItem({
      x: center.x - 150,
      y: center.y - 100,
      width: 300,
      height: 200,
    });
    addItem(penItem);
    triggerAutoSave();
  }

  // File input handlers
  function handleOcrFileChange(e) {
    const file = e.target.files[0];
    if (file) {
      handleOcrUpload(file, dropPositionRef.current.x, dropPositionRef.current.y);
    }
    e.target.value = '';
  }

  function handleImageFileChange(e) {
    const file = e.target.files[0];
    if (file) handleImageUpload(file, dropPositionRef.current.x, dropPositionRef.current.y);
    e.target.value = '';
  }

  // Drag & Drop
  useEffect(() => {
    function onDragEnter(e) {
      e.preventDefault();
      dragCounterRef.current++;
      if (e.dataTransfer.types.includes('Files')) {
        setDropActive(true);
      }
    }
    function onDragLeave(e) {
      e.preventDefault();
      dragCounterRef.current--;
      if (dragCounterRef.current === 0) {
        setDropActive(false);
      }
    }
    function onDragOver(e) {
      e.preventDefault();
    }
    function onDrop(e) {
      e.preventDefault();
      dragCounterRef.current = 0;
      setDropActive(false);
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) {
        const canvasPos = screenToCanvas(e.clientX, e.clientY, document.getElementById('canvas-area'));
        handleImageUpload(file, canvasPos.x, canvasPos.y);
      }
    }
    document.addEventListener('dragenter', onDragEnter);
    document.addEventListener('dragleave', onDragLeave);
    document.addEventListener('dragover', onDragOver);
    document.addEventListener('drop', onDrop);
    return () => {
      document.removeEventListener('dragenter', onDragEnter);
      document.removeEventListener('dragleave', onDragLeave);
      document.removeEventListener('dragover', onDragOver);
      document.removeEventListener('drop', onDrop);
    };
  }, [screenToCanvas]);

  if (!loaded) return null;

  return (
    <div id="view-canvas" className="view" style={{ display: 'block' }}>
      <CanvasNavbar projectName={projectMeta?.name || ''} onBack={handleBack} />
      <CanvasToolbar
        onOcr={handleOcrButton}
        onImage={handleImageButton}
        onPen={handlePenButton}
        onSave={handleSave}
      />

      <input
        ref={ocrInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg"
        hidden
        onChange={handleOcrFileChange}
      />
      <input
        ref={imageInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg"
        hidden
        onChange={handleImageFileChange}
      />

      <DropOverlay active={dropActive} />
      <LoadingOverlay active={ocrLoading} />

      <CanvasArea
        items={items}
        onDeleteItem={handleDeleteItem}
        onDragEnd={handleDragEnd}
        onResizeEnd={handleResizeEnd}
        onDoubleClick={handleDoubleClick}
        onContextMenu={showContextMenu}
        onContentChange={handleContentChange}
        camera={camera}
        onUpdateCamera={updateCamera}
        screenToCanvas={screenToCanvas}
      />

      <ContextMenu
        visible={contextMenu.visible}
        x={contextMenu.x}
        y={contextMenu.y}
        targetItemId={contextMenu.targetItemId}
        onAction={handleContextMenuAction}
      />
    </div>
  );
}
