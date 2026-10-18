import fs from "node:fs";
import path from "node:path";
import { migrateProject, validateProject, assertValid } from "./validation";
import type { ArchitectureProject } from "./model";
import { newId } from "./model";

/**
 * Architecture projects live in their own JSON file, separate from the learner's
 * evidence state, so that importing/exporting a project never disturbs progress.
 */

function dataDir() {
  return process.env.ACADEMY_DATA_DIR ?? path.join(process.cwd(), ".data");
}

function projectsFile() {
  return path.join(dataDir(), "architecture.json");
}

function readRaw(): Record<string, unknown> {
  const file = projectsFile();
  if (!fs.existsSync(/*turbopackIgnore: true*/ file)) return { schemaVersion: 2, projects: [] };
  try {
    const parsed = JSON.parse(fs.readFileSync(/*turbopackIgnore: true*/ file, "utf8")) as Record<string, unknown>;
    if (!Array.isArray(parsed.projects)) return { schemaVersion: 2, projects: [] };
    return parsed;
  } catch {
    return { schemaVersion: 2, projects: [] };
  }
}

function writeRaw(data: Record<string, unknown>) {
  const dir = dataDir();
  fs.mkdirSync(dir, { recursive: true });
  const file = projectsFile();
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

export function listProjects(): ArchitectureProject[] {
  return (readRaw().projects as unknown[]).map((p) => migrateProject(p));
}

export function getProject(id: string): ArchitectureProject | undefined {
  return listProjects().find((p) => p.id === id);
}

export function saveProject(project: ArchitectureProject): ArchitectureProject {
  assertValid(project);
  const next: ArchitectureProject = { ...project, updatedAt: new Date().toISOString() };
  if (!next.id) next.id = newId("arch");
  if (!next.createdAt) next.createdAt = next.updatedAt;
  const data = readRaw();
  const list = data.projects as unknown[];
  const i = list.findIndex((p) => (p as { id?: string }).id === next.id);
  if (i >= 0) list[i] = next;
  else list.push(next);
  writeRaw({ ...data, projects: list });
  return next;
}

/** Import accepts arbitrary JSON and migrates it; validation errors are returned, not thrown. */
export function importProject(raw: unknown): { project: ArchitectureProject; issues: ReturnType<typeof validateProject> } {
  const project = migrateProject(raw);
  if (!project.id) project.id = newId("arch");
  const issues = validateProject(project);
  const fatal = issues.some((i) => i.severity === "error");
  if (!fatal) saveProject(project);
  return { project, issues };
}

export function deleteProject(id: string) {
  const data = readRaw();
  const list = (data.projects as unknown[]).filter((p) => (p as { id?: string }).id !== id);
  writeRaw({ ...data, projects: list });
}
