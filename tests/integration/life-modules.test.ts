// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../server/app.js";
import { makeTestDirectory, removeTestDirectory } from "../helpers.js";

let directory = "";
let app: FastifyInstance;
beforeEach(async () => { directory = makeTestDirectory("life-modules"); app = await buildApp({ dataDir: directory, autoBackup: false }); });
afterEach(async () => { await app.close(); removeTestDirectory(directory); });

async function create(collection: string, payload: Record<string, any>) {
  const response = await app.inject({ method: "POST", url: `/api/collections/${collection}`, payload });
  expect(response.statusCode).toBe(201);
  return response.json().data;
}

describe("specialized life modules", () => {
  it("keeps calendar events organized by date with start and end time", async () => {
    const morning = await create("calendarEvents", { title: "晨间评审", event_date: "2026-10-06", start_time: "09:00", end_time: "10:30", description: "回顾里程碑与本周重点", status: "todo" });
    await create("calendarEvents", { title: "下午同步", event_date: "2026-10-06", start_time: "15:00", description: "与团队对齐", status: "todo" });
    await app.inject({ method: "PATCH", url: `/api/collections/calendarEvents/${morning.id}`, payload: { status: "done", completed_at: "2026-10-06T10:30:00.000Z" } });
    const state = (await app.inject({ method: "GET", url: "/api/state" })).json().data;
    expect(state.calendarEvents).toHaveLength(2);
    const updated = state.calendarEvents.find((item: any) => item.id === morning.id);
    expect(updated).toMatchObject({ status: "done", start_time: "09:00", end_time: "10:30" });
    expect(state.calendarEvents.every((item: any) => item.event_date === "2026-10-06")).toBe(true);
  });

  it("stores planned meals separately from actual intake and preserves unknown nutrition", async () => {
    await create("nutritionTargets", { effective_date: "2026-08-01", calories: 2150, protein: 132, carbs: 240, fat: 65 });
    const rice = await create("foods", { name: "米饭", default_portion: 150, portion_unit: "克", calories: 174, protein: 3.9, carbs: 38.4 });
    const planned = await create("meals", { meal_date: "2026-08-02", meal_type: "lunch", name: "鸡胸肉饭", entry_kind: "planned" });
    const actual = await create("meals", { meal_date: "2026-08-02", meal_type: "lunch", name: "实际午餐", entry_kind: "actual" });
    await create("mealItems", { meal_id: planned.id, food_id: rice.id, food_name: "米饭", quantity: 1, calories: 174, protein: 3.9, carbs: 38.4 });
    await create("mealItems", { meal_id: actual.id, food_name: "餐厅时蔬", quantity: 1, calories: null, protein: null });
    const state = (await app.inject({ method: "GET", url: "/api/state" })).json().data;
    expect(state.meals.map((item: any) => item.entry_kind).sort()).toEqual(["actual", "planned"]);
    expect(state.mealItems.find((item: any) => item.food_name === "餐厅时蔬")).toMatchObject({ calories: null, protein: null });
    expect(state.nutritionTargets[0].protein).toBe(132);
  });

  it("tracks learning subjects, plans and sessions with progress but no overdue attention", async () => {
    const subject = await create("learningSubjects", { name: "英语", goal: "达到日常交流水平", status: "active" });
    const plan = await create("learningPlans", { subject_id: subject.id, title: "词汇第一阶段", content: "核心词汇 300 词", plan_date: "2026-10-08", estimated_minutes: 60, status: "todo", progress: 0 });
    await create("learningSessions", { plan_id: plan.id, session_date: "2026-10-06", minutes: 45, note: "完成前 100 词" });
    await app.inject({ method: "PATCH", url: `/api/collections/learningPlans/${plan.id}`, payload: { progress: 50 } });
    const state = (await app.inject({ method: "GET", url: "/api/state" })).json().data;
    expect(state.learningSubjects[0]).toMatchObject({ name: "英语", status: "active" });
    expect(state.learningPlans[0]).toMatchObject({ progress: 50, estimated_minutes: 60 });
    expect(state.learningSessions[0]).toMatchObject({ minutes: 45, note: "完成前 100 词" });
    const dashboard = (await app.inject({ method: "GET", url: "/api/dashboard?date=2026-10-03" })).json().data;
    expect(dashboard.attention.some((item: any) => item.module === "learning")).toBe(false);
  });
});
