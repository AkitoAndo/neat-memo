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
            } catch {
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
   データモデル (リッチUI版)
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
    el.style.zIndex = this.zIndex;
    // 高さも復元する場合
    if (this.height) el.style.height = `${this.height}px`;

    el.dataset.id = this.id;

    // ドラッグ移動用のスタイル（CSSで制御するが、念のため）
    el.style.position = 'absolute';

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
    
    // 簡易的なドラッグハンドラ（ヘッダー部分がないので要素全体でドラッグ可能にするか、検討）
    // 今回は簡易実装として省略するが、CSSで .canvas-item に resize: both がついているとよい
    
    return el;
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
    this.viewport = document.getElementById(containerId);
    this.container = document.getElementById("canvas-content");
    this.items = new Map();
    this.projectId = null;
    this.appState = appState;
    this.autoSaveTimer = null;

    // カメラ（表示位置・ズーム）の状態
    this.camera = {
        x: 0,
        y: 0,
        scale: 1
    };

    this.contextMenu = document.getElementById("context-menu");
    this.contextTargetItem = null;

    this.setupInteractions();
    this.setupContextMenu();
    this.updateTransform();
  }

  updateTransform() {
    this.container.style.transform = `translate(${this.camera.x}px, ${this.camera.y}px) scale(${this.camera.scale})`;
  }

  setupContextMenu() {
    // メニュー外クリックで閉じる
    window.addEventListener("mousedown", (e) => {
      if (!this.contextMenu.contains(e.target)) {
        this.contextMenu.classList.remove("active");
      }
    });

    // 各メニュー項目のイベント
    document.getElementById("menu-front").addEventListener("click", () => {
      if (this.contextTargetItem) {
        this.bringToFront(this.contextTargetItem);
        this.contextMenu.classList.remove("active");
      }
    });

    document.getElementById("menu-back").addEventListener("click", () => {
      if (this.contextTargetItem) {
        this.sendToBack(this.contextTargetItem);
        this.contextMenu.classList.remove("active");
      }
    });

    document.getElementById("menu-delete").addEventListener("click", () => {
      if (this.contextTargetItem) {
        this.removeItem(this.contextTargetItem.id);
        this.contextMenu.classList.remove("active");
      }
    });
  }

  bringToFront(item) {
    let maxZ = 0;
    this.items.forEach(it => {
      maxZ = Math.max(maxZ, it.zIndex);
    });
    item.zIndex = maxZ + 1;
    const el = this.container.querySelector(`[data-id="${item.id}"]`);
    if (el) el.style.zIndex = item.zIndex;
    this.triggerAutoSave();
  }

  sendToBack(item) {
    let minZ = 1;
    this.items.forEach(it => {
      minZ = Math.min(minZ, it.zIndex);
    });
    item.zIndex = minZ - 1;
    const el = this.container.querySelector(`[data-id="${item.id}"]`);
    if (el) el.style.zIndex = item.zIndex;
    this.triggerAutoSave();
  }

  removeItem(id) {
    const item = this.items.get(id);
    if (item) {
      this.items.delete(id);
      const el = this.container.querySelector(`[data-id="${id}"]`);
      if (el) el.remove();
      this.triggerAutoSave();
    }
  }

  // 画面座標をキャンバス内の座標に変換
  screenToCanvas(clientX, clientY) {
    const rect = this.viewport.getBoundingClientRect();
    const x = (clientX - rect.left - this.camera.x) / this.camera.scale;
    const y = (clientY - rect.top - this.camera.y) / this.camera.scale;
    return { x, y };
  }

  async loadProject(projectId) {
    this.projectId = projectId;
    this.container.innerHTML = "";
    this.camera = { x: 0, y: 0, scale: 1 };
    this.updateTransform();
    
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
    
    // 簡易ドラッグ実装 (リッチな体験の要)
    // 要素全体でのMouseDown
    el.addEventListener("mousedown", (e) => {
        // テキストエリア等の入力中はドラッグしない
        if (e.target.tagName.toLowerCase() === 'textarea') return;
        
        e.preventDefault();
        const startX = e.clientX;
        const startY = e.clientY;
        const startLeft = el.offsetLeft;
        const startTop = el.offsetTop;
        
        const onMouseMove = (ev) => {
            const dx = (ev.clientX - startX) / this.camera.scale;
            const dy = (ev.clientY - startY) / this.camera.scale;
            item.x = startLeft + dx;
            item.y = startTop + dy;
            el.style.left = `${item.x}px`;
            el.style.top = `${item.y}px`;
        };
        
        const onMouseUp = () => {
            document.removeEventListener("mousemove", onMouseMove);
            document.removeEventListener("mouseup", onMouseUp);
            this.triggerAutoSave();
        };
        
        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
    });

    // 右クリックでコンテキストメニューを表示
    el.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        this.contextTargetItem = item;
        this.contextMenu.style.left = `${e.clientX}px`;
        this.contextMenu.style.top = `${e.clientY}px`;
        this.contextMenu.classList.add("active");
    });

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

  setupInteractions() {
    // ズーム操作 (マウスホイール)
    this.viewport.addEventListener("wheel", (e) => {
        if (this.appState.currentProjectId === null) return;
        e.preventDefault();
        const delta = -e.deltaY;
        const factor = Math.pow(1.1, delta / 100);
        
        const newScale = Math.min(Math.max(this.camera.scale * factor, 0.1), 5);
        
        const rect = this.viewport.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        this.camera.x = mouseX - (mouseX - this.camera.x) * (newScale / this.camera.scale);
        this.camera.y = mouseY - (mouseY - this.camera.y) * (newScale / this.camera.scale);
        this.camera.scale = newScale;
        
        this.updateTransform();
    }, { passive: false });

    // パン操作 (背景ドラッグ)
    this.container.addEventListener("mousedown", (e) => {
        if (e.target !== this.container) return;
        
        e.preventDefault();
        const startX = e.clientX;
        const startY = e.clientY;
        const startCamX = this.camera.x;
        const startCamY = this.camera.y;
        
        const onMouseMove = (ev) => {
            const dx = ev.clientX - startX;
            const dy = ev.clientY - startY;
            this.camera.x = startCamX + dx;
            this.camera.y = startCamY + dy;
            this.updateTransform();
        };
        
        const onMouseUp = () => {
            document.removeEventListener("mousemove", onMouseMove);
            document.removeEventListener("mouseup", onMouseUp);
        };
        
        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
    });

    this.container.addEventListener("dblclick", (e) => {
      // 既存のアイテム上でのダブルクリックは無視
      if (e.target !== this.container) return;

      const { x, y } = this.screenToCanvas(e.clientX, e.clientY);

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
  }
}

/* ========================================
   OCRサービス（モック）
   ======================================== */
const OcrService = {
  async processImage(file) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return {
      text: `【OCRモック結果】\nファイル名: ${file.name}\nサイズ: ${Math.round(file.size / 1024)}KB\n\nここにOCRで抽出されたテキストが表示されます。`,
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
  } catch {
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

    async function handleImageUpload(file, screenX, screenY) {
      const { x, y } = canvasManager.screenToCanvas(screenX, screenY);
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
        console.error("OCR Error:", error);
        alert("OCR処理中にエラーが発生しました");
      } finally {
        loadingOverlay.classList.remove("active");
      }
    }

    document.getElementById("btn-image").addEventListener("click", () => {
      imageInput.click();
    });

    imageInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) handleImageUpload(file, dropPosition.x, dropPosition.y);
      imageInput.value = "";
    });

    document.getElementById("btn-save").addEventListener("click", () => {
        if (canvasManager) {
            canvasManager.save();
            alert("保存しました");
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
  }
});
