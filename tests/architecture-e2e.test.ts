import { describe, expect, it, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { sampleProject } from "@/lib/architecture/sample";
import { saveProject, deleteProject } from "@/lib/architecture/store";

/**
 * End-to-end flow against a real running server.
 *
 * The test creates exactly one uniquely named project through the same store
 * the wizard action uses, drives the HTTP routes, then deletes that one
 * project again. It never swaps ACADEMY_DATA_DIR, so it always talks to the
 * data the running server is actually serving, and it cannot leave junk behind
 * in the learner's real .data folder.
 *
 * Skipped unless ACADEMY_E2E_URL is set, e.g.
 *   $env:ACADEMY_E2E_URL="http://localhost:3000"; npm test
 */
const BASE = process.env.ACADEMY_E2E_URL;
const PROJECT_NAME = "E2E Parts Ordering";

let projectId = "";

describe.skipIf(!BASE)("architecture end-to-end over HTTP", () => {
  beforeAll(() => {
    const p = saveProject({ ...sampleProject(), name: PROJECT_NAME });
    projectId = p.id;
  });

  afterAll(() => {
    // remove only the project this test created
    try {
      deleteProject(projectId);
    } catch {
      /* the store may already be gone */
    }
  });

  async function get(url: string) {
    const res = await fetch(`${BASE}${url}`);
    return { status: res.status, type: res.headers.get("content-type") ?? "", body: await res.text() };
  }

  it("lists the project on the architecture home page", async () => {
    const r = await get("/architecture");
    expect(r.status).toBe(200);
    expect(r.body).toContain(PROJECT_NAME);
  });

  it("renders the wizard with the diagram preview", async () => {
    const r = await get(`/architecture/wizard?step=context&id=${projectId}`);
    expect(r.status).toBe(200);
    expect(r.body).toContain("<svg");
    expect(r.body).toContain("System context diagram");
  });

  it("renders the print report with every section and inline SVG", async () => {
    const r = await get(`/architecture/report?id=${projectId}`);
    expect(r.status).toBe(200);
    expect(r.body).toContain("Architecture report");
    expect(r.body).toContain(PROJECT_NAME);
    for (const heading of ["Executive summary", "System context diagram", "Container diagram", "Architecture decisions", "Requirements and traceability", "Security considerations", "Risks and mitigations", "Open questions"]) {
      expect(r.body).toContain(heading);
    }
    expect((r.body.match(/<svg/g) ?? []).length).toBeGreaterThanOrEqual(2);
    for (const a of sampleProject().adrs) expect(r.body).toContain(a.title);
  });

  it("downloads a non-empty Markdown report containing the project and ADR titles", async () => {
    const r = await get(`/architecture/export?format=md&id=${projectId}`);
    expect(r.status).toBe(200);
    expect(r.type).toContain("text/markdown");
    expect(r.body.length).toBeGreaterThan(500);
    expect(r.body).toContain(PROJECT_NAME);
    for (const a of sampleProject().adrs) expect(r.body).toContain(a.title);
  });

  it("downloads project JSON that re-imports cleanly", async () => {
    const r = await get(`/architecture/export?format=json&id=${projectId}`);
    expect(r.status).toBe(200);
    const parsed = JSON.parse(r.body);
    expect(parsed.name).toBe(PROJECT_NAME);
    expect(parsed.elements.length).toBeGreaterThan(5);
    expect(parsed.adrs.length).toBeGreaterThan(0);
  });

  it("downloads SVG diagrams as vectors", async () => {
    const r = await get(`/architecture/export?format=svg&id=${projectId}`);
    expect(r.status).toBe(200);
    expect(r.body).toContain("<svg");
    expect(r.body).not.toContain("<canvas");
  });

  it("downloads all ADRs as Markdown", async () => {
    const r = await get(`/architecture/export?format=adrs&id=${projectId}`);
    expect(r.status).toBe(200);
    expect(r.body).toContain("ADR-0001");
  });

  it("sends a stale or unknown project back to the project list with an explanation", async () => {
    // A bare 404 here is what broke the download button: a cached page kept a
    // deleted project id. It must now redirect and say why.
    const res = await fetch(`${BASE}/architecture/export?format=md&id=does-not-exist`, { redirect: "manual" });
    expect([302, 303, 307]).toContain(res.status);
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("/architecture");
    expect(location).toContain("error=");

    const report = await fetch(`${BASE}/architecture/report?id=does-not-exist`, { redirect: "manual" });
    expect([200, 302]).toContain(report.status);
  });

  it("downloads the most recent project when no id is supplied, instead of 404", async () => {
    // A missing id used to produce a dead link on every download button.
    for (const format of ["md", "json", "svg", "adrs"]) {
      const r = await get(`/architecture/export?format=${format}`);
      expect(r.status, `format=${format}`).toBe(200);
      expect(r.body.length).toBeGreaterThan(0);
    }
  });

  it("sets a download filename with the right extension on every export", async () => {
    const expected: Record<string, string> = { md: ".md", json: ".json", svg: ".svg", adrs: ".md" };
    for (const [format, ext] of Object.entries(expected)) {
      const res = await fetch(`${BASE}/architecture/export?format=${format}&id=${projectId}`);
      const disp = res.headers.get("content-disposition") ?? "";
      expect(disp, format).toContain("attachment");
      expect(disp, format).toContain(ext);
    }
  });

  it("resolves a single diagram by a loose level name, not just an exact slug", async () => {
    for (const level of ["container", "Level 2 - Container", "system landscape", "deployment"]) {
      const r = await get(`/architecture/export?format=svg-one&level=${encodeURIComponent(level)}&id=${projectId}`);
      expect(r.status, level).toBe(200);
      expect(r.body, level).toContain("<svg");
    }
  });

  it("serves the print report with no id, matching the export fallback", async () => {
    // print=1 with no id is what a shared/bookmarked report link looks like
    const r = await get("/architecture/report?print=1");
    expect(r.status).toBe(200);
    expect(r.body).toContain("Architecture report");
  });

  it("serves the print report with a real export panel", async () => {
    const r = await get(`/architecture/report?id=${projectId}`);
    expect(r.status).toBe(200);
    expect(r.body).toContain("Export PDF");
    expect(r.body).toContain("Save as PDF");
    expect(r.body).toContain("Download Markdown");
    expect(r.body).toContain("Download diagrams (SVG)");
  });
});
