-- 移除健身计划模块与游戏娱乐模块的数据表
-- 保留迁移记录以维持备份恢复兼容；表由本迁移彻底删除。

DROP TABLE IF EXISTS play_sessions;
DROP TABLE IF EXISTS entertainment_items;
DROP TABLE IF EXISTS body_metrics;
DROP TABLE IF EXISTS workout_sets;
DROP TABLE IF EXISTS workout_exercises;
DROP TABLE IF EXISTS workouts;
DROP TABLE IF EXISTS workout_template_exercises;
DROP TABLE IF EXISTS workout_templates;

-- 清理回收站中指向已删除模块的记录
DELETE FROM trash_entries
WHERE collection IN (
  'entertainmentItems', 'playSessions',
  'bodyMetrics', 'workoutSets', 'workoutExercises',
  'workouts', 'workoutTemplateExercises', 'workoutTemplates'
);

-- 清理来源模块已删除的今日计划项
DELETE FROM plan_items
WHERE source_module IN ('fitness', 'entertainment')
   OR source_entity_type IN ('workout', 'entertainment_item');
