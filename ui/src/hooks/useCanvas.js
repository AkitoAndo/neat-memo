import { useState, useCallback, useRef } from 'react';
import { Storage } from '../services/storage.js';
import { TextItem } from '../models/TextItem.js';
import { ImageItem } from '../models/ImageItem.js';
import { PenItem } from '../models/PenItem.js';

function deserializeItem(data) {
  switch (data.type) {
    case 'text': return new TextItem(data);
    case 'image': return new ImageItem(data);
    case 'pen': return new PenItem(data);
    default:
      console.warn('Unknown item type:', data.type);
      if (!data.type) return new TextItem({ ...data, type: 'text' });
      return null;
  }
}

export function useCanvas() {
  const [items, setItems] = useState(new Map());
  const [projectMeta, setProjectMeta] = useState(null);
  const itemsRef = useRef(items);
  const projectMetaRef = useRef(projectMeta);

  // Keep refs in sync
  itemsRef.current = items;
  projectMetaRef.current = projectMeta;

  const loadProject = useCallback(async (projectId) => {
    const data = await Storage.loadFullData(projectId);
    const newItems = new Map();

    if (data && data.items && Array.isArray(data.items)) {
      data.items.forEach(itemData => {
        const item = deserializeItem(itemData);
        if (item) newItems.set(item.id, item);
      });
    }

    const meta = data?.project || { id: projectId, name: '無題のプロジェクト' };
    setItems(newItems);
    setProjectMeta(meta);
    itemsRef.current = newItems;
    projectMetaRef.current = meta;
    return meta;
  }, []);

  const addItem = useCallback((item) => {
    setItems(prev => {
      const next = new Map(prev);
      next.set(item.id, item);
      return next;
    });
  }, []);

  const removeItem = useCallback((itemId) => {
    setItems(prev => {
      const next = new Map(prev);
      next.delete(itemId);
      return next;
    });
  }, []);

  const updateItem = useCallback((itemId, updates) => {
    setItems(prev => {
      const item = prev.get(itemId);
      if (!item) return prev;
      Object.assign(item, updates);
      const next = new Map(prev);
      next.set(itemId, item);
      return next;
    });
  }, []);

  const save = useCallback(async (projectId) => {
    const meta = projectMetaRef.current;
    const currentItems = itemsRef.current;
    if (!meta) return;
    const serialized = Array.from(currentItems.values()).map(item => item.serialize());
    await Storage.saveFullData(projectId, meta, serialized);
  }, []);

  return {
    items,
    projectMeta,
    loadProject,
    addItem,
    removeItem,
    updateItem,
    save,
    itemsRef,
  };
}
