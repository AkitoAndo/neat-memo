// API endpoint (デプロイ時に注入されるが、未定義なら空文字)
const API_ENDPOINT = window.API_ENDPOINT || "";

/**
 *キャンバス上のアイテムの基底データ構造
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

  // 保存用データを生成
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

  // DOM要素を生成して返す (サブクラスで実装)
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
    // 高さ自動調整のためmin-heightを使用する場合はstyle.heightを指定しない手もあるが
    // ここでは簡易的なリサイズ対応のため固定値をセットしない、あるいはCSSに任せる

    el.dataset.id = this.id;

    // 内部のテキストエリア（またはcontenteditable）
    const textarea = document.createElement("textarea");
    textarea.className = "text-content";
    textarea.placeholder = "メモを入力...";
    textarea.value = this.content;

    // 入力内容をデータモデルに反映
    textarea.addEventListener("input", (e) => {
      this.content = e.target.value;
    });

    el.appendChild(textarea);
    return el;
  }
}

/**
 * キャンバス全体を管理するマネージャー
 */
class CanvasManager {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.items = new Map(); // ID -> CanvasItem

    this.setupInteractions();
  }

  // アイテムを追加
  addItem(item) {
    this.items.set(item.id, item);
    this.renderItem(item);
  }

  // 特定のアイテムをDOMに描画
  renderItem(item) {
    const el = item.render();
    this.container.appendChild(el);
  }

  // 画面全体を再描画（データロード時など）
  renderAll() {
    this.container.innerHTML = "";
    this.items.forEach((item) => {
      this.renderItem(item);
    });
  }

  // データをJSONとしてエクスポート（保存用）
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
          // 将来の拡張: case 'image': ...
          default:
            console.warn("Unknown item type:", itemData.type);
        }
        if (item) {
          this.items.set(item.id, item);
        }
      });
      this.renderAll();
      console.log("Data loaded successfully");
    } catch (e) {
      console.error("Failed to import data:", e);
    }
  }

  setupInteractions() {
    // キャンバスの背景をクリックしたときの処理
    this.container.addEventListener("dblclick", (e) => {
      // 既にアイテム上なら何もしない（イベントバブリングで判定も可能だが簡易的にターゲット確認）
      if (e.target !== this.container) return;

      // クリック位置にテキストを追加
      // 注意: 親要素のオフセット等を考慮する必要があるが、全画面固定ならclientX/Yで概ねOK
      // ここでは簡易的に実装
      const x = e.clientX;
      const y = e.clientY;

      const newItem = new TextItem({
        x: x,
        y: y,
        content: "",
      });

      this.addItem(newItem);

      // 追加直後にフォーカスしたい場合はここで処理
      const el = this.container.querySelector(
        `[data-id="${newItem.id}"] textarea`
      );
      if (el) el.focus();
    });
  }
}

// アプリケーション初期化
document.addEventListener("DOMContentLoaded", () => {
  const canvas = new CanvasManager("canvas-area");

  // テスト用：保存ボタン
  document.getElementById("btn-save").addEventListener("click", () => {
    const json = canvas.exportData();
    console.log("--- Canvas Data ---");
    console.log(json);
    alert(
      "コンソールにJSONデータを出力しました。これを保存・読み込み機能に使えます。"
    );
  });

  // 以前のデータの読み込みシミュレーション（あれば）
  // const savedData = localStorage.getItem('neatmemo_data');
  // if (savedData) canvas.importData(savedData);
});
