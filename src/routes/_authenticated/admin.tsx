import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useDialect } from "@/hooks/use-dialect";
import { cn } from "@/lib/utils";
import {
  getIsAdmin,
  adminListLessons,
  adminListCourses,
  adminListVocab,
  adminListVideos,
  adminListBooks,
  adminListUsers,
  adminUpsertLesson,
  adminDeleteLesson,
  adminUpsertCourse,
  adminDeleteCourse,
  adminUpsertVocab,
  adminDeleteVocab,
  adminUpsertVideo,
  adminDeleteVideo,
  adminUpsertBook,
  adminDeleteBook,
  adminSetUserRole,
  transcribeVideoFile,
  translateTranscriptLines,
  generateWordMeaning,
  extractBookPages,
} from "@/lib/admin.functions";
import { supabase } from "@/integrations/supabase/client";
import { BannerEditorDialog } from "@/components/banner-editor";

export const Route = createFileRoute("/_authenticated/admin")({
  ssr: false,
  beforeLoad: async ({ context }) => {
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: context.user.id, _role: "admin" });
    if (!isAdmin) throw redirect({ to: "/dashboard" });
  },
  component: AdminPage,
});

type Tab = "lessons" | "vocab" | "videos" | "books" | "users";
const LANGS = ["en", "de", "ar", "ko"] as const;
const CEFRS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;

function AdminPage() {
  const { t } = useDialect();
  const [tab, setTab] = useState<Tab>("lessons");
  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-3xl font-display font-bold">{t("admin")}</h1>
      </div>
      <div className="mb-6 flex gap-2 flex-wrap">
        {(["lessons", "vocab", "videos", "books", "users"] as Tab[]).map((v) => (
          <Button key={v} variant={tab === v ? "default" : "outline"} onClick={() => setTab(v)}>
            {t(`admin_${v}` as never)}
          </Button>
        ))}
      </div>
      {tab === "lessons" && <LessonsTab />}
      {tab === "vocab" && <VocabTab />}
      {tab === "videos" && <VideosTab />}
      {tab === "books" && <BooksTab />}
      {tab === "users" && <UsersTab />}
    </AppShell>
  );
}

function LangCefrPicker({ lang, setLang, cefr, setCefr }: { lang: string; setLang: (v: string) => void; cefr: string; setCefr: (v: string) => void }) {
  return (
    <div className="flex gap-2 mb-4">
      <Select value={lang} onValueChange={setLang}>
        <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
        <SelectContent>{LANGS.map((l) => <SelectItem key={l} value={l}>{l.toUpperCase()}</SelectItem>)}</SelectContent>
      </Select>
      <Select value={cefr} onValueChange={setCefr}>
        <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
        <SelectContent>{CEFRS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
}

function LessonsTab() {
  const [lang, setLang] = useState("en");
  const [cefr, setCefr] = useState("A1");
  const [activeCourse, setActiveCourse] = useState<null | { id: string; title_sorani: string; level_id: string }>(null);

  return (
    <div>
      <LangCefrPicker
        lang={lang}
        setLang={(v) => { setLang(v); setActiveCourse(null); }}
        cefr={cefr}
        setCefr={(v) => { setCefr(v); setActiveCourse(null); }}
      />
      {activeCourse ? (
        <CourseLessonsPanel course={activeCourse} onBack={() => setActiveCourse(null)} />
      ) : (
        <CoursesPanel lang={lang} cefr={cefr} onOpenCourse={setActiveCourse} />
      )}
    </div>
  );
}

function CoursesPanel({ lang, cefr, onOpenCourse }: {
  lang: string;
  cefr: string;
  onOpenCourse: (c: { id: string; title_sorani: string; level_id: string }) => void;
}) {
  const { t } = useDialect();
  const qc = useQueryClient();
  const list = useServerFn(adminListCourses);
  const upsert = useServerFn(adminUpsertCourse);
  const del = useServerFn(adminDeleteCourse);
  const q = useQuery({ queryKey: ["admin-courses", lang, cefr], queryFn: () => list({ data: { language: lang as never, cefr: cefr as never } }) });
  const [editing, setEditing] = useState<null | Record<string, unknown>>(null);
  const [open, setOpen] = useState(false);

  const save = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => upsert({ data: payload as never }),
    onSuccess: () => { toast.success(t("saved")); qc.invalidateQueries({ queryKey: ["admin-courses"] }); setOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success(t("deleted")); qc.invalidateQueries({ queryKey: ["admin-courses"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const openNew = () => {
    if (!q.data?.levelId) { toast.error("No level for this language/CEFR. Add one in the database first."); return; }
    setEditing({
      level_id: q.data.levelId,
      order_index: (q.data.courses.length ?? 0),
      title_sorani: "", title_badini: "", title_en: "",
      description_sorani: "", description_badini: "", description_en: "",
    });
    setOpen(true);
  };

  return (
    <div>
      <p className="text-sm text-muted-foreground mb-3">Themed units within {cefr} — e.g. "Greetings and Introductions", "Personal Information". Click a course to manage its lessons.</p>
      <div className="flex justify-end mb-4"><Button onClick={openNew}>{t("add_new")}</Button></div>
      <div className="grid gap-3">
        {(q.data?.courses ?? []).length === 0 && <p className="text-muted-foreground">{t("no_data")}</p>}
        {(q.data?.courses ?? []).map((c) => (
          <Card key={c.id}>
            <CardContent className="p-4 flex justify-between items-center gap-3">
              <button type="button" className="text-left flex-1 min-w-0" onClick={() => onOpenCourse({ id: c.id, title_sorani: c.title_sorani, level_id: c.level_id })}>
                <div className="font-medium">{c.order_index + 1}. {c.title_sorani}{c.title_en ? ` (${c.title_en})` : ""}</div>
                <div className="text-sm text-muted-foreground">{c.title_badini} · {(c.lessons ?? []).length} lesson{(c.lessons ?? []).length === 1 ? "" : "s"}</div>
              </button>
              <div className="flex gap-2 shrink-0">
                <Button variant="outline" size="sm" onClick={() => { setEditing(c as unknown as Record<string, unknown>); setOpen(true); }}>{t("edit")}</Button>
                <Button variant="destructive" size="sm" onClick={() => { if (confirm(t("confirm_delete"))) remove.mutate(c.id); }}>{t("delete")}</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Course</DialogTitle></DialogHeader>
          {editing && <CourseForm value={editing} onChange={setEditing} />}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => editing && save.mutate(editing)} disabled={save.isPending}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CourseForm({ value, onChange }: { value: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void }) {
  const set = (k: string, v: unknown) => onChange({ ...value, [k]: v });
  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div><Label>Order</Label><Input type="number" value={value.order_index as number} onChange={(e) => set("order_index", Number(e.target.value))} /></div>
        <div><Label>Title (Sorani)</Label><Input value={(value.title_sorani ?? "") as string} onChange={(e) => set("title_sorani", e.target.value)} /></div>
      </div>
      <div><Label>Title (Badini)</Label><Input value={(value.title_badini ?? "") as string} onChange={(e) => set("title_badini", e.target.value)} /></div>
      <div><Label>Title (English)</Label><Input placeholder="e.g. Greetings and Introductions" value={(value.title_en ?? "") as string} onChange={(e) => set("title_en", e.target.value)} /></div>
      <div><Label>Description (Sorani)</Label><Textarea value={(value.description_sorani ?? "") as string} onChange={(e) => set("description_sorani", e.target.value)} /></div>
      <div><Label>Description (Badini)</Label><Textarea value={(value.description_badini ?? "") as string} onChange={(e) => set("description_badini", e.target.value)} /></div>
      <div><Label>Description (English)</Label><Textarea value={(value.description_en ?? "") as string} onChange={(e) => set("description_en", e.target.value)} /></div>
    </div>
  );
}

function CourseLessonsPanel({ course, onBack }: { course: { id: string; title_sorani: string; level_id: string }; onBack: () => void }) {
  const { t } = useDialect();
  const qc = useQueryClient();
  const list = useServerFn(adminListLessons);
  const upsert = useServerFn(adminUpsertLesson);
  const del = useServerFn(adminDeleteLesson);
  const q = useQuery({ queryKey: ["admin-lessons", course.id], queryFn: () => list({ data: { courseId: course.id } }) });
  const [editing, setEditing] = useState<null | Record<string, unknown>>(null);
  const [open, setOpen] = useState(false);

  const save = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => upsert({ data: payload as never }),
    onSuccess: () => { toast.success(t("saved")); qc.invalidateQueries({ queryKey: ["admin-lessons"] }); setOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success(t("deleted")); qc.invalidateQueries({ queryKey: ["admin-lessons"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const openNew = () => {
    setEditing({
      course_id: course.id,
      level_id: course.level_id,
      order_index: (q.data?.lessons.length ?? 0),
      title_sorani: "", title_badini: "", title_en: "",
      dialogue_json: [],
    });
    setOpen(true);
  };

  return (
    <div>
      <button onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground mb-3">← Back to courses</button>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-lg font-semibold">{course.title_sorani}</h3>
        <Button onClick={openNew}>{t("add_new")}</Button>
      </div>
      <div className="grid gap-3">
        {(q.data?.lessons ?? []).length === 0 && <p className="text-muted-foreground">{t("no_data")}</p>}
        {(q.data?.lessons ?? []).map((l) => (
          <Card key={l.id}>
            <CardContent className="p-4 flex justify-between items-center">
              <div>
                <div className="font-medium">{l.order_index + 1}. {l.title_sorani}</div>
                <div className="text-sm text-muted-foreground">{l.title_badini}</div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => { setEditing(l as unknown as Record<string, unknown>); setOpen(true); }}>{t("edit")}</Button>
                <Button variant="destructive" size="sm" onClick={() => { if (confirm(t("confirm_delete"))) remove.mutate(l.id); }}>{t("delete")}</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t("admin_lessons")}</DialogTitle></DialogHeader>
          {editing && (
            <LessonForm value={editing} onChange={setEditing} />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => editing && save.mutate(editing)} disabled={save.isPending}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LessonForm({ value, onChange }: { value: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void }) {
  const set = (k: string, v: unknown) => onChange({ ...value, [k]: v });
  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div><Label>Order</Label><Input type="number" value={value.order_index as number} onChange={(e) => set("order_index", Number(e.target.value))} /></div>
        <div><Label>Title (Sorani)</Label><Input value={(value.title_sorani ?? "") as string} onChange={(e) => set("title_sorani", e.target.value)} /></div>
      </div>
      <div><Label>Title (Badini)</Label><Input value={(value.title_badini ?? "") as string} onChange={(e) => set("title_badini", e.target.value)} /></div>
      <div><Label>Title (English)</Label><Input value={(value.title_en ?? "") as string} onChange={(e) => set("title_en", e.target.value)} /></div>
      <div><Label>Summary (Sorani)</Label><Textarea value={(value.summary_sorani ?? "") as string} onChange={(e) => set("summary_sorani", e.target.value)} /></div>
      <div><Label>Summary (Badini)</Label><Textarea value={(value.summary_badini ?? "") as string} onChange={(e) => set("summary_badini", e.target.value)} /></div>
      <div><Label>Summary (English)</Label><Textarea value={(value.summary_en ?? "") as string} onChange={(e) => set("summary_en", e.target.value)} /></div>
      <div><Label>Grammar (Sorani, Markdown)</Label><Textarea rows={5} value={(value.grammar_md_sorani ?? "") as string} onChange={(e) => set("grammar_md_sorani", e.target.value)} /></div>
      <div><Label>Grammar (Badini, Markdown)</Label><Textarea rows={5} value={(value.grammar_md_badini ?? "") as string} onChange={(e) => set("grammar_md_badini", e.target.value)} /></div>
      <div><Label>Grammar (English, Markdown)</Label><Textarea rows={5} value={(value.grammar_md_en ?? "") as string} onChange={(e) => set("grammar_md_en", e.target.value)} /></div>
      <div>
        <Label>Dialogue JSON: [{"{"}"speaker","line","translation_ku"{"}"}]</Label>
        <Textarea rows={4} value={JSON.stringify(value.dialogue_json ?? [], null, 2)} onChange={(e) => { try { set("dialogue_json", JSON.parse(e.target.value)); } catch { /* keep typing */ } }} />
      </div>
    </div>
  );
}

function VocabTab() {
  const { t } = useDialect();
  const qc = useQueryClient();
  const [lang, setLang] = useState("en");
  const [cefr, setCefr] = useState("A1");
  const list = useServerFn(adminListVocab);
  const upsert = useServerFn(adminUpsertVocab);
  const del = useServerFn(adminDeleteVocab);
  const q = useQuery({ queryKey: ["admin-vocab", lang, cefr], queryFn: () => list({ data: { language: lang as never, cefr: cefr as never } }) });
  const [editing, setEditing] = useState<null | Record<string, unknown>>(null);
  const [open, setOpen] = useState(false);

  const save = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => upsert({ data: payload as never }),
    onSuccess: () => { toast.success(t("saved")); qc.invalidateQueries({ queryKey: ["admin-vocab"] }); setOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success(t("deleted")); qc.invalidateQueries({ queryKey: ["admin-vocab"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <LangCefrPicker lang={lang} setLang={setLang} cefr={cefr} setCefr={setCefr} />
      <div className="flex justify-end mb-4">
        <Button onClick={() => { setEditing({ language_code: lang, level_cefr: cefr, topic: "general", word: "", kurdish_sorani: "", kurdish_badini: "" }); setOpen(true); }}>{t("add_new")}</Button>
      </div>
      <div className="grid gap-2">
        {(q.data?.words ?? []).length === 0 && <p className="text-muted-foreground">{t("no_data")}</p>}
        {(q.data?.words ?? []).map((w) => (
          <Card key={w.id}>
            <CardContent className="p-3 flex justify-between items-center">
              <div>
                <div className="font-medium">{w.word} <span className="text-muted-foreground text-sm">— {w.kurdish_sorani}</span></div>
                <div className="text-xs text-muted-foreground">{w.topic} · {w.level_cefr}</div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => { setEditing(w as unknown as Record<string, unknown>); setOpen(true); }}>{t("edit")}</Button>
                <Button variant="destructive" size="sm" onClick={() => { if (confirm(t("confirm_delete"))) remove.mutate(w.id); }}>{t("delete")}</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t("admin_vocab")}</DialogTitle></DialogHeader>
          {editing && <VocabForm value={editing} onChange={setEditing} />}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => editing && save.mutate(editing)} disabled={save.isPending}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function VocabForm({ value, onChange }: { value: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void }) {
  const set = (k: string, v: unknown) => onChange({ ...value, [k]: v });
  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div><Label>Language</Label>
          <Select value={value.language_code as string} onValueChange={(v) => set("language_code", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{LANGS.map((l) => <SelectItem key={l} value={l}>{l.toUpperCase()}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>CEFR</Label>
          <Select value={value.level_cefr as string} onValueChange={(v) => set("level_cefr", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{CEFRS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div><Label>Topic</Label><Input value={(value.topic ?? "") as string} onChange={(e) => set("topic", e.target.value)} /></div>
      <div><Label>Word</Label><Input value={(value.word ?? "") as string} onChange={(e) => set("word", e.target.value)} /></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div><Label>Kurdish (Sorani)</Label><Input value={(value.kurdish_sorani ?? "") as string} onChange={(e) => set("kurdish_sorani", e.target.value)} /></div>
        <div><Label>Kurdish (Badini)</Label><Input value={(value.kurdish_badini ?? "") as string} onChange={(e) => set("kurdish_badini", e.target.value)} /></div>
      </div>
      <div><Label>Pronunciation</Label><Input value={(value.pronunciation ?? "") as string} onChange={(e) => set("pronunciation", e.target.value)} /></div>
      <div><Label>Example sentence</Label><Input value={(value.example_sentence ?? "") as string} onChange={(e) => set("example_sentence", e.target.value)} /></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div><Label>Example (Sorani)</Label><Input value={(value.example_sorani ?? "") as string} onChange={(e) => set("example_sorani", e.target.value)} /></div>
        <div><Label>Example (Badini)</Label><Input value={(value.example_badini ?? "") as string} onChange={(e) => set("example_badini", e.target.value)} /></div>
      </div>
      <div><Label>Audio URL</Label><Input value={(value.audio_url ?? "") as string} onChange={(e) => set("audio_url", e.target.value)} /></div>
    </div>
  );
}

function VideosTab() {
  const { t } = useDialect();
  const qc = useQueryClient();
  const [lang, setLang] = useState("en");
  const list = useServerFn(adminListVideos);
  const upsert = useServerFn(adminUpsertVideo);
  const del = useServerFn(adminDeleteVideo);
  const q = useQuery({ queryKey: ["admin-videos", lang], queryFn: () => list({ data: { language: lang as never } }) });
  const [editing, setEditing] = useState<null | Record<string, unknown>>(null);
  const [open, setOpen] = useState(false);

  const save = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => upsert({ data: payload as never }),
    onSuccess: () => { toast.success(t("saved")); qc.invalidateQueries({ queryKey: ["admin-videos"] }); setOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success(t("deleted")); qc.invalidateQueries({ queryKey: ["admin-videos"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <div className="flex gap-2 mb-4 items-center">
        <Select value={lang} onValueChange={setLang}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>{LANGS.map((l) => <SelectItem key={l} value={l}>{l.toUpperCase()}</SelectItem>)}</SelectContent>
        </Select>
        <div className="flex-1" />
        <Button onClick={() => { setEditing({ language_code: lang, level_cefr: "A1", title: "", video_path: "", banner_path: "", youtube_id: "", transcript_json: [] }); setOpen(true); }}>{t("add_new")}</Button>
      </div>
      <div className="grid gap-2">
        {(q.data?.videos ?? []).length === 0 && <p className="text-muted-foreground">{t("no_data")}</p>}
        {(q.data?.videos ?? []).map((v) => (
          <Card key={v.id}>
            <CardContent className="p-3 flex justify-between items-center">
              <div>
                <div className="font-medium">{v.title}</div>
                <div className="text-xs text-muted-foreground">{v.level_cefr} · {v.video_path ? "uploaded" : v.youtube_id ? `YT: ${v.youtube_id}` : "no source"}</div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => { setEditing(v as unknown as Record<string, unknown>); setOpen(true); }}>{t("edit")}</Button>
                <Button variant="destructive" size="sm" onClick={() => { if (confirm(t("confirm_delete"))) remove.mutate(v.id); }}>{t("delete")}</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t("admin_videos")}</DialogTitle></DialogHeader>
          {editing && <VideoForm value={editing} onChange={setEditing} />}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => editing && save.mutate(editing)} disabled={save.isPending}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// A stalled network request (slow connection, a proxy that silently drops a long-running
// upload, an expired session that never resolves, etc.) previously left the video upload
// promise pending forever, so the UI stayed stuck on "Uploading…" with no way to recover
// short of reloading the page. This wraps any promise with a generous but finite ceiling so
// the UI always ends up in a resolved (success) or failed (clear error, retryable) state.
// 12 minutes is intentionally generous — large video files legitimately take a while — this
// only exists as a last-resort safety net, not a normal-path timeout.
const UPLOAD_TIMEOUT_MS = 12 * 60 * 1000;

function withTimeout<T>(promise: Promise<T>, ms: number, timeoutMessage: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(timeoutMessage)), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

function VideoForm({ value, onChange }: { value: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void }) {
  const set = (k: string, v: unknown) => onChange({ ...value, [k]: v });
  const [uploading, setUploading] = useState(false);
  const [uploadElapsed, setUploadElapsed] = useState(0);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [bannerEditor, setBannerEditor] = useState<{ url: string; crossOrigin: boolean; revoke: boolean } | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [translating, setTranslating] = useState(false);
  const transcribe = useServerFn(transcribeVideoFile);
  const translateFn = useServerFn(translateTranscriptLines);

  const onUpload = async (file: File) => {
    if (uploading) return; // guard against a second file being dropped in mid-upload
    setUploading(true);
    const startedAt = Date.now();
    setUploadElapsed(0);
    const tick = setInterval(() => setUploadElapsed(Math.round((Date.now() - startedAt) / 1000)), 1000);
    try {
      const ext = file.name.split(".").pop() || "mp4";
      const path = `${(value.language_code as string) || "en"}/${crypto.randomUUID()}.${ext}`;
      const { error } = await withTimeout(
        supabase.storage.from("videos").upload(path, file, { upsert: false, contentType: file.type }),
        UPLOAD_TIMEOUT_MS,
        "Upload timed out — the connection may have stalled. Please check your internet connection and try again (a smaller/compressed file may help).",
      );
      if (error) throw error;
      // Replacing an existing video: swap in the new path, but only after the new file has
      // fully and successfully uploaded, so a failed/timed-out replacement never clobbers a
      // working video_path. The old file is left in storage untouched (nothing else — the
      // transcript, translations, title, etc. — is modified by this).
      set("video_path", path);
      toast.success("Uploaded");
    } catch (e) {
      toast.error((e as Error).message || "Upload failed. Please try again.");
    } finally {
      clearInterval(tick);
      setUploading(false);
      setUploadElapsed(0);
    }
  };

  const onBannerUpload = async (blob: Blob) => {
    setUploadingBanner(true);
    try {
      const path = `${(value.language_code as string) || "en"}/${crypto.randomUUID()}.jpg`;
      const { error } = await supabase.storage.from("video-banners").upload(path, blob, { upsert: false, contentType: blob.type || "image/jpeg" });
      if (error) throw error;
      set("banner_path", path);
      toast.success("Banner uploaded");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploadingBanner(false);
    }
  };

  const bannerPreviewUrl = value.banner_path
    ? supabase.storage.from("video-banners").getPublicUrl(value.banner_path as string).data.publicUrl
    : null;

  // Selecting a file (or choosing to re-adjust the current banner) opens the
  // mini editor first; the actual upload only happens once the admin confirms
  // the crop/zoom, via onBannerUpload above.
  const openBannerEditorForFile = (file: File) => {
    setBannerEditor({ url: URL.createObjectURL(file), crossOrigin: false, revoke: true });
  };
  const openBannerEditorForCurrent = () => {
    if (bannerPreviewUrl) setBannerEditor({ url: bannerPreviewUrl, crossOrigin: true, revoke: false });
  };
  const closeBannerEditor = () => {
    if (bannerEditor?.revoke) URL.revokeObjectURL(bannerEditor.url);
    setBannerEditor(null);
  };

  const onTranscribe = async () => {
    if (!value.video_path) { toast.error("Upload a video first"); return; }
    setTranscribing(true);
    try {
      const res = await transcribe({ data: { path: value.video_path as string } });
      set("transcript_json", res.lines);
      toast.success(`Transcribed ${res.lines.length} lines`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setTranscribing(false);
    }
  };
  const onTranslate = async (overwrite: boolean) => {
    const lines = (value.transcript_json as TranscriptLine[]) ?? [];
    const indices = lines
      .map((l, i) => ({ l, i }))
      .filter(({ l }) => l.en?.trim() && (overwrite || (!l.ku_sorani?.trim() && !l.ku_badini?.trim())));
    if (indices.length === 0) { toast.error("No lines to translate"); return; }
    setTranslating(true);
    try {
      const res = await translateFn({
        data: {
          source_language: (value.language_code as "en" | "de" | "ar" | "ko") || "en",
          lines: indices.map(({ l }) => ({ en: l.en })),
        },
      });
      const next = lines.slice();
      indices.forEach(({ i }, k) => {
        const tr = res.translations[k];
        if (!tr) return;
        next[i] = {
          ...next[i],
          ku_sorani: overwrite || !next[i].ku_sorani?.trim() ? tr.sorani : next[i].ku_sorani,
          ku_badini: overwrite || !next[i].ku_badini?.trim() ? tr.badini : next[i].ku_badini,
        };
      });
      set("transcript_json", next);
      toast.success(`Translated ${indices.length} line${indices.length === 1 ? "" : "s"}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setTranslating(false);
    }
  };


  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div><Label>Language</Label>
          <Select value={value.language_code as string} onValueChange={(v) => set("language_code", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{LANGS.map((l) => <SelectItem key={l} value={l}>{l.toUpperCase()}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>CEFR</Label>
          <Select value={value.level_cefr as string} onValueChange={(v) => set("level_cefr", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{CEFRS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div><Label>Title</Label><Input value={(value.title ?? "") as string} onChange={(e) => set("title", e.target.value)} /></div>
      <div><Label>Description</Label><Textarea value={(value.description ?? "") as string} onChange={(e) => set("description", e.target.value)} /></div>

      <div className="rounded-md border p-3 bg-muted/30 grid gap-2">
        <Label>Banner image</Label>
        <Input
          type="file"
          accept="image/*"
          disabled={uploadingBanner}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) openBannerEditorForFile(f);
            e.target.value = "";
          }}
        />
        {bannerPreviewUrl ? (
          <>
            <div className="relative aspect-[4/3] rounded-md overflow-hidden bg-muted">
              <img src={bannerPreviewUrl} alt="Banner preview" className="w-full h-full object-cover" />
            </div>
            <Button type="button" size="sm" variant="outline" className="w-fit" disabled={uploadingBanner} onClick={openBannerEditorForCurrent}>
              Adjust crop
            </Button>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">JPG or PNG recommended. You'll be able to pan & zoom it before it uploads. Shown on the videos page as the video thumbnail.</p>
        )}
        {value.banner_path ? <p className="text-xs text-muted-foreground">Uploaded: {value.banner_path as string}</p> : null}
        {uploadingBanner && <p className="text-xs">Uploading banner…</p>}
      </div>

      {bannerEditor && (
        <BannerEditorDialog
          imageUrl={bannerEditor.url}
          crossOrigin={bannerEditor.crossOrigin}
          onCancel={closeBannerEditor}
          onSave={(blob) => { closeBannerEditor(); onBannerUpload(blob); }}
        />
      )}

      <div className="rounded-md border p-3 bg-muted/30 grid gap-2">
        <Label>Video file</Label>
        <Input type="file" accept="video/*" disabled={uploading} onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ""; }} />
        {value.video_path ? <p className="text-xs text-muted-foreground">Uploaded: {value.video_path as string} · choose a file above to replace it</p> : <p className="text-xs text-muted-foreground">MP4 recommended. Uploads go to the private videos bucket.</p>}
        {uploading && <p className="text-xs">Uploading… {uploadElapsed}s (large files can take a while — keep this tab open)</p>}
        <div className="flex gap-2 mt-1 flex-wrap">
          <Button type="button" size="sm" variant="secondary" onClick={onTranscribe} disabled={!value.video_path || transcribing}>
            {transcribing ? "Transcribing…" : "Auto-transcribe (ElevenLabs)"}
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => onTranslate(false)} disabled={translating || !((value.transcript_json as TranscriptLine[])?.length)}>
            {translating ? "Translating…" : "Auto-translate empty → Kurdish"}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => onTranslate(true)} disabled={translating || !((value.transcript_json as TranscriptLine[])?.length)}>
            {translating ? "Translating…" : "Retranslate all"}
          </Button>
        </div>
      </div>

      <TranscriptEditor
        value={(value.transcript_json as TranscriptLine[]) ?? []}
        onChange={(lines) => set("transcript_json", lines)}
        sourceLanguage={(value.language_code as string) || "en"}
      />
    </div>
  );
}

interface WordHighlight {
  id: string;
  start_index: number;
  end_index: number;
  word: string;
  part_of_speech: string;
  meaning_en: string;
  meaning_ku_sorani: string;
  meaning_ku_badini: string;
}

interface TranscriptLine { t?: number; en: string; ku_sorani?: string; ku_badini?: string; highlights?: WordHighlight[] }

const POS_OPTIONS = ["noun", "verb", "adjective", "adverb", "phrase", "other"] as const;

function tokenizeWords(text?: string): string[] {
  return (text || "").split(/\s+/).filter(Boolean);
}

/**
 * Lets an admin click (or shift-click to select a phrase) on words inside a
 * transcript line's English text, then attach a part-of-speech + English/Kurdish
 * meaning to that word or phrase. Saved highlights are stored on the line itself
 * (`line.highlights`) inside the existing transcript_json column — no new table
 * needed. Learners see these as clickable highlighted words on the video page.
 */
function LineHighlighter({ line, onChange, sourceLanguage }: { line: TranscriptLine; onChange: (highlights: WordHighlight[]) => void; sourceLanguage: string }) {
  const { t } = useDialect();
  const words = tokenizeWords(line.en);
  const highlights = line.highlights ?? [];
  const generateFn = useServerFn(generateWordMeaning);
  const [generating, setGenerating] = useState(false);
  const [form, setForm] = useState<null | {
    mode: "create" | "edit";
    id?: string;
    start_index: number;
    end_index: number;
    word: string;
    part_of_speech: string;
    meaning_en: string;
    meaning_ku_sorani: string;
    meaning_ku_badini: string;
  }>(null);

  const onGenerate = async () => {
    if (!form) return;
    const word = form.word.trim();
    if (!word) { toast.error("Select a word first"); return; }
    setGenerating(true);
    try {
      const res = await generateFn({
        data: { source_language: sourceLanguage as never, word, context: line.en },
      });
      setForm((f) => f && {
        ...f,
        part_of_speech: res.part_of_speech,
        meaning_en: res.meaning_en || f.meaning_en,
        meaning_ku_sorani: res.meaning_ku_sorani || f.meaning_ku_sorani,
        meaning_ku_badini: res.meaning_ku_badini || f.meaning_ku_badini,
      });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setGenerating(false);
    }
  };

  const findHighlightAt = (i: number) => highlights.find((h) => i >= h.start_index && i <= h.end_index);

  const handleWordClick = (i: number, shiftKey: boolean) => {
    if (shiftKey && form?.mode === "create") {
      const start = Math.min(form.start_index, i);
      const end = Math.max(form.end_index, i);
      setForm({ ...form, start_index: start, end_index: end, word: words.slice(start, end + 1).join(" ") });
      return;
    }
    const existing = findHighlightAt(i);
    if (existing) {
      setForm({
        mode: "edit",
        id: existing.id,
        start_index: existing.start_index,
        end_index: existing.end_index,
        word: existing.word,
        part_of_speech: existing.part_of_speech,
        meaning_en: existing.meaning_en,
        meaning_ku_sorani: existing.meaning_ku_sorani,
        meaning_ku_badini: existing.meaning_ku_badini,
      });
      return;
    }
    setForm({
      mode: "create",
      start_index: i,
      end_index: i,
      word: words[i],
      part_of_speech: "noun",
      meaning_en: "",
      meaning_ku_sorani: "",
      meaning_ku_badini: "",
    });
  };

  const saveForm = () => {
    if (!form) return;
    const word = form.word.trim();
    if (!word) { toast.error("Select a word first"); return; }
    const id = form.mode === "edit" && form.id ? form.id : crypto.randomUUID();
    const next: WordHighlight = {
      id,
      start_index: form.start_index,
      end_index: form.end_index,
      word,
      part_of_speech: form.part_of_speech,
      meaning_en: form.meaning_en.trim(),
      meaning_ku_sorani: form.meaning_ku_sorani.trim(),
      meaning_ku_badini: form.meaning_ku_badini.trim(),
    };
    // drop any prior highlight with the same id, and any others that would overlap the new range
    const withoutOverlap = highlights.filter(
      (h) => h.id !== id && (h.end_index < next.start_index || h.start_index > next.end_index),
    );
    onChange([...withoutOverlap, next].sort((a, b) => a.start_index - b.start_index));
    setForm(null);
  };

  const deleteForm = () => {
    if (!form?.id) return;
    onChange(highlights.filter((h) => h.id !== form.id));
    setForm(null);
  };

  if (words.length === 0) return null;

  return (
    <div className="rounded-md border border-dashed p-3 bg-background/50 grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs">{t("highlighted_words")}</Label>
        {highlights.length === 0 && <span className="text-[11px] text-muted-foreground">{t("no_highlights")}</span>}
      </div>
      <p className="text-[11px] text-muted-foreground">{t("highlight_hint")}</p>
      <div dir="ltr" className="text-sm leading-8">
        {words.map((w, i) => {
          const hl = findHighlightAt(i);
          const pending = form?.mode === "create" && i >= form.start_index && i <= form.end_index;
          return (
            <span
              key={i}
              onClick={(e) => handleWordClick(i, e.shiftKey)}
              className={cn(
                "cursor-pointer rounded px-0.5 py-0.5 mr-1 inline-block select-none",
                hl && "bg-amber-300/60 dark:bg-amber-500/30 underline decoration-dotted",
                pending && !hl && "bg-primary/25",
                !hl && !pending && "hover:bg-muted",
              )}
              title={hl?.meaning_en || undefined}
            >
              {w}
            </span>
          );
        })}
      </div>
      {form && (
        <div className="rounded-md border p-3 grid gap-2 bg-muted/40">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs text-muted-foreground">
              {t("selected_word")}: <span className="font-medium text-foreground" dir="ltr">{form.word}</span>
            </div>
            <Button type="button" size="sm" variant="secondary" onClick={onGenerate} disabled={generating}>
              {generating ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1.5" />}
              {generating ? t("generating") : t("generate")}
            </Button>
          </div>
          <div>
            <Label className="text-xs">{t("part_of_speech")}</Label>
            <Select value={form.part_of_speech} onValueChange={(v) => setForm({ ...form, part_of_speech: v })}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                {POS_OPTIONS.map((p) => (
                  <SelectItem key={p} value={p}>{t(`pos_${p}` as never)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">{t("meaning_english")}</Label>
            <Input
              className="h-8"
              dir="ltr"
              value={form.meaning_en}
              onChange={(e) => setForm({ ...form, meaning_en: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">{t("meaning_kurdish")} · {t("sorani")}</Label>
              <Input
                className="h-8"
                value={form.meaning_ku_sorani}
                onChange={(e) => setForm({ ...form, meaning_ku_sorani: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">{t("meaning_kurdish")} · {t("badini")}</Label>
              <Input
                className="h-8"
                value={form.meaning_ku_badini}
                onChange={(e) => setForm({ ...form, meaning_ku_badini: e.target.value })}
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            {form.mode === "edit" && (
              <Button type="button" size="sm" variant="destructive" onClick={deleteForm}>{t("remove_highlight")}</Button>
            )}
            <Button type="button" size="sm" variant="outline" onClick={() => setForm(null)}>{t("cancel")}</Button>
            <Button type="button" size="sm" onClick={saveForm}>{t("save_highlight")}</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function TranscriptEditor({ value, onChange, sourceLanguage }: { value: TranscriptLine[]; onChange: (v: TranscriptLine[]) => void; sourceLanguage: string }) {
  const update = (i: number, patch: Partial<TranscriptLine>) => {
    const next = value.slice();
    next[i] = { ...next[i], ...patch };
    onChange(next);
  };
  const add = () => onChange([...value, { en: "", ku_sorani: "", ku_badini: "" }]);
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between">
        <Label>Transcript lines</Label>
        <Button type="button" size="sm" variant="outline" onClick={add}>+ Add line</Button>
      </div>
      {value.length === 0 && <p className="text-xs text-muted-foreground">No lines yet. Click "Add line" to start.</p>}
      {value.map((line, i) => (
        <div key={i} className="rounded-md border p-3 grid gap-2 bg-muted/30">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">Line {i + 1}</span>
            <Input type="number" step="0.1" className="w-24 h-7" placeholder="t (s)" value={line.t ?? 0} onChange={(e) => update(i, { t: Number(e.target.value) })} />
            <Button type="button" size="sm" variant="ghost" onClick={() => remove(i)}>✕</Button>
          </div>
          <Input placeholder="English line" dir="ltr" value={line.en} onChange={(e) => update(i, { en: e.target.value })} />
          <LineHighlighter line={line} onChange={(highlights) => update(i, { highlights })} sourceLanguage={sourceLanguage} />
          <Input placeholder="Kurdish (Sorani) translation" value={line.ku_sorani ?? ""} onChange={(e) => update(i, { ku_sorani: e.target.value })} />
          <Input placeholder="Kurdish (Badini) translation" value={line.ku_badini ?? ""} onChange={(e) => update(i, { ku_badini: e.target.value })} />
        </div>
      ))}
    </div>
  );
}

// A content block is either a text paragraph or an inline image. `type` is
// optional so existing rows saved before this field existed still load fine
// (missing type === "paragraph").
interface BookParagraph {
  type?: "paragraph" | "image";
  text?: string;
  ku_sorani?: string;
  ku_badini?: string;
  highlights?: WordHighlight[];
  image_path?: string;
  caption?: string;
}

function BooksTab() {
  const { t } = useDialect();
  const qc = useQueryClient();
  const [lang, setLang] = useState("en");
  const list = useServerFn(adminListBooks);
  const upsert = useServerFn(adminUpsertBook);
  const del = useServerFn(adminDeleteBook);
  const q = useQuery({ queryKey: ["admin-books", lang], queryFn: () => list({ data: { language: lang as never } }) });
  const [editing, setEditing] = useState<null | Record<string, unknown>>(null);
  const [open, setOpen] = useState(false);

  const save = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => upsert({ data: payload as never }),
    onSuccess: () => { toast.success(t("saved")); qc.invalidateQueries({ queryKey: ["admin-books"] }); setOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success(t("deleted")); qc.invalidateQueries({ queryKey: ["admin-books"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <div className="flex gap-2 mb-4 items-center">
        <Select value={lang} onValueChange={setLang}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>{LANGS.map((l) => <SelectItem key={l} value={l}>{l.toUpperCase()}</SelectItem>)}</SelectContent>
        </Select>
        <div className="flex-1" />
        <Button onClick={() => { setEditing({ language_code: lang, level_cefr: "A1", title: "", author: "", description: "", cover_path: "", content_json: [] }); setOpen(true); }}>{t("add_new")}</Button>
      </div>
      <div className="grid gap-2">
        {(q.data?.books ?? []).length === 0 && <p className="text-muted-foreground">{t("no_data")}</p>}
        {(q.data?.books ?? []).map((b) => (
          <Card key={b.id}>
            <CardContent className="p-3 flex justify-between items-center">
              <div>
                <div className="font-medium">{b.title}</div>
                <div className="text-xs text-muted-foreground">{b.level_cefr} · {b.author || "no author"}</div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => { setEditing(b as unknown as Record<string, unknown>); setOpen(true); }}>{t("edit")}</Button>
                <Button variant="destructive" size="sm" onClick={() => { if (confirm(t("confirm_delete"))) remove.mutate(b.id); }}>{t("delete")}</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t("admin_books")}</DialogTitle></DialogHeader>
          {editing && <BookForm value={editing} onChange={setEditing} />}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => editing && save.mutate(editing)} disabled={save.isPending}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BookForm({ value, onChange }: { value: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void }) {
  const set = (k: string, v: unknown) => onChange({ ...value, [k]: v });
  const [uploadingCover, setUploadingCover] = useState(false);
  const [translating, setTranslating] = useState(false);
  const translateFn = useServerFn(translateTranscriptLines);
  const extractFn = useServerFn(extractBookPages);
  const [readingPages, setReadingPages] = useState(false);
  const [readingProgress, setReadingProgress] = useState<{ done: number; total: number } | null>(null);

  const onCoverUpload = async (file: File) => {
    setUploadingCover(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${(value.language_code as string) || "en"}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("book-covers").upload(path, file, { upsert: false, contentType: file.type });
      if (error) throw error;
      set("cover_path", path);
      toast.success("Cover uploaded");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploadingCover(false);
    }
  };

  const coverPreviewUrl = value.cover_path
    ? supabase.storage.from("book-covers").getPublicUrl(value.cover_path as string).data.publicUrl
    : null;

  // Upload page photos/scans of the book, then let the AI read each page and
  // turn it into paragraph(s) below. Pages that are pure illustrations come
  // back with no text and are skipped — add those manually as image blocks
  // if you want to keep them in the book.
  const onUploadBookPages = async (files: File[]) => {
    setReadingPages(true);
    setReadingProgress({ done: 0, total: files.length });
    try {
      const paths: string[] = [];
      for (const file of files) {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${(value.language_code as string) || "en"}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("book-pages").upload(path, file, { upsert: false, contentType: file.type });
        if (error) throw error;
        paths.push(path);
      }
      // Send a handful of pages per request so no single request gets too large.
      const batchSize = 3;
      const newParagraphs: BookParagraph[] = [];
      for (let i = 0; i < paths.length; i += batchSize) {
        const batch = paths.slice(i, i + batchSize);
        const res = await extractFn({ data: { paths: batch } });
        for (const pageTexts of res.paragraphsByPage) {
          for (const text of pageTexts) {
            newParagraphs.push({ type: "paragraph", text, ku_sorani: "", ku_badini: "" });
          }
        }
        setReadingProgress({ done: Math.min(i + batch.length, paths.length), total: paths.length });
      }
      const existing = (value.content_json as BookParagraph[]) ?? [];
      set("content_json", [...existing, ...newParagraphs]);
      const skippedPages = paths.length - newParagraphs.length;
      toast.success(
        `Added ${newParagraphs.length} paragraph${newParagraphs.length === 1 ? "" : "s"} from ${paths.length} page${paths.length === 1 ? "" : "s"}` +
        (newParagraphs.length < paths.length ? ` (some pages had no readable text)` : ""),
      );
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setReadingPages(false);
      setReadingProgress(null);
    }
  };

  const onTranslate = async (overwrite: boolean) => {
    const paragraphs = (value.content_json as BookParagraph[]) ?? [];
    const indices = paragraphs
      .map((p, i) => ({ p, i }))
      .filter(({ p }) => p.text?.trim() && (overwrite || (!p.ku_sorani?.trim() && !p.ku_badini?.trim())));
    if (indices.length === 0) { toast.error("No paragraphs to translate"); return; }
    setTranslating(true);
    try {
      const res = await translateFn({
        data: {
          source_language: (value.language_code as "en" | "de" | "ar" | "ko") || "en",
          lines: indices.map(({ p }) => ({ en: p.text ?? "" })),
        },
      });
      const next = paragraphs.slice();
      indices.forEach(({ i }, k) => {
        const tr = res.translations[k];
        if (!tr) return;
        next[i] = {
          ...next[i],
          ku_sorani: overwrite || !next[i].ku_sorani?.trim() ? tr.sorani : next[i].ku_sorani,
          ku_badini: overwrite || !next[i].ku_badini?.trim() ? tr.badini : next[i].ku_badini,
        };
      });
      set("content_json", next);
      toast.success(`Translated ${indices.length} paragraph${indices.length === 1 ? "" : "s"}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setTranslating(false);
    }
  };

  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div><Label>Language</Label>
          <Select value={value.language_code as string} onValueChange={(v) => set("language_code", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{LANGS.map((l) => <SelectItem key={l} value={l}>{l.toUpperCase()}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>CEFR</Label>
          <Select value={value.level_cefr as string} onValueChange={(v) => set("level_cefr", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{CEFRS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div><Label>Title</Label><Input value={(value.title ?? "") as string} onChange={(e) => set("title", e.target.value)} /></div>
      <div><Label>Author</Label><Input value={(value.author ?? "") as string} onChange={(e) => set("author", e.target.value)} /></div>
      <div><Label>Description</Label><Textarea value={(value.description ?? "") as string} onChange={(e) => set("description", e.target.value)} /></div>

      <div className="rounded-md border p-3 bg-muted/30 grid gap-2">
        <Label>Cover image</Label>
        <Input type="file" accept="image/*" disabled={uploadingCover} onChange={(e) => { const f = e.target.files?.[0]; if (f) onCoverUpload(f); }} />
        {coverPreviewUrl ? (
          <div className="relative aspect-[3/4] w-32 rounded-md overflow-hidden bg-muted">
            <img src={coverPreviewUrl} alt="Cover preview" className="w-full h-full object-cover" />
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">JPG or PNG recommended. Shown on the books page as the cover thumbnail.</p>
        )}
        {value.cover_path ? <p className="text-xs text-muted-foreground">Uploaded: {value.cover_path as string}</p> : null}
        {uploadingCover && <p className="text-xs">Uploading cover…</p>}
      </div>

      <div className="rounded-md border p-3 bg-muted/30 grid gap-2">
        <Label>Upload book (AI reads it)</Label>
        <p className="text-xs text-muted-foreground">
          Upload photos or scans of the book's pages, in reading order — even pages that include pictures.
          The AI reads the text on each page and adds it as paragraph(s) below. Pages that are pure
          illustrations are skipped automatically; add those further down as image blocks if you want to
          keep them in the book.
        </p>
        <Input
          type="file"
          accept="image/*"
          multiple
          disabled={readingPages}
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length) onUploadBookPages(files);
            e.target.value = "";
          }}
        />
        {readingPages && (
          <p className="text-xs flex items-center gap-1.5">
            <Loader2 className="h-3 w-3 animate-spin" />
            Reading pages… {readingProgress ? `${readingProgress.done}/${readingProgress.total}` : ""}
          </p>
        )}
      </div>

      <div className="rounded-md border p-3 bg-muted/30 grid gap-2">
        <Label>Translate</Label>
        <p className="text-xs text-muted-foreground">Add paragraphs below (the transcribed text of the book), then use these to auto-translate into Kurdish.</p>
        <div className="flex gap-2 mt-1 flex-wrap">
          <Button type="button" size="sm" variant="secondary" onClick={() => onTranslate(false)} disabled={translating || !((value.content_json as BookParagraph[])?.length)}>
            {translating ? "Translating…" : "Auto-translate empty → Kurdish"}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => onTranslate(true)} disabled={translating || !((value.content_json as BookParagraph[])?.length)}>
            {translating ? "Translating…" : "Retranslate all"}
          </Button>
        </div>
      </div>

      <BookParagraphEditor
        value={(value.content_json as BookParagraph[]) ?? []}
        onChange={(paragraphs) => set("content_json", paragraphs)}
        sourceLanguage={(value.language_code as string) || "en"}
      />
    </div>
  );
}

/**
 * Same click-a-word-to-tag-its-meaning tool as LineHighlighter (used for
 * video transcript lines), adapted to a book paragraph's `.text` field.
 * Duplicated rather than shared since the two source objects (TranscriptLine
 * vs BookParagraph) have different shapes and this file already keeps each
 * content type's editor self-contained.
 */
function ParagraphHighlighter({ paragraph, onChange, sourceLanguage }: { paragraph: BookParagraph; onChange: (highlights: WordHighlight[]) => void; sourceLanguage: string }) {
  const { t } = useDialect();
  const words = tokenizeWords(paragraph.text);
  const highlights = paragraph.highlights ?? [];
  const generateFn = useServerFn(generateWordMeaning);
  const [generating, setGenerating] = useState(false);
  const [form, setForm] = useState<null | {
    mode: "create" | "edit";
    id?: string;
    start_index: number;
    end_index: number;
    word: string;
    part_of_speech: string;
    meaning_en: string;
    meaning_ku_sorani: string;
    meaning_ku_badini: string;
  }>(null);

  const onGenerate = async () => {
    if (!form) return;
    const word = form.word.trim();
    if (!word) { toast.error("Select a word first"); return; }
    setGenerating(true);
    try {
      const res = await generateFn({
        data: { source_language: sourceLanguage as never, word, context: paragraph.text },
      });
      setForm((f) => f && {
        ...f,
        part_of_speech: res.part_of_speech,
        meaning_en: res.meaning_en || f.meaning_en,
        meaning_ku_sorani: res.meaning_ku_sorani || f.meaning_ku_sorani,
        meaning_ku_badini: res.meaning_ku_badini || f.meaning_ku_badini,
      });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setGenerating(false);
    }
  };

  const findHighlightAt = (i: number) => highlights.find((h) => i >= h.start_index && i <= h.end_index);

  const handleWordClick = (i: number, shiftKey: boolean) => {
    if (shiftKey && form?.mode === "create") {
      const start = Math.min(form.start_index, i);
      const end = Math.max(form.end_index, i);
      setForm({ ...form, start_index: start, end_index: end, word: words.slice(start, end + 1).join(" ") });
      return;
    }
    const existing = findHighlightAt(i);
    if (existing) {
      setForm({
        mode: "edit",
        id: existing.id,
        start_index: existing.start_index,
        end_index: existing.end_index,
        word: existing.word,
        part_of_speech: existing.part_of_speech,
        meaning_en: existing.meaning_en,
        meaning_ku_sorani: existing.meaning_ku_sorani,
        meaning_ku_badini: existing.meaning_ku_badini,
      });
      return;
    }
    setForm({
      mode: "create",
      start_index: i,
      end_index: i,
      word: words[i],
      part_of_speech: "noun",
      meaning_en: "",
      meaning_ku_sorani: "",
      meaning_ku_badini: "",
    });
  };

  const saveForm = () => {
    if (!form) return;
    const word = form.word.trim();
    if (!word) { toast.error("Select a word first"); return; }
    const id = form.mode === "edit" && form.id ? form.id : crypto.randomUUID();
    const next: WordHighlight = {
      id,
      start_index: form.start_index,
      end_index: form.end_index,
      word,
      part_of_speech: form.part_of_speech,
      meaning_en: form.meaning_en.trim(),
      meaning_ku_sorani: form.meaning_ku_sorani.trim(),
      meaning_ku_badini: form.meaning_ku_badini.trim(),
    };
    const withoutOverlap = highlights.filter(
      (h) => h.id !== id && (h.end_index < next.start_index || h.start_index > next.end_index),
    );
    onChange([...withoutOverlap, next].sort((a, b) => a.start_index - b.start_index));
    setForm(null);
  };

  const deleteForm = () => {
    if (!form?.id) return;
    onChange(highlights.filter((h) => h.id !== form.id));
    setForm(null);
  };

  if (words.length === 0) return null;

  return (
    <div className="rounded-md border border-dashed p-3 bg-background/50 grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs">{t("highlighted_words")}</Label>
        {highlights.length === 0 && <span className="text-[11px] text-muted-foreground">{t("no_highlights")}</span>}
      </div>
      <p className="text-[11px] text-muted-foreground">{t("highlight_hint")}</p>
      <div dir="ltr" className="text-sm leading-8">
        {words.map((w, i) => {
          const hl = findHighlightAt(i);
          const pending = form?.mode === "create" && i >= form.start_index && i <= form.end_index;
          return (
            <span
              key={i}
              onClick={(e) => handleWordClick(i, e.shiftKey)}
              className={cn(
                "cursor-pointer rounded px-0.5 py-0.5 mr-1 inline-block select-none",
                hl && "bg-amber-300/60 dark:bg-amber-500/30 underline decoration-dotted",
                pending && !hl && "bg-primary/25",
                !hl && !pending && "hover:bg-muted",
              )}
              title={hl?.meaning_en || undefined}
            >
              {w}
            </span>
          );
        })}
      </div>
      {form && (
        <div className="rounded-md border p-3 grid gap-2 bg-muted/40">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs text-muted-foreground">
              {t("selected_word")}: <span className="font-medium text-foreground" dir="ltr">{form.word}</span>
            </div>
            <Button type="button" size="sm" variant="secondary" onClick={onGenerate} disabled={generating}>
              {generating ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1.5" />}
              {generating ? t("generating") : t("generate")}
            </Button>
          </div>
          <div>
            <Label className="text-xs">{t("part_of_speech")}</Label>
            <Select value={form.part_of_speech} onValueChange={(v) => setForm({ ...form, part_of_speech: v })}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                {POS_OPTIONS.map((p) => (
                  <SelectItem key={p} value={p}>{t(`pos_${p}` as never)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">{t("meaning_english")}</Label>
            <Input
              className="h-8"
              dir="ltr"
              value={form.meaning_en}
              onChange={(e) => setForm({ ...form, meaning_en: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">{t("meaning_kurdish")} · {t("sorani")}</Label>
              <Input
                className="h-8"
                value={form.meaning_ku_sorani}
                onChange={(e) => setForm({ ...form, meaning_ku_sorani: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">{t("meaning_kurdish")} · {t("badini")}</Label>
              <Input
                className="h-8"
                value={form.meaning_ku_badini}
                onChange={(e) => setForm({ ...form, meaning_ku_badini: e.target.value })}
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            {form.mode === "edit" && (
              <Button type="button" size="sm" variant="destructive" onClick={deleteForm}>{t("remove_highlight")}</Button>
            )}
            <Button type="button" size="sm" variant="outline" onClick={() => setForm(null)}>{t("cancel")}</Button>
            <Button type="button" size="sm" onClick={saveForm}>{t("save_highlight")}</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function BookParagraphEditor({ value, onChange, sourceLanguage }: { value: BookParagraph[]; onChange: (v: BookParagraph[]) => void; sourceLanguage: string }) {
  const update = (i: number, patch: Partial<BookParagraph>) => {
    const next = value.slice();
    next[i] = { ...next[i], ...patch };
    onChange(next);
  };
  const insertAt = (i: number, block: BookParagraph) => {
    const next = value.slice();
    next.splice(i, 0, block);
    onChange(next);
  };
  const addParagraph = (i: number) => insertAt(i, { type: "paragraph", text: "", ku_sorani: "", ku_badini: "" });
  const addImage = (i: number) => insertAt(i, { type: "image", image_path: "", caption: "" });
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between">
        <Label>Content</Label>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => addParagraph(value.length)}>+ Add paragraph</Button>
          <Button type="button" size="sm" variant="outline" onClick={() => addImage(value.length)}>+ Add image</Button>
        </div>
      </div>
      {value.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No content yet. Click "Add paragraph" / "Add image" above, or upload page photos above for the AI to read.
        </p>
      )}
      {value.map((p, i) => {
        const isImage = p.type === "image";
        return (
          <div key={i}>
            <div className="rounded-md border p-3 grid gap-2 bg-muted/30">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">{isImage ? "Image" : "Paragraph"} {i + 1}</span>
                <Button type="button" size="sm" variant="ghost" onClick={() => remove(i)}>✕</Button>
              </div>
              {isImage ? (
                <BookImageBlock paragraph={p} onChange={(patch) => update(i, patch)} />
              ) : (
                <>
                  <Textarea placeholder="Paragraph text" dir="ltr" value={p.text ?? ""} onChange={(e) => update(i, { text: e.target.value })} />
                  <ParagraphHighlighter paragraph={p} onChange={(highlights) => update(i, { highlights })} sourceLanguage={sourceLanguage} />
                  <Input placeholder="Kurdish (Sorani) translation" value={p.ku_sorani ?? ""} onChange={(e) => update(i, { ku_sorani: e.target.value })} />
                  <Input placeholder="Kurdish (Badini) translation" value={p.ku_badini ?? ""} onChange={(e) => update(i, { ku_badini: e.target.value })} />
                </>
              )}
            </div>
            {/* Insert a new block at this exact position — this is how an image (or
                paragraph) gets placed "anywhere", not just appended to the end. */}
            <div className="flex gap-3 justify-center py-1">
              <button type="button" className="text-[11px] text-muted-foreground hover:text-foreground underline decoration-dotted" onClick={() => addParagraph(i + 1)}>+ paragraph here</button>
              <button type="button" className="text-[11px] text-muted-foreground hover:text-foreground underline decoration-dotted" onClick={() => addImage(i + 1)}>+ image here</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BookImageBlock({ paragraph, onChange }: { paragraph: BookParagraph; onChange: (patch: Partial<BookParagraph>) => void }) {
  const [uploading, setUploading] = useState(false);
  const previewUrl = paragraph.image_path
    ? supabase.storage.from("book-images").getPublicUrl(paragraph.image_path).data.publicUrl
    : null;

  const onUpload = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("book-images").upload(path, file, { upsert: false, contentType: file.type });
      if (error) throw error;
      onChange({ image_path: path });
      toast.success("Image uploaded");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="grid gap-2">
      <Input
        type="file"
        accept="image/*"
        disabled={uploading}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ""; }}
      />
      {previewUrl ? (
        <img src={previewUrl} alt={paragraph.caption || "Book image"} className="max-h-64 w-auto rounded-md object-contain bg-background border" />
      ) : (
        <p className="text-xs text-muted-foreground">JPG or PNG. Appears inline in the book at this exact position.</p>
      )}
      {uploading && <p className="text-xs flex items-center gap-1.5"><Loader2 className="h-3 w-3 animate-spin" /> Uploading…</p>}
      <Input placeholder="Caption (optional)" value={paragraph.caption ?? ""} onChange={(e) => onChange({ caption: e.target.value })} />
    </div>
  );
}

function UsersTab() {
  const { t } = useDialect();
  const qc = useQueryClient();
  const list = useServerFn(adminListUsers);
  const setRole = useServerFn(adminSetUserRole);
  const q = useQuery({ queryKey: ["admin-users"], queryFn: () => list({}) });
  const m = useMutation({
    mutationFn: async (args: { user_id: string; grant: boolean }) => setRole({ data: { user_id: args.user_id, role: "admin", grant: args.grant } }),
    onSuccess: () => { toast.success(t("saved")); qc.invalidateQueries({ queryKey: ["admin-users"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="grid gap-2">
      {(q.data?.users ?? []).length === 0 && <p className="text-muted-foreground">{t("no_data")}</p>}
      {(q.data?.users ?? []).map((u) => {
        const isAdmin = u.roles.includes("admin");
        return (
          <Card key={u.id}>
            <CardContent className="p-3 flex justify-between items-center">
              <div>
                <div className="font-medium">{u.display_name ?? "—"}</div>
                <div className="text-xs text-muted-foreground">{u.id.slice(0, 8)} · {u.ui_dialect}</div>
                <div className="mt-1 flex gap-1">{u.roles.map((r) => <Badge key={r} variant="secondary">{r}</Badge>)}</div>
              </div>
              <Button variant={isAdmin ? "destructive" : "default"} size="sm" onClick={() => m.mutate({ user_id: u.id, grant: !isAdmin })}>
                {isAdmin ? t("revoke_admin") : t("promote_admin")}
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// suppress unused import warnings
export { getIsAdmin, DialogTrigger, CardHeader, CardTitle };
