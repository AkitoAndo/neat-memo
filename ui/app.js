// API endpoint (デプロイ時に注入されるが、未定義なら空文字)
const API_ENDPOINT = window.API_ENDPOINT || "";

/* ========================================
   ストレージユーティリティ
   ======================================== */
const Storage = {
  PROJECTS_KEY: "neatmemo_projects",
  CANVAS_PREFIX: "neatmemo_canvas_",

  // プロジェクト一覧を保存
  saveProjects(projects) {
    const data = Array.from(projects.values()).map((p) => p.serialize());
    localStorage.setItem(this.PROJECTS_KEY, JSON.stringify(data));
  },

  // プロジェクト一覧を読み込み
  loadProjects() {
    const data = localStorage.getItem(this.PROJECTS_KEY);
    return data ? JSON.parse(data) : [];
  },

  // キャンバスデータを保存
  saveCanvas(projectId, items) {
    const data = Array.from(items.values()).map((item) => item.serialize());
    localStorage.setItem(this.CANVAS_PREFIX + projectId, JSON.stringify(data));
  },

  // キャンバスデータを読み込み
  loadCanvas(projectId) {
    const data = localStorage.getItem(this.CANVAS_PREFIX + projectId);
    return data ? JSON.parse(data) : [];
  },

  // キャンバスデータを削除
  deleteCanvas(projectId) {
    localStorage.removeItem(this.CANVAS_PREFIX + projectId);
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

  // 更新日時を更新
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

    el.dataset.id = this.id;

    const textarea = document.createElement("textarea");
    textarea.className = "text-content";
    textarea.placeholder = "メモを入力...";
    textarea.value = this.content;

    textarea.addEventListener("input", (e) => {
      this.content = e.target.value;
    });

    el.appendChild(textarea);
    return el;
  }
}

/* ========================================
   状態管理
   ======================================== */

/**
 * アプリケーション状態管理
 */
class AppState {
  constructor() {
    this.projects = new Map();
    this.currentProjectId = null;
    this.listeners = [];
  }

  // リスナー登録
  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  // 状態変更通知
  notify(event, data = {}) {
    this.listeners.forEach((listener) => listener(event, data));
  }

  // プロジェクト一覧をセット
  setProjects(projectsArray) {
    this.projects.clear();
    projectsArray.forEach((p) => this.projects.set(p.id, new Project(p)));
    this.notify("projects-loaded");
  }

  // プロジェクトを追加
  addProject(project) {
    this.projects.set(project.id, project);
    Storage.saveProjects(this.projects);
    this.notify("project-added", { project });
  }

  // プロジェクトを削除
  deleteProject(projectId) {
    this.projects.delete(projectId);
    Storage.deleteCanvas(projectId);
    Storage.saveProjects(this.projects);
    this.notify("project-deleted", { projectId });
  }

  // プロジェクトを更新
  updateProject(project) {
    project.touch();
    this.projects.set(project.id, project);
    Storage.saveProjects(this.projects);
    this.notify("project-updated", { project });
  }

  // 現在のプロジェクトを設定
  setCurrentProject(projectId) {
    this.currentProjectId = projectId;
    this.notify("project-selected", { projectId });
  }

  // 現在のプロジェクトを取得
  getCurrentProject() {
    return this.currentProjectId
      ? this.projects.get(this.currentProjectId)
      : null;
  }

  // プロジェクト一覧を取得（更新日時順）
  getProjectsSorted() {
    return Array.from(this.projects.values()).sort(
      (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
    );
  }
}

/* ========================================
   画面管理
   ======================================== */

/**
 * 画面切り替え管理
 */
class ViewManager {
  constructor() {
    this.currentView = "project-list";
    this.views = {
      "project-list": document.getElementById("view-project-list"),
      canvas: document.getElementById("view-canvas"),
    };
  }

  // 画面切り替え
  switchTo(viewName, params = {}) {
    // 現在の画面を非表示
    Object.values(this.views).forEach((v) => (v.style.display = "none"));

    // 指定画面を表示
    this.views[viewName].style.display = "block";
    this.currentView = viewName;

    // カスタムイベント発火
    document.dispatchEvent(
      new CustomEvent("viewchange", {
        detail: { view: viewName, params },
      })
    );
  }
}

/* ========================================
   UIコンポーネント
   ======================================== */

/**
 * プロジェクトカードコンポーネント
 */
class ProjectCard {
  constructor(project, options = {}) {
    this.project = project;
    this.onClick = options.onClick || (() => {});
    this.onDelete = options.onDelete || (() => {});
    this.onRename = options.onRename || (() => {});
  }

  // 日付フォーマット
  formatDate(isoString) {
    const date = new Date(isoString);
    return date.toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  // HTMLエスケープ
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

    // カードクリック（ボタン以外）
    card.addEventListener("click", (e) => {
      if (!e.target.classList.contains("card-btn")) {
        this.onClick(this.project);
      }
    });

    // 名前変更ボタン
    card.querySelector(".rename-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      this.onRename(this.project);
    });

    // 削除ボタン
    card.querySelector(".delete-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      this.onDelete(this.project);
    });

    return card;
  }
}

/* ========================================
   キャンバス管理
   ======================================== */

/**
 * キャンバス全体を管理するマネージャー
 */
class CanvasManager {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.items = new Map();
    this.projectId = null;

    this.setupInteractions();
  }

  // プロジェクトをロード
  loadProject(projectId) {
    this.projectId = projectId;
    const data = Storage.loadCanvas(projectId);
    this.importData(JSON.stringify(data));
  }

  // キャンバスをクリア
  clear() {
    this.items.clear();
    this.container.innerHTML = "";
    this.projectId = null;
  }

  // 現在のプロジェクトを保存
  save() {
    if (this.projectId) {
      Storage.saveCanvas(this.projectId, this.items);
    }
  }

  // アイテムを追加
  addItem(item) {
    this.items.set(item.id, item);
    this.renderItem(item);
    this.save();
  }

  // 特定のアイテムをDOMに描画
  renderItem(item) {
    const el = item.render();
    // テキスト変更時に自動保存
    const textarea = el.querySelector("textarea");
    if (textarea) {
      textarea.addEventListener("input", () => {
        this.save();
      });
    }
    this.container.appendChild(el);
  }

  // 画面全体を再描画
  renderAll() {
    this.container.innerHTML = "";
    this.items.forEach((item) => {
      this.renderItem(item);
    });
  }

  // データをJSONとしてエクスポート
  exportData() {
    const data = [];
    this.items.forEach((item) => data.push(item.serialize()));
    return JSON.stringify(data, null, 2);
  }

  // JSONデータから復元
  importData(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      this.items.clear();
      data.forEach((itemData) => {
        let item;
        switch (itemData.type) {
          case "text":
            item = new TextItem(itemData);
            break;
          default:
            console.warn("Unknown item type:", itemData.type);
        }
        if (item) {
          this.items.set(item.id, item);
        }
      });
      this.renderAll();
    } catch (e) {
      console.error("Failed to import data:", e);
    }
  }

  setupInteractions() {
    this.container.addEventListener("dblclick", (e) => {
      if (e.target !== this.container) return;

      const x = e.clientX;
      const y = e.clientY;

      const newItem = new TextItem({
        x: x,
        y: y,
        content: "",
      });

      this.addItem(newItem);

      const el = this.container.querySelector(
        `[data-id="${newItem.id}"] textarea`
      );
      if (el) el.focus();
    });
  }
}

/* ========================================
   OCRサービス（モック実装）
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
   アプリケーション初期化
   ======================================== */
document.addEventListener("DOMContentLoaded", () => {
  // グローバル状態
  const appState = new AppState();
  const viewManager = new ViewManager();
  let canvasManager = null;

  // DOM要素
  const projectGrid = document.getElementById("project-grid");
  const btnNewProject = document.getElementById("btn-new-project");
  const btnBack = document.getElementById("btn-back");
  const currentProjectName = document.getElementById("current-project-name");
  const imageInput = document.getElementById("image-input");
  const dropOverlay = document.getElementById("drop-overlay");
  const loadingOverlay = document.getElementById("loading-overlay");

  // モーダル要素
  const projectModal = document.getElementById("project-modal");
  const modalTitle = document.getElementById("modal-title");
  const projectNameInput = document.getElementById("project-name-input");
  const modalCancel = document.getElementById("modal-cancel");
  const modalConfirm = document.getElementById("modal-confirm");

  // モーダルの状態
  let modalMode = "create"; // "create" or "rename"
  let editingProject = null;

  /* ----- モーダル制御 ----- */

  function openModal(mode, project = null) {
    modalMode = mode;
    editingProject = project;

    if (mode === "create") {
      modalTitle.textContent = "新規プロジェクト";
      modalConfirm.textContent = "作成";
      projectNameInput.value = "";
    } else {
      modalTitle.textContent = "プロジェクト名を変更";
      modalConfirm.textContent = "変更";
      projectNameInput.value = project ? project.name : "";
    }

    projectModal.classList.add("active");
    projectNameInput.focus();
  }

  function closeModal() {
    projectModal.classList.remove("active");
    editingProject = null;
  }

  function confirmModal() {
    const name = projectNameInput.value.trim();
    if (!name) return;

    if (modalMode === "create") {
      const project = new Project({ name });
      appState.addProject(project);
    } else if (editingProject) {
      editingProject.name = name;
      appState.updateProject(editingProject);
    }

    renderProjectGrid();
    closeModal();
  }

  // モーダルイベント
  modalCancel.addEventListener("click", closeModal);
  modalConfirm.addEventListener("click", confirmModal);

  // Enterキーで確定
  projectNameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      confirmModal();
    } else if (e.key === "Escape") {
      closeModal();
    }
  });

  // モーダル外クリックで閉じる
  projectModal.addEventListener("click", (e) => {
    if (e.target === projectModal) {
      closeModal();
    }
  });

  /* ----- プロジェクト一覧画面 ----- */

  // プロジェクトグリッドを再描画
  function renderProjectGrid() {
    projectGrid.innerHTML = "";

    const projects = appState.getProjectsSorted();

    if (projects.length === 0) {
      // 空状態
      const emptyState = document.createElement("div");
      emptyState.className = "empty-state";
      emptyState.innerHTML = `
        <div class="empty-state-icon"></div>
        <p class="empty-state-text">プロジェクトがありません。<br>「新規プロジェクト」ボタンから作成してください。</p>
      `;
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

  // プロジェクトを開く
  function openProject(project) {
    appState.setCurrentProject(project.id);
    currentProjectName.textContent = project.name;

    // キャンバス初期化
    if (!canvasManager) {
      canvasManager = new CanvasManager("canvas-area");
      setupCanvasEvents();
    } else {
      canvasManager.clear();
    }
    canvasManager.loadProject(project.id);

    viewManager.switchTo("canvas");
  }

  // プロジェクトを削除
  function deleteProject(project) {
    if (confirm(`「${project.name}」を削除しますか？\nこの操作は取り消せません。`)) {
      appState.deleteProject(project.id);
      renderProjectGrid();
    }
  }

  // プロジェクト名を変更
  function renameProject(project) {
    openModal("rename", project);
  }

  // 新規プロジェクト作成
  btnNewProject.addEventListener("click", () => {
    openModal("create");
  });

  /* ----- キャンバス画面 ----- */

  // 戻るボタン
  btnBack.addEventListener("click", () => {
    // 現在のプロジェクトを更新
    const currentProject = appState.getCurrentProject();
    if (currentProject) {
      appState.updateProject(currentProject);
    }

    appState.setCurrentProject(null);
    viewManager.switchTo("project-list");
    renderProjectGrid();
  });

  // キャンバス関連イベント
  function setupCanvasEvents() {
    let dropPosition = { x: 100, y: 150 };

    async function handleImageUpload(file, x, y) {
      if (!file.type.startsWith("image/")) {
        alert("画像ファイルを選択してください");
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

        const el = canvasManager.container.querySelector(
          `[data-id="${newItem.id}"] textarea`
        );
        if (el) el.focus();
      } catch (error) {
        console.error("OCR処理エラー:", error);
        alert("OCR処理中にエラーが発生しました");
      } finally {
        loadingOverlay.classList.remove("active");
      }
    }

    // 画像ボタン
    document.getElementById("btn-image").addEventListener("click", () => {
      dropPosition = {
        x: window.innerWidth / 2 - 150,
        y: window.innerHeight / 2 - 75,
      };
      imageInput.click();
    });

    // ファイル選択
    imageInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) {
        handleImageUpload(file, dropPosition.x, dropPosition.y);
      }
      imageInput.value = "";
    });

    // ドラッグ&ドロップ
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

    // 保存ボタン
    document.getElementById("btn-save").addEventListener("click", () => {
      if (canvasManager) {
        canvasManager.save();
        alert("保存しました");
      }
    });
  }

  /* ----- 初期化 ----- */

  // ローカルストレージからプロジェクト読み込み
  const savedProjects = Storage.loadProjects();
  appState.setProjects(savedProjects);

  // プロジェクト一覧を描画
  renderProjectGrid();

  // 初期画面表示
  viewManager.switchTo("project-list");
});
