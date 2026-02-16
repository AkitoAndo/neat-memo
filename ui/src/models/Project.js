export class Project {
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
