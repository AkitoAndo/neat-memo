import { CanvasItem } from './CanvasItem.js';

export class ImageItem extends CanvasItem {
  constructor(data) {
    super({ ...data, type: "image" });
    this.src = data.src || "";
  }

  serialize() {
    const base = super.serialize();
    return { ...base, src: this.src };
  }
}
