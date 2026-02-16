export class CanvasItem {
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
}
