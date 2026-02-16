import { useState, useCallback } from 'react';
import { Storage } from '../services/storage.js';
import { Project } from '../models/Project.js';

export function useProjects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const list = await Storage.loadProjects();
      const sorted = list
        .map(p => new Project(p))
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      setProjects(sorted);
    } catch (e) {
      console.error("Failed to load projects", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const addProject = useCallback(async (name) => {
    const project = new Project({ name });
    await Storage.saveFullData(project.id, project.serialize(), []);
    await loadProjects();
    return project;
  }, [loadProjects]);

  const deleteProject = useCallback(async (projectId) => {
    await Storage.deleteProject(projectId);
    await loadProjects();
  }, [loadProjects]);

  const renameProject = useCallback(async (projectId, newName) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    project.name = newName;
    project.touch();
    await Storage.updateProjectMeta(project.serialize());
    await loadProjects();
  }, [projects, loadProjects]);

  return {
    projects,
    loading,
    loadProjects,
    addProject,
    deleteProject,
    renameProject,
  };
}
