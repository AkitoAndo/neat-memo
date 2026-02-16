import { auth } from './auth.js';

// API endpoint
const API_ENDPOINT = (window.ENV && window.ENV.API_ENDPOINT) || "";

/* ========================================
   API Client & Storage (認証・API対応版)
   ======================================== */

const Api = {
  async request(method, path, body = null) {
    if (!API_ENDPOINT) {
        console.warn("API Endpoint not set. Using LocalStorage fallback (not fully implemented).");
        return null;
    }

    let token;
    try {
        const session = await auth.fetchAuthSession();
        token = session.tokens?.idToken?.toString();
    } catch (e) {
        console.error("Session error", e);
        throw new Error("Not authenticated");
    }

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': token
    };

    const response = await fetch(`${API_ENDPOINT}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : null
    });

    if (!response.ok) {
        if (response.status === 401) {
            await auth.signOut();
            window.location.reload();
        }
        throw new Error(`API Error: ${response.status}`);
    }

    if (response.status === 204) return null;
    return response.json();
  }
};

const Storage = {
  // プロジェクト一覧を取得
  async loadProjects() {
    try {
        const res = await Api.request('GET', '/memos');
        if (!res) return [];

        // メモの内容をパースしてプロジェクトメタデータを抽出
        const projects = res.memos.map(memo => {
            try {
                const data = JSON.parse(memo.content);
                // データ構造: { project: {...}, items: [...] } または { id: ..., name: ... } (互換性)
                if (data.project) return data.project;
                // 古い形式や直接保存された場合へのフォールバック
                if (data.id && data.name) return data;

                return { id: memo.memoId, name: "無題のプロジェクト", updatedAt: new Date().toISOString() };
            } catch (e) {
                return { id: memo.memoId, name: "破損したデータ", updatedAt: new Date().toISOString() };
            }
        });
        return projects;
    } catch (e) {
        console.error("Load projects failed", e);
        return [];
    }
  },

  // プロジェクト全体（メタデータ＋キャンバス）を保存
  // 新規作成時やキャンバス更新時に使用
  async saveFullData(projectId, projectMeta, itemsMap) {
    const items = itemsMap ? Array.from(itemsMap.values()).map(item => item.serialize()) : [];
    const data = {
        project: projectMeta,
        items: items
    };
    // Upsert (PUT)
    await Api.request('PUT', `/memos/${projectId}`, {
        content: JSON.stringify(data)
    });
  },

  // プロジェクトメタデータのみ更新（キャンバスデータを維持するため、一度読み込む必要がある）
  async updateProjectMeta(project) {
    const currentData = await this.loadFullData(project.id);
    const items = currentData ? currentData.items : [];

    const newData = {
        project: project,
        items: items
    };

    await Api.request('PUT', `/memos/${project.id}`, {
        content: JSON.stringify(newData)
    });
  },

  // プロジェクト削除
  async deleteProject(projectId) {
    await Api.request('DELETE', `/memos/${projectId}`);
  },

  // キャンバスデータを含む全データを取得
  async loadFullData(projectId) {
      try {
        const res = await Api.request('GET', `/memos/${projectId}`);
        if (!res || !res.content) return null;
        return JSON.parse(res.content);
      } catch (e) {
          console.error("Load full data failed", e);
          return null;
      }
  }
};

/* ========================================
   トースト通知システム
   ======================================== */
const Toast = {
  container: null,

  init() {
    this.container = document.getElementById("toast-container");
  },

  show({ title, message, type = "info", duration = 5000, actions = [] }) {
    if (!this.container) this.init();

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;

    const hasActions = actions.length > 0;

    toast.innerHTML = `
      <div class="toast-header">
        <span class="toast-title">${this.escapeHtml(title)}</span>
        <button class="toast-close">&times;</button>
      </div>
      <div class="toast-message">${this.escapeHtml(message)}</div>
      ${hasActions ? '<div class="toast-actions"></div>' : ""}
    `;

    // アクションボタンを追加
    if (hasActions) {
      const actionsContainer = toast.querySelector(".toast-actions");
      actions.forEach((action) => {
        const btn = document.createElement("button");
        btn.className = `toast-btn ${action.primary ? "primary" : "secondary"}`;
        btn.textContent = action.label;
        btn.addEventListener("click", () => {
          action.onClick();
          if (action.closeOnClick !== false) {
            this.remove(toast);
          }
        });
        actionsContainer.appendChild(btn);
      });
    }

    // 閉じるボタン
    toast.querySelector(".toast-close").addEventListener("click", () => {
      this.remove(toast);
    });

    this.container.appendChild(toast);

    // 自動削除（アクションがない場合のみ）
    if (duration > 0 && !hasActions) {
      setTimeout(() => {
        this.remove(toast);
      }, duration);
    }

    return toast;
  },

  remove(toast) {
    if (!toast || !toast.parentNode) return;
    toast.classList.add("removing");
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  },

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  },

  // 成功トースト
  success(title, message) {
    return this.show({ title, message, type: "success", duration: 3000 });
  },

  // エラートースト（ダウンロード機能付き）
  error(title, message, errorDetails = null) {
    const actions = [];

    if (errorDetails) {
      actions.push({
        label: "エラー詳細をダウンロード",
        primary: false,
        closeOnClick: false,
        onClick: () => {
          this.downloadErrorDetails(errorDetails);
        },
      });
    }

    actions.push({
      label: "閉じる",
      primary: true,
      onClick: () => {},
    });

    return this.show({
      title,
      message,
      type: "error",
      duration: 0, // 手動で閉じる
      actions,
    });
  },

  // エラー詳細をダウンロード
  downloadErrorDetails(errorDetails) {
    const content = JSON.stringify(errorDetails, null, 2);
    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `error-details-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  // 情報トースト
  info(title, message) {
    return this.show({ title, message, type: "info", duration: 4000 });
  },
};

/* ========================================
   データモデル
   ======================================== */

/**
 * プロジェクト（ワークスペース）
 */
class Project {
  constructor(data = {}) {
    this.id = data.id || crypto.randomUUID();
    this.name = data.name || "無題のプロジェクト";
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  serialize() {
    return {
      id: this.id,
      name: this.name,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  touch() {
    this.updatedAt = new Date().toISOString();
  }
}

/**
 * キャンバス上のアイテムの基底データ構造
 */
class CanvasItem {
  constructor(data) {
    this.id = data.id || crypto.randomUUID();
    this.type = data.type;
    this.x = data.x || 0;
    this.y = data.y || 0;
    this.width = data.width || 200;
    this.height = data.height || 100;
    this.zIndex = data.zIndex || 1;
  }

  serialize() {
    return {
      id: this.id,
      type: this.type,
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height,
      zIndex: this.zIndex,
    };
  }

  render() {
    throw new Error("Method 'render' must be implemented.");
  }
}

/**
 * 画像アイテム
 */
class ImageItem extends CanvasItem {
  constructor(data) {
    super({ ...data, type: "image" });
    this.src = data.src || ""; // Base64 data URL
  }

  serialize() {
    const base = super.serialize();
    return { ...base, src: this.src };
  }

  render() {
    const el = document.createElement("div");
    el.className = "canvas-item image-item";
    el.style.left = `${this.x}px`;
    el.style.top = `${this.y}px`;
    el.style.width = `${this.width}px`;
    el.style.height = `${this.height}px`;

    el.dataset.id = this.id;

    // ドラッグハンドル（ヘッダー）
    const header = document.createElement("div");
    header.className = "item-header";

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "item-delete-btn";
    deleteBtn.textContent = "\u00d7";
    deleteBtn.title = "削除";

    header.appendChild(deleteBtn);
    el.appendChild(header);

    // 画像表示
    const imgContainer = document.createElement("div");
    imgContainer.className = "image-container";

    const img = document.createElement("img");
    img.src = this.src;
    img.alt = "画像";
    img.draggable = false;

    imgContainer.appendChild(img);
    el.appendChild(imgContainer);

    // リサイズハンドル
    const resizeHandle = document.createElement("div");
    resizeHandle.className = "item-resize-handle";
    el.appendChild(resizeHandle);

    return el;
  }
}

/**
 * テキストボックスアイテム
 */
class TextItem extends CanvasItem {
  constructor(data) {
    super({ ...data, type: "text" });
    this.content = data.content || "";
  }
  serialize() {
    const base = super.serialize();
    return { ...base, content: this.content };
  }

  render() {
    const el = document.createElement("div");
    el.className = "canvas-item";
    el.style.left = `${this.x}px`;
    el.style.top = `${this.y}px`;
    el.style.width = `${this.width}px`;
    el.style.height = `${this.height}px`;

    el.dataset.id = this.id;

    // ドラッグハンドル（ヘッダー）
    const header = document.createElement("div");
    header.className = "item-header";

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "item-delete-btn";
    deleteBtn.textContent = "\u00d7";
    deleteBtn.title = "削除";

    header.appendChild(deleteBtn);
    el.appendChild(header);

    // テキストエリア
    const textarea = document.createElement("textarea");
    textarea.className = "text-content";
    textarea.placeholder = "メモを入力...";
    textarea.value = this.content;

    // テキストエリアへの入力を伝播させない（ドラッグイベント等と干渉しないように）
    textarea.addEventListener("mousedown", (e) => e.stopPropagation());

    textarea.addEventListener("input", (e) => {
      this.content = e.target.value;
      // Note: 自動保存はCanvasManagerがハンドルする
    });

    el.appendChild(textarea);

    // リサイズハンドル
    const resizeHandle = document.createElement("div");
    resizeHandle.className = "item-resize-handle";
    el.appendChild(resizeHandle);

    return el;
  }
}

/**
 * ペン描画アイテム
 */
class PenItem extends CanvasItem {
  constructor(data) {
    super({ ...data, type: "pen" });
    this.paths = data.paths || []; // [{points: [{x, y}, ...], color, width}, ...]
    this.color = data.color || "#333333";
    this.strokeWidth = data.strokeWidth || 2;
  }

  serialize() {
    const base = super.serialize();
    return {
      ...base,
      paths: this.paths,
      color: this.color,
      strokeWidth: this.strokeWidth,
    };
  }

  // パスをSVGのd属性に変換
  pathToSvgD(points) {
    if (points.length < 2) return "";
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      d += ` L ${points[i].x} ${points[i].y}`;
    }
    return d;
  }

  render() {
    const el = document.createElement("div");
    el.className = "canvas-item pen-item";
    el.style.left = `${this.x}px`;
    el.style.top = `${this.y}px`;
    el.style.width = `${this.width}px`;
    el.style.height = `${this.height}px`;

    el.dataset.id = this.id;

    // ドラッグハンドル（ヘッダー）
    const header = document.createElement("div");
    header.className = "item-header";

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "item-delete-btn";
    deleteBtn.textContent = "\u00d7";
    deleteBtn.title = "削除";

    header.appendChild(deleteBtn);
    el.appendChild(header);

    // SVGキャンバス
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "pen-canvas");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");

    // 既存のパスを描画
    this.paths.forEach((path) => {
      const pathEl = document.createElementNS("http://www.w3.org/2000/svg", "path");
      pathEl.setAttribute("d", this.pathToSvgD(path.points));
      pathEl.setAttribute("stroke", path.color || this.color);
      pathEl.setAttribute("stroke-width", path.width || this.strokeWidth);
      pathEl.setAttribute("fill", "none");
      pathEl.setAttribute("stroke-linecap", "round");
      pathEl.setAttribute("stroke-linejoin", "round");
      svg.appendChild(pathEl);
    });

    el.appendChild(svg);

    // リサイズハンドル
    const resizeHandle = document.createElement("div");
    resizeHandle.className = "item-resize-handle";
    el.appendChild(resizeHandle);

    return el;
  }

  // 新しいパスを追加
  addPath(points, color, width) {
    this.paths.push({
      points: points,
      color: color || this.color,
      width: width || this.strokeWidth,
    });
  }
}

/* ========================================
   状態管理 (Async対応)
   ======================================== */

class AppState {
  constructor() {
    this.projects = new Map();
    this.currentProjectId = null;
    this.listeners = [];
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  notify(event, data = {}) {
    this.listeners.forEach((listener) => listener(event, data));
  }

  async loadAll() {
    const projectsList = await Storage.loadProjects();
    this.projects.clear();
    projectsList.forEach((p) => this.projects.set(p.id, new Project(p)));
    this.notify("projects-loaded");
  }

  async addProject(project) {
    this.projects.set(project.id, project);
    await Storage.saveFullData(project.id, project, null); // 新規作成
    this.notify("project-added", { project });
  }

  async deleteProject(projectId) {
    this.projects.delete(projectId);
    await Storage.deleteProject(projectId);
    this.notify("project-deleted", { projectId });
  }

  async updateProject(project) {
    project.touch();
    this.projects.set(project.id, project);
    await Storage.updateProjectMeta(project);
    this.notify("project-updated", { project });
  }

  setCurrentProject(projectId) {
    this.currentProjectId = projectId;
    this.notify("project-selected", { projectId });
  }

  getCurrentProject() {
    return this.currentProjectId
      ? this.projects.get(this.currentProjectId)
      : null;
  }

  getProjectsSorted() {
    return Array.from(this.projects.values()).sort(
      (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
    );
  }
}

/* ========================================
   画面管理
   ======================================== */

class ViewManager {
  constructor() {
    this.currentView = "auth";
    this.views = {
      auth: document.getElementById("view-auth"),
      "project-list": document.getElementById("view-project-list"),
      canvas: document.getElementById("view-canvas"),
    };
  }

  switchTo(viewName, params = {}) {
    Object.values(this.views).forEach((v) => {
        if(v) v.style.display = "none";
    });

    if (this.views[viewName]) {
        this.views[viewName].style.display = "block";
    }
    this.currentView = viewName;

    document.dispatchEvent(
      new CustomEvent("viewchange", {
        detail: { view: viewName, params },
      })
    );
  }
}

/* ========================================
   UIコンポーネント (リッチ版)
   ======================================== */

class ProjectCard {
  constructor(project, options = {}) {
    this.project = project;
    this.onClick = options.onClick || (() => {});
    this.onDelete = options.onDelete || (() => {});
    this.onRename = options.onRename || (() => {});
  }

  formatDate(isoString) {
    const date = new Date(isoString);
    return date.toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  render() {
    const card = document.createElement("div");
    card.className = "project-card";
    card.dataset.projectId = this.project.id;

    card.innerHTML = `
      <div class="project-thumbnail">
        <span class="placeholder-icon"></span>
      </div>
      <div class="project-info">
        <h3 class="project-name">${this.escapeHtml(this.project.name)}</h3>
        <span class="project-date">${this.formatDate(this.project.updatedAt)}</span>
      </div>
      <div class="project-card-actions">
        <button class="card-btn rename-btn">名前変更</button>
        <button class="card-btn delete delete-btn">削除</button>
      </div>
    `;

    card.addEventListener("click", (e) => {
      if (!e.target.classList.contains("card-btn")) {
        this.onClick(this.project);
      }
    });

    card.querySelector(".rename-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      this.onRename(this.project);
    });

    card.querySelector(".delete-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      this.onDelete(this.project);
    });

    return card;
  }
}

/* ========================================
   キャンバス管理 (リッチ版 + API連携)
   ======================================== */

class CanvasManager {
  constructor(containerId, appState) {
    this.container = document.getElementById(containerId);
    this.items = new Map();
    this.projectId = null;
    this.appState = appState;
    this.autoSaveTimer = null;

    this.setupInteractions();
  }

  async loadProject(projectId) {
    this.projectId = projectId;
    this.container.innerHTML = "";

    const data = await Storage.loadFullData(projectId);

    // データ復元: items配列が存在する場合
    if (data && data.items && Array.isArray(data.items)) {
        this.importData(data.items);
    } else {
        this.items.clear();
    }
  }

  clear() {
    this.items.clear();
    this.container.innerHTML = "";
    this.projectId = null;
  }

  save() {
    if (this.projectId) {
      const project = this.appState.getCurrentProject();
      if (project) {
        Storage.saveFullData(this.projectId, project, this.items);
      }
    }
  }

  triggerAutoSave() {
      if (this.autoSaveTimer) clearTimeout(this.autoSaveTimer);
      this.autoSaveTimer = setTimeout(() => {
          this.save();
      }, 2000);
  }

  addItem(item) {
    this.items.set(item.id, item);
    this.renderItem(item);
    this.triggerAutoSave(); // 追加即保存
  }

  renderItem(item) {
    const el = item.render();
    const textarea = el.querySelector("textarea");
    if (textarea) {
      textarea.addEventListener("input", () => {
        this.triggerAutoSave();
      });
    }

    this.container.appendChild(el);
  }

  renderAll() {
    this.container.innerHTML = "";
    this.items.forEach((item) => {
      this.renderItem(item);
    });
  }

  importData(itemsData) {
      this.items.clear();
      itemsData.forEach((itemData) => {
        let item;
        switch (itemData.type) {
          case "text":
            item = new TextItem(itemData);
            break;
          case "image":
            item = new ImageItem(itemData);
            break;
          case "pen":
            item = new PenItem(itemData);
            break;
          default:
            // 互換性のためTextItemとして扱うか、無視する
            console.warn("Unknown item type:", itemData.type);
            if (!itemData.type) item = new TextItem({...itemData, type: 'text'});
        }
        if (item) {
          this.items.set(item.id, item);
        }
      });
      this.renderAll();
  }

  // アイテムを削除
  removeItem(itemId) {
    this.items.delete(itemId);
    const el = this.container.querySelector(`[data-id="${itemId}"]`);
    if (el) el.remove();
    this.save();
  }

  // アイテムの位置を更新
  updateItemPosition(itemId, x, y) {
    const item = this.items.get(itemId);
    if (item) {
      item.x = x;
      item.y = y;
      this.save();
    }
  }

  // アイテムのサイズを更新
  updateItemSize(itemId, width, height) {
    const item = this.items.get(itemId);
    if (item) {
      item.width = width;
      item.height = height;
      this.save();
    }
  }

  // ペン描画モード開始
  startPenMode(itemId) {
    this.penModeItemId = itemId;
    this.isDrawing = false;
    this.currentPath = [];

    const itemEl = this.container.querySelector(`[data-id="${itemId}"]`);
    if (itemEl) {
      itemEl.classList.add("pen-mode");
      const svg = itemEl.querySelector(".pen-canvas");
      if (svg) {
        this.setupPenEvents(itemEl, svg, itemId);
      }
    }
  }

  // ペン描画モード終了
  stopPenMode() {
    if (this.penModeItemId) {
      const itemEl = this.container.querySelector(`[data-id="${this.penModeItemId}"]`);
      if (itemEl) {
        itemEl.classList.remove("pen-mode");
      }
    }
    this.penModeItemId = null;
    this.isDrawing = false;
    this.currentPath = [];
  }

  // ペン描画イベントのセットアップ
  setupPenEvents(itemEl, svg, itemId) {
    const item = this.items.get(itemId);
    if (!item) return;

    let currentPathEl = null;

    const getLocalCoords = (e) => {
      const rect = svg.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };

    const onMouseDown = (e) => {
      if (e.target.closest(".item-header") || e.target.closest(".item-resize-handle")) return;

      this.isDrawing = true;
      this.currentPath = [getLocalCoords(e)];

      currentPathEl = document.createElementNS("http://www.w3.org/2000/svg", "path");
      currentPathEl.setAttribute("stroke", item.color);
      currentPathEl.setAttribute("stroke-width", item.strokeWidth);
      currentPathEl.setAttribute("fill", "none");
      currentPathEl.setAttribute("stroke-linecap", "round");
      currentPathEl.setAttribute("stroke-linejoin", "round");
      svg.appendChild(currentPathEl);
    };

    const onMouseMove = (e) => {
      if (!this.isDrawing || !currentPathEl) return;

      const coords = getLocalCoords(e);
      this.currentPath.push(coords);

      const d = item.pathToSvgD(this.currentPath);
      currentPathEl.setAttribute("d", d);
    };

    const onMouseUp = () => {
      if (!this.isDrawing) return;

      if (this.currentPath.length > 1) {
        item.addPath(this.currentPath, item.color, item.strokeWidth);
        this.save();
      }

      this.isDrawing = false;
      this.currentPath = [];
      currentPathEl = null;
    };

    svg.addEventListener("mousedown", onMouseDown);
    svg.addEventListener("mousemove", onMouseMove);
    svg.addEventListener("mouseup", onMouseUp);
    svg.addEventListener("mouseleave", onMouseUp);
  }

  setupInteractions() {
    // ダブルクリックで新規作成
    this.container.addEventListener("dblclick", (e) => {
      // 既存のアイテム上でのダブルクリックは無視
      if (e.target !== this.container) return;

      const rect = this.container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const newItem = new TextItem({
        x: x,
        y: y,
        content: "",
      });

      this.addItem(newItem);

      // DOMが更新されるのを待ってからフォーカス
      setTimeout(() => {
        const el = this.container.querySelector(
          `[data-id="${newItem.id}"] textarea`
        );
        if (el) el.focus();
      }, 0);
    });

    // ドラッグ移動
    let dragState = null;

    this.container.addEventListener("mousedown", (e) => {
      const header = e.target.closest(".item-header");
      if (!header) return;

      const itemEl = header.closest(".canvas-item");
      if (!itemEl) return;

      e.preventDefault();
      itemEl.classList.add("dragging");

      dragState = {
        itemId: itemEl.dataset.id,
        itemEl: itemEl,
        startX: e.clientX,
        startY: e.clientY,
        origX: parseInt(itemEl.style.left),
        origY: parseInt(itemEl.style.top),
      };
    });

    // リサイズ
    let resizeState = null;

    this.container.addEventListener("mousedown", (e) => {
      if (!e.target.classList.contains("item-resize-handle")) return;

      const itemEl = e.target.closest(".canvas-item");
      if (!itemEl) return;

      e.preventDefault();
      itemEl.classList.add("resizing");

      resizeState = {
        itemId: itemEl.dataset.id,
        itemEl: itemEl,
        startX: e.clientX,
        startY: e.clientY,
        origWidth: parseInt(itemEl.style.width),
        origHeight: parseInt(itemEl.style.height),
      };
    });

    document.addEventListener("mousemove", (e) => {
      // ドラッグ処理
      if (dragState) {
        const dx = e.clientX - dragState.startX;
        const dy = e.clientY - dragState.startY;
        const newX = dragState.origX + dx;
        const newY = dragState.origY + dy;

        dragState.itemEl.style.left = `${newX}px`;
        dragState.itemEl.style.top = `${newY}px`;
      }

      // リサイズ処理
      if (resizeState) {
        const dx = e.clientX - resizeState.startX;
        const dy = e.clientY - resizeState.startY;
        const newWidth = Math.max(100, resizeState.origWidth + dx);
        const newHeight = Math.max(60, resizeState.origHeight + dy);

        resizeState.itemEl.style.width = `${newWidth}px`;
        resizeState.itemEl.style.height = `${newHeight}px`;
      }
    });

    document.addEventListener("mouseup", () => {
      // ドラッグ終了
      if (dragState) {
        dragState.itemEl.classList.remove("dragging");
        const newX = parseInt(dragState.itemEl.style.left);
        const newY = parseInt(dragState.itemEl.style.top);
        this.updateItemPosition(dragState.itemId, newX, newY);
        dragState = null;
      }

      // リサイズ終了
      if (resizeState) {
        resizeState.itemEl.classList.remove("resizing");
        const newWidth = parseInt(resizeState.itemEl.style.width);
        const newHeight = parseInt(resizeState.itemEl.style.height);
        this.updateItemSize(resizeState.itemId, newWidth, newHeight);
        resizeState = null;
      }
    });

    // 削除ボタン
    this.container.addEventListener("click", (e) => {
      if (!e.target.classList.contains("item-delete-btn")) return;

      const itemEl = e.target.closest(".canvas-item");
      if (!itemEl) return;

      if (confirm("このメモを削除しますか？")) {
        this.removeItem(itemEl.dataset.id);
      }
    });
  }
}

/* ========================================
   OCRサービス（Bedrock Vision API）
   ======================================== */
class OcrError extends Error {
  constructor(message, details) {
    super(message);
    this.name = "OcrError";
    this.details = details;
  }
}

const OcrService = {
  async processImage(file) {
    const formData = new FormData();
    formData.append("file", file, file.name);

    const requestTime = new Date().toISOString();
    let response;
    let responseData;

    try {
      response = await fetch(`${API_ENDPOINT}/ocr/jobs`, {
        method: "POST",
        body: formData,
      });

      responseData = await response.json().catch(() => null);
    } catch (networkError) {
      throw new OcrError("ネットワークエラーが発生しました", {
        type: "NETWORK_ERROR",
        timestamp: requestTime,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        error: networkError.message,
      });
    }

    if (!response.ok) {
      throw new OcrError(
        responseData?.error || `HTTPエラー: ${response.status}`,
        {
          type: "HTTP_ERROR",
          timestamp: requestTime,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          httpStatus: response.status,
          httpStatusText: response.statusText,
          response: responseData,
        }
      );
    }

    if (responseData?.status === "FAILED") {
      throw new OcrError(responseData.error || "OCR処理に失敗しました", {
        type: "OCR_FAILED",
        timestamp: requestTime,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        jobId: responseData.job_id,
        response: responseData,
      });
    }

    return {
      text: responseData?.text || "",
    };
  },
};

/* ========================================
   アプリケーション初期化 & 認証フロー
   ======================================== */
document.addEventListener("DOMContentLoaded", async () => {
  const appState = new AppState();
  const viewManager = new ViewManager();
  let canvasManager = null;

  // DOM Elements
  const projectGrid = document.getElementById("project-grid");
  const btnNewProject = document.getElementById("btn-new-project");
  const btnBack = document.getElementById("btn-back");
  const btnLogout = document.getElementById("btn-logout");
  const currentProjectName = document.getElementById("current-project-name");
  const imageInput = document.getElementById("image-input");
  const dropOverlay = document.getElementById("drop-overlay");
  const loadingOverlay = document.getElementById("loading-overlay");

  // Auth Elements
  const authSignin = document.getElementById("auth-signin");
  const authSignup = document.getElementById("auth-signup");
  const authConfirm = document.getElementById("auth-confirm");
  const authMessage = document.getElementById("auth-message");

  // Auth Functions
  function showAuthMessage(msg) {
      authMessage.textContent = msg;
      setTimeout(() => authMessage.textContent = "", 5000);
  }

  function switchAuthForm(formName) {
      authSignin.style.display = "none";
      authSignup.style.display = "none";
      authConfirm.style.display = "none";

      if(formName === "signin") authSignin.style.display = "block";
      if(formName === "signup") authSignup.style.display = "block";
      if(formName === "confirm") authConfirm.style.display = "block";
  }

  // --- Auth Event Listeners ---

  document.getElementById("link-signup").addEventListener("click", (e) => {
      e.preventDefault();
      switchAuthForm("signup");
  });

  document.getElementById("link-signin").addEventListener("click", (e) => {
      e.preventDefault();
      switchAuthForm("signin");
  });

  document.getElementById("btn-confirm-back").addEventListener("click", () => {
      switchAuthForm("signin");
  });

  document.getElementById("btn-signin").addEventListener("click", async () => {
      const email = document.getElementById("signin-email").value;
      const password = document.getElementById("signin-password").value;

      try {
          await auth.signIn({ username: email, password });
          await initializeApp();
      } catch (e) {
          console.error(e);
          showAuthMessage(`ログインエラー: ${e.message}`);
      }
  });

  document.getElementById("btn-signup").addEventListener("click", async () => {
      const email = document.getElementById("signup-email").value;
      const password = document.getElementById("signup-password").value;

      try {
          await auth.signUp({
              username: email,
              password,
              options: {
                  userAttributes: {
                      email: email
                  }
              }
          });
          document.getElementById("confirm-email-hidden").value = email;
          switchAuthForm("confirm");
          showAuthMessage("確認コードを送信しました。メールを確認してください。");
      } catch (e) {
          console.error(e);
          showAuthMessage(`登録エラー: ${e.message}`);
      }
  });

  document.getElementById("btn-confirm").addEventListener("click", async () => {
      const email = document.getElementById("confirm-email-hidden").value;
      const code = document.getElementById("confirm-code").value;

      try {
          await auth.confirmSignUp({ username: email, confirmationCode: code });
          switchAuthForm("signin");
          showAuthMessage("確認完了。ログインしてください。");
      } catch (e) {
          console.error(e);
          showAuthMessage(`確認エラー: ${e.message}`);
      }
  });

  if(btnLogout) {
      btnLogout.addEventListener("click", async () => {
          await auth.signOut();
          viewManager.switchTo("auth");
      });
  }

  // --- App Initialization ---

  async function initializeApp() {
      viewManager.switchTo("project-list");
      await appState.loadAll();
      renderProjectGrid();
  }

  // Session Check on Load
  try {
      const user = await auth.getCurrentUser();
      if (user) {
          await initializeApp();
      } else {
          throw new Error("No user");
      }
  } catch (e) {
      viewManager.switchTo("auth");
  }


  /* ----- App Logic (Merged from previous app.js) ----- */

  // Modal Logic
  const projectModal = document.getElementById("project-modal");
  const modalTitle = document.getElementById("modal-title");
  const projectNameInput = document.getElementById("project-name-input");
  const modalCancel = document.getElementById("modal-cancel");
  const modalConfirm = document.getElementById("modal-confirm");
  let modalMode = "create";
  let editingProject = null;

  function openModal(mode, project = null) {
    modalMode = mode;
    editingProject = project;
    modalTitle.textContent = mode === "create" ? "新規プロジェクト" : "プロジェクト名を変更";
    modalConfirm.textContent = mode === "create" ? "作成" : "変更";
    projectNameInput.value = project ? project.name : "";
    projectModal.classList.add("active");
    projectNameInput.focus();
  }

  function closeModal() {
    projectModal.classList.remove("active");
    editingProject = null;
  }

  async function confirmModal() {
    const name = projectNameInput.value.trim();
    if (!name) return;

    if (modalMode === "create") {
      const project = new Project({ name });
      await appState.addProject(project);
    } else if (editingProject) {
      editingProject.name = name;
      await appState.updateProject(editingProject);
    }

    renderProjectGrid();
    closeModal();
  }

  modalCancel.addEventListener("click", closeModal);
  modalConfirm.addEventListener("click", confirmModal);
  projectNameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") confirmModal();
      if (e.key === "Escape") closeModal();
  });
  projectModal.addEventListener("click", (e) => {
    if (e.target === projectModal) closeModal();
  });

  // Project Grid
  function renderProjectGrid() {
    projectGrid.innerHTML = "";
    const projects = appState.getProjectsSorted();

    if (projects.length === 0) {
      const emptyState = document.createElement("div");
      emptyState.className = "empty-state";
      emptyState.innerHTML = `<p class="empty-state-text">プロジェクトがありません。<br>新規作成してください。</p>`;
      projectGrid.appendChild(emptyState);
      return;
    }

    projects.forEach((project) => {
      const card = new ProjectCard(project, {
        onClick: (p) => openProject(p),
        onDelete: (p) => deleteProject(p),
        onRename: (p) => renameProject(p),
      });
      projectGrid.appendChild(card.render());
    });
  }

  async function openProject(project) {
    appState.setCurrentProject(project.id);
    currentProjectName.textContent = project.name;

    if (!canvasManager) {
      canvasManager = new CanvasManager("canvas-area", appState);
      setupCanvasEvents();
    } else {
      canvasManager.clear();
    }

    // Load canvas data
    await canvasManager.loadProject(project.id);
    viewManager.switchTo("canvas");
  }

  async function deleteProject(project) {
    if (confirm(`「${project.name}」を削除しますか？`)) {
      await appState.deleteProject(project.id);
      renderProjectGrid();
    }
  }

  function renameProject(project) {
    openModal("rename", project);
  }

  btnNewProject.addEventListener("click", () => openModal("create"));

  btnBack.addEventListener("click", () => {
    if (canvasManager) canvasManager.save();
    appState.setCurrentProject(null);
    viewManager.switchTo("project-list");
    renderProjectGrid();
  });

  // Canvas Events
  function setupCanvasEvents() {
    let dropPosition = { x: 100, y: 150 };
    const ocrInput = document.getElementById("ocr-input");
    const contextMenu = document.getElementById("context-menu");
    let contextMenuPosition = { x: 0, y: 0 };

    // コンテキストメニューを非表示
    function hideContextMenu() {
      contextMenu.classList.remove("active");
    }

    // コンテキストメニューを表示
    function showContextMenu(x, y) {
      contextMenuPosition = { x, y };
      contextMenu.style.left = `${x}px`;
      contextMenu.style.top = `${y}px`;
      contextMenu.classList.add("active");
    }

    // 右クリックでコンテキストメニュー表示
    const canvasArea = document.getElementById("canvas-area");
    console.log("Setting up context menu on:", canvasArea);

    canvasArea.addEventListener("contextmenu", (e) => {
      console.log("Context menu event fired", e.target);
      // canvas-item内でなければメニューを表示
      const isOnItem = e.target.closest(".canvas-item");
      if (!isOnItem) {
        e.preventDefault();
        showContextMenu(e.clientX, e.clientY);
      }
    });

    // クリックでメニュー非表示
    document.addEventListener("click", (e) => {
      if (!contextMenu.contains(e.target)) {
        hideContextMenu();
      }
    });

    // Escキーでメニュー非表示
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        hideContextMenu();
      }
    });

    // コンテキストメニューのアクション
    contextMenu.addEventListener("click", (e) => {
      const action = e.target.dataset.action;
      if (!action) return;

      hideContextMenu();

      switch (action) {
        case "add-text":
          const newItem = new TextItem({
            x: contextMenuPosition.x,
            y: contextMenuPosition.y,
            width: 200,
            height: 100,
            content: "",
          });
          canvasManager.addItem(newItem);
          const el = canvasManager.container.querySelector(
            `[data-id="${newItem.id}"] textarea`
          );
          if (el) el.focus();
          break;

        case "add-ocr":
          dropPosition = contextMenuPosition;
          ocrInput.click();
          break;

        case "add-image":
          dropPosition = contextMenuPosition;
          imageInput.click();
          break;

        case "add-pen":
          const penItem = new PenItem({
            x: contextMenuPosition.x,
            y: contextMenuPosition.y,
            width: 300,
            height: 200,
          });
          canvasManager.addItem(penItem);
          canvasManager.startPenMode(penItem.id);
          break;
      }
    });

    // ファイルをBase64 Data URLに変換
    function fileToDataUrl(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }

    // OCR処理
    async function handleOcrUpload(file, x, y) {
      if (!file.type.startsWith("image/")) {
        Toast.error("ファイル形式エラー", "画像ファイル（PNG、JPEG）を選択してください");
        return;
      }

      loadingOverlay.classList.add("active");
      try {
        const result = await OcrService.processImage(file);
        const newItem = new TextItem({
          x: x,
          y: y,
          width: 300,
          height: 150,
          content: result.text,
        });
        canvasManager.addItem(newItem);

        // 追加された要素のテキストエリアにフォーカス
        // DOM追加後に少し待つ
        setTimeout(() => {
            const el = canvasManager.container.querySelector(`[data-id="${newItem.id}"] textarea`);
            if(el) el.focus();
        }, 0);

      } catch (error) {
        console.error("OCR処理エラー:", error);
        const errorDetails = error instanceof OcrError ? error.details : {
          type: "UNKNOWN_ERROR",
          timestamp: new Date().toISOString(),
          error: error.message,
        };
        Toast.error(
          "OCR処理エラー",
          error.message || "OCR処理中にエラーが発生しました",
          errorDetails
        );
      } finally {
        loadingOverlay.classList.remove("active");
      }
    }

    // 画像として配置
    async function handleImageUpload(file, x, y) {
      if (!file.type.startsWith("image/")) {
        Toast.error("ファイル形式エラー", "画像ファイル（PNG、JPEG）を選択してください");
        return;
      }

      const dataUrl = await fileToDataUrl(file);
      const newItem = new ImageItem({
        x: x,
        y: y,
        width: 300,
        height: 200,
        src: dataUrl,
      });

      canvasManager.addItem(newItem);
    }

    // OCRボタン
    document.getElementById("btn-ocr").addEventListener("click", () => {
      dropPosition = {
        x: window.innerWidth / 2 - 150,
        y: window.innerHeight / 2 - 75,
      };
      ocrInput.click();
    });

    // OCRファイル選択
    ocrInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) {
        handleOcrUpload(file, dropPosition.x, dropPosition.y);
      }
      ocrInput.value = "";
    });

    // 画像ボタン
    document.getElementById("btn-image").addEventListener("click", () => {
      imageInput.click();
    });

    // 画像ファイル選択
    imageInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) handleImageUpload(file, dropPosition.x, dropPosition.y);
      imageInput.value = "";
    });

    // 保存ボタン
    document.getElementById("btn-save").addEventListener("click", () => {
      if (canvasManager) {
        canvasManager.save();
        Toast.success("保存完了", "キャンバスを保存しました");
      }
    });

    // Drag & Drop logic
    let dragCounter = 0;

    document.addEventListener("dragenter", (e) => {
      if (viewManager.currentView !== "canvas") return;
      e.preventDefault();
      dragCounter++;
      if (e.dataTransfer.types.includes("Files")) {
        dropOverlay.classList.add("active");
      }
    });

    document.addEventListener("dragleave", (e) => {
      if (viewManager.currentView !== "canvas") return;
      e.preventDefault();
      dragCounter--;
      if (dragCounter === 0) {
        dropOverlay.classList.remove("active");
      }
    });

    document.addEventListener("dragover", (e) => {
      if (viewManager.currentView !== "canvas") return;
      e.preventDefault();
    });

    document.addEventListener("drop", (e) => {
      if (viewManager.currentView !== "canvas") return;
      e.preventDefault();
      dragCounter = 0;
      dropOverlay.classList.remove("active");

      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith("image/")) {
        handleImageUpload(file, e.clientX, e.clientY);
      }
    });

    // ペンボタン
    document.getElementById("btn-pen").addEventListener("click", () => {
      const penItem = new PenItem({
        x: window.innerWidth / 2 - 150,
        y: window.innerHeight / 2 - 100,
        width: 300,
        height: 200,
      });
      canvasManager.addItem(penItem);
      canvasManager.startPenMode(penItem.id);
    });
  }
});
