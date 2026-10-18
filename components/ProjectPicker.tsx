"use client";

import { useRouter } from "next/navigation";

/**
 * Project picker that actually navigates.
 *
 * A plain <select> with no handler looks interactive but silently does nothing,
 * which left the download links pointing at a stale or empty project id.
 */
export default function ProjectPicker({
  projects,
  current,
  param = "id",
}: {
  projects: { id: string; name: string }[];
  current?: string;
  param?: string;
}) {
  const router = useRouter();
  if (projects.length === 0) return null;

  return (
    <label>
      <span className="muted">Project</span>
      <select
        value={current ?? projects[0].id}
        onChange={(e) => {
          const q = new URLSearchParams(window.location.search);
          q.set(param, e.target.value);
          router.push(`${window.location.pathname}?${q.toString()}`);
        }}
      >
        {projects.map((p) => (
          <option key={p.id} value={p.id}>{p.name || "Untitled"}</option>
        ))}
      </select>
    </label>
  );
}
