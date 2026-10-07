import { useMemo, useState } from "react";
import { Plus, Check, Clock, Trash, CalendarPlus, PencilSimple, Timer } from "@phosphor-icons/react";
import { api } from "../api";
import { useWorkspace } from "../WorkspaceContext";
import { localDate, formatDate, formatDuration, classNames } from "../utils";
import { Badge, Button, EmptyState, EntityForm, Modal, PageHeader, Section, type FieldDefinition } from "../components/ui";
import { ModuleArtwork } from "../components/ModuleArtwork";

const subjectFields: FieldDefinition[] = [
  { name: "name", label: "科目名称", required: true, placeholder: "例如：英语、编程、吉他" },
  { name: "goal", label: "学习目标", type: "textarea", placeholder: "想学会什么、达到什么水平……" },
  { name: "status", label: "状态", type: "select", required: true, options: [{ value: "active", label: "学习中" }, { value: "paused", label: "暂停" }, { value: "completed", label: "已完成" }] },
  { name: "notes", label: "备注", type: "textarea" },
];

const planFields: FieldDefinition[] = [
  { name: "title", label: "计划标题", required: true, placeholder: "例如：阶段一 · 打基础" },
  { name: "content", label: "学习内容", type: "textarea", placeholder: "要学习的内容、章节、任务或要点……" },
  { name: "plan_date", label: "计划日期", type: "date" },
  { name: "start_time", label: "开始时间", type: "time" },
  { name: "estimated_minutes", label: "预计时长（分钟）", type: "number" },
  { name: "notes", label: "完成标志 / 备注", type: "textarea" },
];

const progressSteps = [0, 25, 50, 75, 100];

export function LearningPage() {
  const { data, run } = useWorkspace();
  const [subjectId, setSubjectId] = useState<string | null>(data.learningSubjects[0]?.id ?? null);
  const [dialog, setDialog] = useState<{ type: string; item?: Record<string, any> } | null>(null);

  const subject = data.learningSubjects.find((item) => item.id === subjectId);
  const plans = useMemo(() => data.learningPlans.filter((item) => item.subject_id === subjectId).sort((a, b) => (a.plan_date || "9999-99-99").localeCompare(b.plan_date || "9999-99-99")), [data.learningPlans, subjectId]);
  const sessions = useMemo(() => data.learningSessions.filter((item) => plans.some((plan) => plan.id === item.plan_id)).sort((a, b) => b.session_date.localeCompare(a.session_date)), [data.learningSessions, plans]);
  const subjectMinutes = useMemo(() => sessions.reduce((sum, item) => sum + Number(item.minutes || 0), 0), [sessions]);
  const subjectProgress = plans.length ? Math.round(plans.reduce((sum, item) => sum + Number(item.progress || 0), 0) / plans.length) : 0;
  const doneCount = plans.filter((item) => item.status === "done").length;

  const close = () => setDialog(null);

  return (
    <div>
      <PageHeader icon={<ModuleArtwork module="learning" />} eyebrow="计划与进度" title="学习" description="建立学习科目，按计划安排学习内容与时间，并持续跟踪进度。" actions={<><Button variant="secondary" onClick={() => setDialog({ type: "subject" })}><Plus size={17} />添加科目</Button>{subject ? <Button onClick={() => setDialog({ type: "plan" })}><Plus size={17} />编制学习计划</Button> : null}</>} />
      {data.learningSubjects.length === 0 ? <EmptyState title="还没有学习科目" description="添加一个科目后，即可为它编制学习计划和记录进度。" action={<Button onClick={() => setDialog({ type: "subject" })}>添加第一个科目</Button>} /> : <div className="workspace-split">
        <aside className="project-rail"><span className="rail-label">科目</span>{data.learningSubjects.map((item) => <button key={item.id} className={subjectId === item.id ? "active" : ""} onClick={() => setSubjectId(item.id)}><div><strong>{item.name}</strong><small>{item.goal || "没有学习目标"}</small></div><Badge tone={item.status === "active" ? "success" : "neutral"}>{item.status === "active" ? "学习中" : item.status === "completed" ? "已完成" : "暂停"}</Badge></button>)}</aside>
        <div className="workspace-detail">
          {subject ? <>
            <div className="detail-hero"><div><span className="eyebrow">当前科目</span><h2>{subject.name}</h2><p>{subject.goal || "尚未填写学习目标。"}</p><div className="learning-stats"><span><strong>{plans.length}</strong><small>计划</small></span><span><strong>{doneCount}</strong><small>已完成</small></span><span><strong>{subjectProgress}%</strong><small>整体进度</small></span><span><strong>{formatDuration(subjectMinutes)}</strong><small>已投入</small></span></div></div><div className="detail-actions"><Button variant="ghost" size="sm" onClick={() => setDialog({ type: "subject", item: subject })}>编辑科目</Button></div></div>
            <Section title="学习计划" description="按时间安排学习内容，并标记进度" action={<Button variant="ghost" size="sm" onClick={() => setDialog({ type: "plan" })}><Plus size={15} />编制计划</Button>}>
              {plans.length ? <div className="plan-list">{plans.map((plan) => <LearningPlanRow key={plan.id} plan={plan} onEdit={() => setDialog({ type: "plan", item: plan })} onProgress={(progress: number) => run(() => api.update("learningPlans", plan.id, { progress, status: progress >= 100 ? "done" : plan.status, completed_at: progress >= 100 ? new Date().toISOString() : plan.completed_at }))} onDone={() => run(() => api.update("learningPlans", plan.id, { status: "done", progress: 100, completed_at: new Date().toISOString() }))} onSession={() => setDialog({ type: "session", item: plan })} onPlan={() => run(() => api.create("planItems", { title: "学习：" + plan.title, plan_date: plan.plan_date || localDate(), start_time: plan.start_time || null, estimated_minutes: plan.estimated_minutes || null, source_module: "learning", source_entity_type: "learning_plan", source_entity_id: plan.id, priority: "medium" }))} onDelete={() => run(() => api.remove("learningPlans", plan.id))} />)}</div> : <EmptyState title="还没有学习计划" description="为这个科目编制学习内容与时间安排。" action={<Button variant="secondary" size="sm" onClick={() => setDialog({ type: "plan" })}>编制第一个计划</Button>} />}
            </Section>
            <Section title="学习记录" description="按日期记录每次投入的学习时长" action={<Button variant="ghost" size="sm" disabled={!plans.length} onClick={() => setDialog({ type: "session" })}><Timer size={15} />记录学习</Button>}>
              {sessions.length ? <div className="session-list">{sessions.slice(0, 12).map((session) => { const plan = plans.find((value) => value.id === session.plan_id); return <article key={session.id}><div><strong>{plan?.title || "已删除计划"}</strong><small>{formatDate(session.session_date)}</small></div><span>{formatDuration(session.minutes)}</span><p>{session.note || "没有补充说明"}</p></article>; })}</div> : <p className="quiet-line">还没有学习记录，用“记录学习”追踪每次投入的时间。</p>}
            </Section>
          </> : null}
        </div>
      </div>}
      <LearningDialog dialog={dialog} subject={subject} plans={plans} close={close} run={run} />
    </div>
  );
}

function LearningPlanRow({ plan, onEdit, onProgress, onDone, onSession, onPlan, onDelete }: any) {
  const done = plan.status === "done";
  const progress = Number(plan.progress || 0);
  return (
    <article className={classNames("plan-card", done && "is-done")}>
      <div className="plan-card-head">
        <div className="plan-copy"><strong>{plan.title}</strong><Badge tone={done ? "success" : progress > 0 ? "accent" : "neutral"}>{done ? "已完成" : progress > 0 ? progress + "%" : "未开始"}</Badge></div>
        <div className="plan-actions">
          <Button variant="ghost" size="sm" onClick={() => void onPlan()}><CalendarPlus size={15} />安排到今天</Button>
          <Button variant="ghost" size="sm" onClick={() => void onSession()}><Timer size={15} />记录学习</Button>
          <Button variant="ghost" size="sm" onClick={onEdit}><PencilSimple size={15} />编辑</Button>
          {!done ? <Button variant="ghost" size="sm" onClick={() => void onDone()}><Check size={15} />完成</Button> : null}
          <Button variant="ghost" size="sm" className="danger-text" onClick={() => void onDelete()}><Trash size={15} /></Button>
        </div>
      </div>
      <p className="plan-card-content">{plan.content || "没有填写学习内容。"}</p>
      <div className="plan-card-meta"><span>{plan.plan_date ? formatDate(plan.plan_date) : "未设日期"}</span>{plan.start_time ? <span><Clock size={13} />{plan.start_time}</span> : null}<span><Timer size={13} />{formatDuration(plan.estimated_minutes)}</span></div>
      <div className="progress-block">
        <div className="progress-track"><span style={{ width: progress + "%" }} /></div>
        <div className="progress-step">{progressSteps.map((step) => <button key={step} className={progress === step ? "active" : ""} onClick={() => void onProgress(step)}>{step === 100 ? "完成" : step + "%"}</button>)}</div>
      </div>
    </article>
  );
}

function LearningDialog({ dialog, subject, plans, close, run }: any) {
  if (!dialog) return null;
  if (dialog.type === "subject") {
    const title = dialog.item?.id ? "编辑科目" : "添加科目";
    return <Modal open title={title} description="科目用来组织同一方向的学习计划。" onClose={close}><EntityForm fields={subjectFields} initial={{ status: "active", ...dialog.item }} onCancel={close} onSubmit={async (values) => { if (dialog.item?.id) await run(() => api.update("learningSubjects", dialog.item.id, values)); else await run(() => api.create("learningSubjects", values)); close(); }} /></Modal>;
  }
  if (dialog.type === "plan") {
    const title = dialog.item?.id ? "编辑学习计划" : "编制学习计划";
    return <Modal open title={title} description="填写要学习的内容与时间安排。" onClose={close}><EntityForm fields={planFields} initial={{ plan_date: localDate(), ...dialog.item }} onCancel={close} onSubmit={async (values) => { const payload = { ...values, subject_id: subject?.id, start_time: values.start_time || null, plan_date: values.plan_date || null, estimated_minutes: values.estimated_minutes || null }; if (dialog.item?.id) await run(() => api.update("learningPlans", dialog.item.id, payload)); else await run(() => api.create("learningPlans", payload)); close(); }} /></Modal>;
  }
  if (dialog.type === "session") {
    const planId = dialog.item?.id ?? plans[0]?.id;
    return <Modal open title="记录学习" description="记录一次学习投入的时间与备注。" onClose={close}><EntityForm fields={[{ name: "plan_id", label: "学习计划", type: "select", required: true, options: plans.map((item: any) => ({ value: item.id, label: item.title })) }, { name: "session_date", label: "日期", type: "date", required: true }, { name: "minutes", label: "时长（分钟）", type: "number", required: true }, { name: "note", label: "备注", type: "textarea" }]} initial={{ plan_id: planId, session_date: localDate(), minutes: 30 }} onCancel={close} onSubmit={async (values) => { await run(() => api.create("learningSessions", values)); close(); }} /></Modal>;
  }
  return null;
}
