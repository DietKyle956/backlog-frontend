import type { Project } from "../types";

interface ProjectSwitcherProps {
  projects: Project[];
  selectedId: number | null;
  onChange: (project: Project) => void;
}

export function ProjectSwitcher({
  projects,
  selectedId,
  onChange,
}: ProjectSwitcherProps) {
  return (
    <div className="relative">
      <select
        className="appearance-none w-full bg-surface-raised text-text-primary text-sm font-medium
                   px-3 py-2 pr-8 rounded-lg border border-border-subtle
                   focus:outline-none focus:ring-2 focus:ring-accent/50"
        value={selectedId ?? ""}
        onChange={(e) => {
          const project = projects.find(
            (p) => p.id === Number(e.target.value),
          );
          if (project) onChange(project);
        }}
      >
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted text-xs">
        &#9662;
      </span>
    </div>
  );
}
