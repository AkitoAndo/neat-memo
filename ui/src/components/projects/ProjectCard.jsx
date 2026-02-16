function formatDate(isoString) {
  const date = new Date(isoString);
  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function ProjectCard({ project, onClick, onRename, onDelete }) {
  return (
    <div className="project-card" data-project-id={project.id} onClick={() => onClick(project)}>
      <div className="project-thumbnail">
        <span className="placeholder-icon"></span>
      </div>
      <div className="project-info">
        <h3 className="project-name">{project.name}</h3>
        <span className="project-date">{formatDate(project.updatedAt)}</span>
      </div>
      <div className="project-card-actions">
        <button
          className="card-btn rename-btn"
          onClick={e => { e.stopPropagation(); onRename(project); }}
        >
          名前変更
        </button>
        <button
          className="card-btn delete delete-btn"
          onClick={e => { e.stopPropagation(); onDelete(project); }}
        >
          削除
        </button>
      </div>
    </div>
  );
}
