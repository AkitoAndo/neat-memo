import { CanvasItem } from './CanvasItem.js';

export class PenItem extends CanvasItem {
  constructor(data) {
    super({ ...data, type: "pen" });
    this.paths = data.paths || [];
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

  pathToSvgD(points) {
    if (points.length < 2) return "";
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      d += ` L ${points[i].x} ${points[i].y}`;
    }
    return d;
  }

  addPath(points, color, width) {
    this.paths.push({
      points: points,
      color: color || this.color,
      width: width || this.strokeWidth,
    });
  }
}
