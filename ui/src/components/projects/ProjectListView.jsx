import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import { useProjects } from '../../hooks/useProjects.js';
import ProjectGrid from './ProjectGrid.jsx';
import ProjectModal from './ProjectModal.jsx';

export default function ProjectListView() {
  const { signOut } = useAuth();
  const { projects, loadProjects, addProject, deleteProject, renameProject } = useProjects();
  const navigate = useNavigate();

  const [modalActive, setModalActive] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [editingProject, setEditingProject] = useState(null);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  function handleOpen(project) {
    navigate(`/projects/${project.id}`);
  }

  function handleNewProject() {
    setModalMode('create');
    setEditingProject(null);
    setModalActive(true);
  }

  function handleRename(project) {
    setModalMode('rename');
    setEditingProject(project);
    setModalActive(true);
  }

  async function handleDelete(project) {
    if (confirm(`「${project.name}」を削除しますか？`)) {
      await deleteProject(project.id);
    }
  }

  async function handleModalConfirm(name) {
    if (modalMode === 'create') {
      await addProject(name);
    } else if (editingProject) {
      await renameProject(editingProject.id, name);
    }
    setModalActive(false);
  }

  async function handleLogout() {
    await signOut();
    navigate('/login', { replace: true });
  }

  return (
    <div id="view-project-list" className="view" style={{ display: 'block' }}>
      <header id="project-header">
        <h1>NeatMemo</h1>
        <button className="secondary-btn" onClick={handleLogout}>ログアウト</button>
      </header>
      <div id="project-actions">
        <button className="primary-btn" onClick={handleNewProject}>+ 新規プロジェクト</button>
      </div>
      <ProjectGrid
        projects={projects}
        onOpen={handleOpen}
        onRename={handleRename}
        onDelete={handleDelete}
      />
      <ProjectModal
        active={modalActive}
        mode={modalMode}
        project={editingProject}
        onConfirm={handleModalConfirm}
        onCancel={() => setModalActive(false)}
      />
    </div>
  );
}
