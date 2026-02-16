import { CanvasItem } from './CanvasItem.js';

export class TextItem extends CanvasItem {
  constructor(data) {
    super({ ...data, type: "text" });
    this.content = data.content || "";
  }

  serialize() {
    const base = super.serialize();
    return { ...base, content: this.content };
  }
}
