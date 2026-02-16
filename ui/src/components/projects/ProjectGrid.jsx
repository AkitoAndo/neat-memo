import ProjectCard from './ProjectCard.jsx';

export default function ProjectGrid({ projects, onOpen, onRename, onDelete }) {
  if (projects.length === 0) {
    return (
      <div id="project-grid">
        <div className="empty-state">
          <p className="empty-state-text">
            プロジェクトがありません。<br />新規作成してください。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div id="project-grid">
      {projects.map(project => (
        <ProjectCard
          key={project.id}
          project={project}
          onClick={onOpen}
          onRename={onRename}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
