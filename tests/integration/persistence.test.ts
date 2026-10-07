// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../../server/app.js";
import { getAppPaths } from "../../server/config.js";
import { DatabaseManager } from "../../server/database.js";
import { AppStore } from "../../server/store.js";
import { makeTestDirectory, removeTestDirectory } from "../helpers.js";

let directory = "";
afterEach(() => { if (directory) removeTestDirectory(directory); directory = ""; });

describe("SQLite persistence and migrations", () => {
  it("persists a plan item across a complete server restart", async () => {
    directory = makeTestDirectory("persistence");
    const first = await buildApp({ dataDir: directory, autoBackup: false });
    const created = await first.inject({ method: "POST", url: "/api/collections/planItems", payload: { title: "重启后仍然存在", plan_date: "2026-08-02", priority: "high" } });
    expect(created.statusCode).toBe(201);
    const id = created.json().data.id;
    await first.close();

    const second = await buildApp({ dataDir: directory, autoBackup: false });
    try {
      const state = await second.inject({ method: "GET", url: "/api/state" });
      expect(state.json().data.planItems).toEqual(expect.arrayContaining([expect.objectContaining({ id, title: "重启后仍然存在" })]));
      expect(fs.existsSync(getAppPaths(directory).dataFile)).toBe(true);
    } finally {
      await second.close();
    }
  });

  it("manually checkpoints pending writes into the local data file", async () => {
    directory = makeTestDirectory("manual-save");
    const first = await buildApp({ dataDir: directory, autoBackup: false });
    const dataFile = getAppPaths(directory).dataFile;
    const created = await first.inject({
      method: "POST",
      url: "/api/collections/planItems",
      payload: { title: "手动保存验证", plan_date: "2026-08-02" },
    });
    expect(created.statusCode).toBe(201);
    expect(fs.statSync(`${dataFile}-wal`).size).toBeGreaterThan(0);

    const saved = await first.inject({ method: "POST", url: "/api/system/save" });
    expect(saved.statusCode).toBe(200);
    expect(saved.json().data).toMatchObject({ database: "ok", dataFile });
    expect(new Date(saved.json().data.savedAt).toISOString()).toBe(saved.json().data.savedAt);
    expect(fs.existsSync(`${dataFile}-wal`) ? fs.statSync(`${dataFile}-wal`).size : 0).toBe(0);
    await first.close();

    const second = await buildApp({ dataDir: directory, autoBackup: false });
    try {
      const state = await second.inject({ method: "GET", url: "/api/state" });
      expect(state.json().data.planItems).toEqual(expect.arrayContaining([
        expect.objectContaining({ title: "手动保存验证" }),
      ]));
    } finally {
      await second.close();
    }
  });

  it("creates the complete first schema and uses the date/status index", () => {
    directory = makeTestDirectory("schema");
    const manager = new DatabaseManager(getAppPaths(directory));
    try {
      const tables = manager.db.prepare("SELECT name FROM sqlite_schema WHERE type = 'table'").all() as Array<{ name: string }>;
      const names = tables.map((row) => row.name);
      expect(names).toEqual(expect.arrayContaining(["plan_items", "media_contents", "dev_projects", "consulting_projects", "meals", "calendar_events", "learning_subjects", "learning_plans", "learning_sessions", "trash_entries"]));
      expect(names).not.toContain("workouts");
      expect(names).not.toContain("entertainment_items");
      const plan = manager.db.prepare("EXPLAIN QUERY PLAN SELECT * FROM plan_items WHERE plan_date = ? AND status = ? AND deleted_at IS NULL").all("2026-08-02", "todo") as Array<{ detail: string }>;
      expect(plan.some((row) => row.detail.includes("idx_plan_items_date_status"))).toBe(true);
    } finally {
      manager.close();
    }
  });

  it("upgrades an existing database by removing retired modules and adding calendar and learning tables", () => {
    directory = makeTestDirectory("upgrade");
    const oldMigrations = path.join(directory, "old-migrations");
    fs.mkdirSync(oldMigrations, { recursive: true });
    fs.copyFileSync(
      path.resolve("database/migrations/001_initial.sql"),
      path.join(oldMigrations, "001_initial.sql"),
    );

    const paths = getAppPaths(directory);
    const oldManager = new DatabaseManager(paths, oldMigrations);
    try {
      oldManager.db.prepare(`
        INSERT INTO workout_templates(id, name, weekday, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run("existing-template", "原有训练模板", 1, "升级后应被移除", "2026-08-01T08:00:00.000Z", "2026-08-01T08:00:00.000Z");
      oldManager.db.prepare(`
        INSERT INTO plan_items(id, title, plan_date, priority, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run("kept-plan", "应保留的计划", "2026-08-02", "medium", "2026-08-01T08:00:00.000Z", "2026-08-01T08:00:00.000Z");
    } finally {
      oldManager.close();
    }

    const upgradedManager = new DatabaseManager(paths);
    try {
      const tables = upgradedManager.db.prepare("SELECT name FROM sqlite_schema WHERE type = 'table'").all() as Array<{ name: string }>;
      const names = tables.map((row) => row.name);
      expect(names).not.toContain("workout_templates");
      expect(names).not.toContain("entertainment_items");
      expect(names).toContain("calendar_events");
      expect(names).toContain("learning_subjects");
      const plan = upgradedManager.db.prepare("SELECT title FROM plan_items WHERE id = ?").get("kept-plan") as { title: string };
      expect(plan.title).toBe("应保留的计划");
      const versions = upgradedManager.db.prepare(
        "SELECT version FROM schema_migrations ORDER BY version",
      ).all() as Array<{ version: string }>;
      expect(versions.at(-1)?.version).toBe("008_learning.sql");
    } finally {
      upgradedManager.close();
    }
  });

  it("surfaces a real SQLite write failure instead of pretending to save", () => {
    directory = makeTestDirectory("readonly");
    const manager = new DatabaseManager(getAppPaths(directory));
    const store = new AppStore(manager);
    try {
      manager.db.pragma("query_only = ON");
      expect(() => store.create("planItems", { title: "不能写入", plan_date: "2026-08-02" })).toThrow(/readonly|read-only/i);
      expect(store.list("planItems")).toHaveLength(0);
    } finally {
      manager.db.pragma("query_only = OFF");
      manager.close();
    }
  });
});
