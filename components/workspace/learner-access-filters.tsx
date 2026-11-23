"use client";

export function groupAccessLearners<T>(learners: T[], classFor: (learner: T) => string) {
  const groups = new Map<string, T[]>();
  for (const learner of learners) {
    const className = classFor(learner);
    const group = groups.get(className);
    if (group) group.push(learner);
    else groups.set(className, [learner]);
  }
  return [...groups].sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }));
}

export function LearnerAccessFilters({ search, className, classes, onSearch, onClass }: {
  search: string;
  className: string;
  classes: string[];
  onSearch: (value: string) => void;
  onClass: (value: string) => void;
}) {
  const field = "mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-normal";
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm font-semibold">Search learners
        <input type="search" value={search} onChange={(event) => onSearch(event.target.value)} className={field} />
      </label>
      <label className="text-sm font-semibold">Class
        <select value={className} onChange={(event) => onClass(event.target.value)} className={field}>
          <option value="">All classes</option>
          {classes.map((name) => <option key={name}>{name}</option>)}
        </select>
      </label>
    </div>
  );
}
