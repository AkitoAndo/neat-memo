import { Api } from './api.js';

export const Storage = {
  async loadProjects() {
    try {
        const res = await Api.request('GET', '/memos');
        if (!res) return [];

        const projects = res.memos.map(memo => {
            try {
                const data = JSON.parse(memo.content);
                if (data.project) return data.project;
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

  async saveFullData(projectId, projectMeta, itemsArray) {
    const items = itemsArray || [];
    const data = {
        project: projectMeta,
        items: items
    };
    await Api.request('PUT', `/memos/${projectId}`, {
        content: JSON.stringify(data)
    });
  },

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

  async deleteProject(projectId) {
    await Api.request('DELETE', `/memos/${projectId}`);
  },

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
