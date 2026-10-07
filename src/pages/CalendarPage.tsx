import { useMemo, useState } from "react";
import { Plus, Check, Clock, Trash, CalendarPlus, PencilSimple } from "@phosphor-icons/react";
import { api } from "../api";
import { useWorkspace } from "../WorkspaceContext";
import { localDate, formatDate, classNames } from "../utils";
import { Badge, Button, EmptyState, EntityForm, Modal, PageHeader, Section, type FieldDefinition } from "../components/ui";
import { ModuleArtwork } from "../components/ModuleArtwork";
import { MonthCalendar } from "../components/MonthCalendar";

const eventFields: FieldDefinition[] = [
  { name: "title", label: "主题", required: true, placeholder: "例如：项目评审会" },
  { name: "event_date", label: "日期", type: "date", required: true },
  { name: "start_time", label: "计划开始时间", type: "time" },
  { name: "end_time", label: "计划完成时间", type: "time" },
  { name: "description", label: "主要内容描述", type: "textarea", placeholder: "说明要完成的事情、目标或要点……" },
  { name: "notes", label: "备注", type: "textarea" },
  { name: "status", label: "状态", type: "select", required: true, options: [{ value: "todo", label: "待办" }, { value: "done", label: "已完成" }] },
];

export function CalendarPage() {
  const { data, run } = useWorkspace();
  const today = localDate();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selectedDate, setSelectedDate] = useState(today);
  const [dialog, setDialog] = useState<{ event?: Record<string, any>; date?: string } | null>(null);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, Record<string, any>[]>();
    for (const event of data.calendarEvents) {
      const list = map.get(event.event_date) ?? [];
      list.push(event);
      map.set(event.event_date, list);
    }
    for (const list of map.values()) list.sort((a, b) => (a.start_time || "99:99").localeCompare(b.start_time || "99:99"));
    return map;
  }, [data.calendarEvents]);

  const selectedEvents = (eventsByDate.get(selectedDate) ?? []).sort((a, b) => (a.start_time || "99:99").localeCompare(b.start_time || "99:99"));
  const openAdd = (date: string) => setDialog({ date });
  const openEdit = (event: Record<string, any>) => setDialog({ event });
  const close = () => setDialog(null);

  return (
    <div>
      <PageHeader icon={<ModuleArtwork module="calendar" />} eyebrow="按日规划" title="日历" description="点击日期查看并添加当日待办；双击日期快速新建待办事项。" actions={<Button onClick={() => openAdd(selectedDate)}><Plus size={17} />添加待办</Button>} />
      <Section title="月视图" description="双击任意日期可快速新增当日待办" action={<Button variant="ghost" size="sm" onClick={() => { setMonth(today.slice(0, 7)); setSelectedDate(today); }}>回到今天</Button>}>
        <MonthCalendar
          month={month}
          selectedDate={selectedDate}
          onMonthChange={setMonth}
          onSelectDate={(date) => { setSelectedDate(date); if (date.slice(0, 7) !== month) setMonth(date.slice(0, 7)); }}
          onDoubleClickDay={openAdd}
          renderDay={(date) => {
            const items = eventsByDate.get(date) ?? [];
            if (!items.length) return null;
            return <>{items.slice(0, 2).map((event) => <div className={classNames("calendar-entry", event.status === "done" && "calendar-entry-done")} key={event.id}><strong>{event.start_time ? `${event.start_time} ${event.title}` : event.title}</strong><span>{event.description || (event.end_time ? `至 ${event.end_time}` : "待办")}</span></div>)}{items.length > 2 ? <small className="calendar-more">另有 {items.length - 2} 项</small> : null}</>;
          }}
        />
        <div className="calendar-selected-detail">
          <header>
            <div><span>选中日期</span><strong>{formatDate(selectedDate)}</strong></div>
            <div className="detail-actions"><Badge tone={selectedEvents.some((item) => item.status === "done") ? "success" : "neutral"}>{selectedEvents.length} 项待办</Badge><Button variant="secondary" size="sm" onClick={() => openAdd(selectedDate)}><Plus size={15} />添加待办</Button></div>
          </header>
          {selectedEvents.length ? <div className="calendar-detail-list">{selectedEvents.map((event) => <CalendarEventRow key={event.id} event={event} onEdit={() => openEdit(event)} onToggle={() => run(() => api.update("calendarEvents", event.id, { status: event.status === "done" ? "todo" : "done", completed_at: event.status === "done" ? null : new Date().toISOString() }))} onDelete={() => run(() => api.remove("calendarEvents", event.id))} onPlan={() => run(() => api.create("planItems", { title: event.title, plan_date: event.event_date, start_time: event.start_time || null, notes: event.description || "", source_module: "calendar", source_entity_type: "calendar_event", source_entity_id: event.id, priority: "medium" }))} />)}</div> : <p className="quiet-line">这一天还没有待办事项，点击“添加待办”或双击日历日期新增。</p>}
        </div>
      </Section>
      <CalendarDialog dialog={dialog} close={close} run={run} />
    </div>
  );
}

function CalendarEventRow({ event, onEdit, onToggle, onDelete, onPlan }: { event: Record<string, any>; onEdit: () => void; onToggle: () => Promise<any>; onDelete: () => Promise<any>; onPlan: () => Promise<any> }) {
  const done = event.status === "done";
  return (
    <article className={classNames("calendar-event-row", done && "is-done")}>
      <button className="complete-control" aria-label={done ? "已完成" : "标记完成"} disabled={done} onClick={() => void onToggle()}>{done ? <Check size={14} weight="bold" /> : null}</button>
      <div className="work-copy">
        <button onClick={onEdit}>{event.title}</button>
        <small>{event.start_time ? <><Clock size={13} />{event.start_time}{event.end_time ? ` – ${event.end_time}` : ""}</> : "未设置时间"}{event.description ? ` · ${event.description}` : ""}</small>
      </div>
      <button className="icon-button" title="加入今日计划" onClick={() => void onPlan()}><CalendarPlus size={17} /></button>
      <button className="icon-button" title="编辑" onClick={onEdit}><PencilSimple size={17} /></button>
      <button className="icon-button danger-text" title="移到回收站" onClick={() => void onDelete()}><Trash size={17} /></button>
    </article>
  );
}

function CalendarDialog({ dialog, close, run }: { dialog: { event?: Record<string, any>; date?: string } | null; close: () => void; run: <T>(operation: () => Promise<T>) => Promise<T> }) {
  if (!dialog) return null;
  const event = dialog.event;
  const editing = Boolean(event);
  const defaults: Record<string, any> = { event_date: dialog.date ?? event?.event_date ?? localDate(), status: "todo" };
  return (
    <Modal open title={editing ? "编辑待办" : "添加待办"} description={editing ? "修改这条待办事项的内容。" : `为 ${formatDate(dialog.date ?? localDate())} 安排一条待办事项。`} onClose={close}>
      <EntityForm
        fields={eventFields}
        initial={{ ...defaults, ...event }}
        onCancel={close}
        onSubmit={async (values) => {
          const payload = { ...values, start_time: values.start_time || null, end_time: values.end_time || null, description: values.description || "" };
          if (editing && event?.id) await run(() => api.update("calendarEvents", event.id, payload));
          else await run(() => api.create("calendarEvents", payload));
          close();
        }}
      />
    </Modal>
  );
}
