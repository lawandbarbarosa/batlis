import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, ChevronUp, ChevronDown, Trash2, X, Image as ImageIcon, Search } from "lucide-react";
import { toast } from "sonner";
import { useDialect } from "@/hooks/use-dialect";
import { cn } from "@/lib/utils";
import {
  getIsAdmin,
  adminListLessons,
  adminListCourses,
  adminListVocab,
  adminListVideos,
  adminGetVideoInsights,
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
  translateLessonWords,
  generateWordMeaning,
  generateWordImage,
  searchWordPhotos,
  importPhotoToLibrary,
  transcribeBookAudio,
} from "@/lib/admin.functions";
import { supabase } from "@/integrations/supabase/client";
import { BannerEditorDialog } from "@/components/banner-editor";
import { extractPdfBook } from "@/lib/pdf-import";
import { hashText } from "@/lib/text-audio";

export const Route = createFileRoute("/_authenticated/admin")({
  ssr: false,
  beforeLoad: async ({ context }) => {
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: context.user.id, _role: "admin" });
    if (!isAdmin) throw redirect({ to: "/dashboard" });
  },
  component: AdminPage,
});

type Tab = "lessons" | "vocab" | "videos" | "books" | "highlights" | "users";
const LANGS = ["en", "de", "ar", "ko"] as const;
const CEFRS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
const VIDEO_CATEGORIES = ["podcast", "animation", "movie", "show", "talking", "music", "documentary", "news", "other"] as const;

function AdminPage() {
  const { t } = useDialect();
  const [tab, setTab] = useState<Tab>("lessons");
  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-3xl font-display font-bold">{t("admin")}</h1>
      </div>
      <div className="mb-6 flex gap-2 flex-wrap">
        {(["lessons", "vocab", "videos", "books", "highlights", "users"] as Tab[]).map((v) => (
          <Button key={v} variant={tab === v ? "default" : "outline"} onClick={() => setTab(v)}>
            {t(`admin_${v}` as never)}
          </Button>
        ))}
      </div>
      {tab === "lessons" && <LessonsTab />}
      {tab === "vocab" && <VocabTab />}
      {tab === "videos" && <VideosTab />}
      {tab === "books" && <BooksTab />}
      {tab === "highlights" && <HighlightsTab />}
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
        <CourseLessonsPanel course={activeCourse} lang={lang} onBack={() => setActiveCourse(null)} />
      ) : (
        <CoursesPanel lang={lang} cefr={cefr} onOpenCourse={setActiveCourse} />
      )}
    </div>
  );
}

const COURSE_IMPORT_EXAMPLE = `{
  "title": "Basic English",
  "level": "A1",
  "blocks": [
    {
      "title": "Greetings",
      "content": [
        { "type": "word", "word": "Hello", "translation": "سڵاو", "image": "images/hello.png", "sentence": "Hello, my name is John." },
        { "type": "word", "word": "Goodbye", "translation": "خواحافیز", "sentence": "Goodbye! See you tomorrow." }
      ]
    },
    {
      "title": "Family",
      "content": [
        { "type": "word", "word": "Mother", "translation": "دایک", "sentence": "My mother is a teacher." }
      ]
    }
  ]
}`;

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
      cover_image_path: "",
    });
    setOpen(true);
  };

  return (
    <div>
      <CourseJsonImportPanel
        lang={lang}
        cefr={cefr}
        levelId={q.data?.levelId ?? undefined}
        nextOrderIndex={q.data?.courses.length ?? 0}
        onImported={(course) => { qc.invalidateQueries({ queryKey: ["admin-courses"] }); onOpenCourse(course); }}
      />
      <p className="text-sm text-muted-foreground mb-3">Themed units within {cefr} — e.g. "Greetings and Introductions", "Personal Information". Click a course to manage its lessons.</p>
      <div className="flex justify-end mb-4"><Button variant="outline" onClick={openNew}>{t("add_new")}</Button></div>
      <div className="grid gap-3">
        {(q.data?.courses ?? []).length === 0 && <p className="text-muted-foreground">{t("no_data")}</p>}
        {(q.data?.courses ?? []).map((c) => {
          const coverUrl = c.cover_image_path ? supabase.storage.from("course-covers").getPublicUrl(c.cover_image_path).data.publicUrl : null;
          return (
          <Card key={c.id}>
            <CardContent className="p-4 flex justify-between items-center gap-3">
              <button type="button" className="text-left flex-1 min-w-0 flex items-center gap-3" onClick={() => onOpenCourse({ id: c.id, title_sorani: c.title_sorani, level_id: c.level_id })}>
                <div className="h-10 w-14 shrink-0 rounded-md overflow-hidden bg-muted grid place-items-center">
                  {coverUrl ? <img src={coverUrl} alt="" className="h-full w-full object-cover" /> : <span className="text-[10px] text-muted-foreground">No image</span>}
                </div>
                <div className="min-w-0">
                  <div className="font-medium">{c.order_index + 1}. {c.title_sorani}{c.title_en ? ` (${c.title_en})` : ""}</div>
                  <div className="text-sm text-muted-foreground">{c.title_badini} · {(c.lessons ?? []).length} lesson{(c.lessons ?? []).length === 1 ? "" : "s"}</div>
                </div>
              </button>
              <div className="flex gap-2 shrink-0">
                <Button variant="outline" size="sm" onClick={() => { setEditing(c as unknown as Record<string, unknown>); setOpen(true); }}>{t("edit")}</Button>
                <Button variant="destructive" size="sm" onClick={() => { if (confirm(t("confirm_delete"))) remove.mutate(c.id); }}>{t("delete")}</Button>
              </div>
            </CardContent>
          </Card>
          );
        })}
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

// The primary way to build a course: paste the ENTIRE course JSON (a title
// plus "blocks", where each block becomes one lesson) along with any
// images/audio it references, and this creates the course and every lesson
// in it in a single action — following the JSON's own structure exactly,
// rather than one block at a time. Titles and any missing Kurdish
// translation are filled in by AI; nothing else is shown or asked for.
// review/test/finalReview/finalExam aren't supported yet and are skipped,
// with a summary reported after saving.
function CourseJsonImportPanel({ lang, cefr, levelId, nextOrderIndex, onImported }: {
  lang: string;
  cefr: string;
  levelId: string | undefined;
  nextOrderIndex: number;
  onImported: (course: { id: string; title_sorani: string; level_id: string }) => void;
}) {
  const upsertCourse = useServerFn(adminUpsertCourse);
  const upsertLesson = useServerFn(adminUpsertLesson);
  const translate = useServerFn(translateLessonWords);
  const [jsonText, setJsonText] = useState("");
  const [assets, setAssets] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const next = { ...assets };
      for (const file of Array.from(files)) {
        const path = `courses/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${file.name}`;
        const { error } = await supabase.storage.from("lesson-assets").upload(path, file, { upsert: false, contentType: file.type || undefined });
        if (error) {
          toast.error(`${file.name}: ${error.message}`);
          continue;
        }
        next[file.name] = supabase.storage.from("lesson-assets").getPublicUrl(path).data.publicUrl;
      }
      setAssets(next);
    } finally {
      setUploading(false);
    }
  };
  const removeAsset = (name: string) => setAssets((prev) => { const next = { ...prev }; delete next[name]; return next; });
  const resolveAsset = (ref: string): string => {
    if (!ref) return "";
    if (/^https?:\/\//i.test(ref)) return ref;
    const base = ref.split("/").pop() ?? ref;
    return assets[base] ?? ref;
  };

  const runSave = async () => {
    if (!levelId) {
      toast.error(`No level exists yet for ${lang.toUpperCase()} / ${cefr}.`);
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      toast.error("That's not valid JSON.");
      return;
    }
    const root = (parsed ?? {}) as Record<string, unknown>;
    const courseTitleEn = typeof root.title === "string" ? root.title.trim() : "";
    if (!courseTitleEn) {
      toast.error('That JSON needs a top-level "title" for the course.');
      return;
    }

    const blocks: Record<string, unknown>[] = Array.isArray(root.blocks)
      ? (root.blocks as Record<string, unknown>[])
      : Array.isArray(root.content)
        ? [root] // a single block was pasted directly — treat it as a one-lesson course
        : [];
    if (blocks.length === 0) {
      toast.error('No "blocks" found in that JSON.');
      return;
    }

    let levelMismatchNote = "";
    if (typeof root.level === "string" && root.level.toUpperCase() !== cefr.toUpperCase()) {
      levelMismatchNote = ` Note: the JSON says level "${root.level}" but you're on ${cefr} — it was saved under ${cefr}; switch tabs first if that's wrong.`;
    }

    setSaving(true);
    try {
      const blockData = blocks.map((b) => {
        const titleEn = typeof b.title === "string" ? b.title.trim() : "";
        const content = Array.isArray(b.content) ? (b.content as unknown[]) : [];
        const { steps: rawSteps, summary } = blockContentToSteps(content);
        const steps: LessonStep[] = rawSteps.map((s) => {
          if (s.type === "image") return { ...s, url: resolveAsset(s.url) };
          if ((s.type === "word" || s.type === "sentence") && s.audio_url) return { ...s, audio_url: resolveAsset(s.audio_url) };
          return s;
        });
        return { titleEn, steps, summary };
      });

      const unresolvedAssets = blockData.reduce(
        (n, b) =>
          n +
          b.steps.filter(
            (s) =>
              (s.type === "image" && !!s.url && !/^https?:\/\//i.test(s.url)) ||
              ((s.type === "word" || s.type === "sentence") && !!s.audio_url && !/^https?:\/\//i.test(s.audio_url)),
          ).length,
        0,
      );

      // One batched AI call covers: the course title, every block title, and
      // every word/sentence anywhere in the course missing a Kurdish translation.
      const need: { key: string; text: string }[] = [{ key: "course", text: courseTitleEn }];
      blockData.forEach((b, bi) => {
        if (b.titleEn) need.push({ key: `block${bi}`, text: b.titleEn });
        b.steps.forEach((s, si) => {
          if ((s.type === "word" || s.type === "sentence") && (!s.kurdish_sorani?.trim() || !s.kurdish_badini?.trim())) {
            need.push({ key: `b${bi}s${si}`, text: s.target });
          }
        });
      });
      const res = await translate({ data: { source_language: lang as never, items: need.map((n) => ({ text: n.text })) } });
      const byKey = new Map(need.map((n, i) => [n.key, res.translations[i]]));

      const courseTr = byKey.get("course") ?? { sorani: "", badini: "" };
      const courseRes = (await upsertCourse({
        data: {
          level_id: levelId,
          order_index: nextOrderIndex,
          title_sorani: courseTr.sorani,
          title_badini: courseTr.badini,
          title_en: courseTitleEn,
        } as never,
      })) as { course: { id: string } };
      const courseId = courseRes.course.id;

      let savedLessons = 0, savedWords = 0, savedSentences = 0, savedImages = 0, savedTips = 0;
      const skippedTotals: Record<string, number> = {};

      for (let bi = 0; bi < blockData.length; bi++) {
        const b = blockData[bi];
        if (!b.titleEn) continue; // a block without a title can't become a lesson
        const titleTr = byKey.get(`block${bi}`) ?? { sorani: "", badini: "" };
        const finalSteps = b.steps.map((s, si) => {
          if (s.type !== "word" && s.type !== "sentence") return s;
          const tr = byKey.get(`b${bi}s${si}`);
          if (!tr) return s;
          return { ...s, kurdish_sorani: s.kurdish_sorani?.trim() || tr.sorani, kurdish_badini: s.kurdish_badini?.trim() || tr.badini };
        });
        await upsertLesson({
          data: {
            course_id: courseId,
            level_id: levelId,
            order_index: bi,
            title_sorani: titleTr.sorani,
            title_badini: titleTr.badini,
            title_en: b.titleEn,
            dialogue_json: [],
            steps_json: finalSteps,
          } as never,
        });
        savedLessons++;
        savedWords += b.summary.words;
        savedSentences += b.summary.sentences;
        savedImages += b.summary.images;
        savedTips += b.summary.tips;
        for (const [k, v] of Object.entries(b.summary.skipped)) skippedTotals[k] = (skippedTotals[k] ?? 0) + v;
      }
      if (root.finalReview) skippedTotals.finalReview = (skippedTotals.finalReview ?? 0) + 1;
      if (root.finalExam) skippedTotals.finalExam = (skippedTotals.finalExam ?? 0) + 1;

      setJsonText("");
      setAssets({});
      onImported({ id: courseId, title_sorani: courseTr.sorani, level_id: levelId });

      const parts = [
        `${savedLessons} lesson${savedLessons === 1 ? "" : "s"}`,
        savedWords ? `${savedWords} word${savedWords === 1 ? "" : "s"}` : null,
        savedSentences ? `${savedSentences} sentence${savedSentences === 1 ? "" : "s"}` : null,
        savedImages ? `${savedImages} image${savedImages === 1 ? "" : "s"}` : null,
        savedTips ? `${savedTips} tip${savedTips === 1 ? "" : "s"}` : null,
      ].filter(Boolean);
      const skippedParts = Object.entries(skippedTotals).map(([k, v]) => `${v} ${k}`);
      let msg = `Created "${courseTitleEn}" — ${parts.join(", ")}. Titles and missing translations were filled in with AI.`;
      if (skippedParts.length) msg += ` Skipped (not supported yet): ${skippedParts.join(", ")}.`;
      if (unresolvedAssets) msg += ` ${unresolvedAssets} image/audio reference${unresolvedAssets === 1 ? "" : "s"} didn't match an uploaded file.`;
      msg += levelMismatchNote;
      toast.success(msg);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border p-4 bg-muted/20 mb-5">
      <Label>Paste a course as JSON</Label>
      <p className="text-xs text-muted-foreground mt-0.5 mb-2">
        Paste a full course — <code>title</code> plus <code>blocks</code> (each block becomes one lesson). This creates the course and every lesson in it in one go, matching the JSON's structure. <code>review</code>, <code>test</code>, <code>finalReview</code>, and <code>finalExam</code> aren't supported yet and are skipped, with a summary shown after saving.
      </p>
      <Textarea
        rows={16}
        className="font-mono text-xs"
        dir="ltr"
        value={jsonText}
        onChange={(e) => setJsonText(e.target.value)}
        placeholder={COURSE_IMPORT_EXAMPLE}
      />
      <div className="mt-3">
        <Label>Images &amp; audio (optional)</Label>
        <p className="text-xs text-muted-foreground mb-1.5">
          Upload files with the same names your JSON references anywhere in the course — e.g. upload <code>hello.png</code> to fill in <code>"image": "images/hello.png"</code>. Anything you don't upload is left as-is.
        </p>
        <Input type="file" multiple accept="image/*,audio/*" disabled={uploading} onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} />
        {uploading && <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Uploading…</p>}
        {Object.keys(assets).length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {Object.keys(assets).map((name) => (
              <span key={name} className="inline-flex items-center gap-1.5 text-xs bg-muted rounded-full pl-2.5 pr-1.5 py-1">
                {name}
                <button type="button" onClick={() => removeAsset(name)} className="text-muted-foreground hover:text-destructive"><X className="h-3 w-3" /></button>
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="flex justify-end mt-3">
        <Button onClick={runSave} disabled={saving || uploading || !jsonText.trim()}>
          {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}
          Save Course
        </Button>
      </div>
    </div>
  );
}

function CourseForm({ value, onChange }: { value: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void }) {
  const set = (k: string, v: unknown) => onChange({ ...value, [k]: v });
  const [uploadingCover, setUploadingCover] = useState(false);
  const [coverEditor, setCoverEditor] = useState<{ url: string; crossOrigin: boolean; revoke: boolean } | null>(null);

  const coverPreviewUrl = value.cover_image_path
    ? supabase.storage.from("course-covers").getPublicUrl(value.cover_image_path as string).data.publicUrl
    : null;

  const onCoverUpload = async (blob: Blob) => {
    setUploadingCover(true);
    try {
      const path = `${crypto.randomUUID()}.jpg`;
      const { error } = await supabase.storage.from("course-covers").upload(path, blob, { upsert: false, contentType: blob.type || "image/jpeg" });
      if (error) throw error;
      set("cover_image_path", path);
      toast.success("Cover image uploaded");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploadingCover(false);
    }
  };
  const openCoverEditorForFile = (file: File) => setCoverEditor({ url: URL.createObjectURL(file), crossOrigin: false, revoke: true });
  const openCoverEditorForCurrent = () => { if (coverPreviewUrl) setCoverEditor({ url: coverPreviewUrl, crossOrigin: true, revoke: false }); };
  const closeCoverEditor = () => { if (coverEditor?.revoke) URL.revokeObjectURL(coverEditor.url); setCoverEditor(null); };

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

      <div className="rounded-md border p-3 bg-muted/30 grid gap-2">
        <Label>Cover image</Label>
        <Input
          type="file"
          accept="image/*"
          disabled={uploadingCover}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) openCoverEditorForFile(f);
            e.target.value = "";
          }}
        />
        {coverPreviewUrl ? (
          <>
            <div className="relative aspect-[4/3] w-40 rounded-md overflow-hidden bg-muted">
              <img src={coverPreviewUrl} alt="Course cover preview" className="w-full h-full object-cover" />
            </div>
            <Button type="button" size="sm" variant="outline" className="w-fit" disabled={uploadingCover} onClick={openCoverEditorForCurrent}>
              Adjust crop
            </Button>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">Shown on the course card learners tap to open this course. You'll be able to pan &amp; zoom it before it uploads.</p>
        )}
        {uploadingCover && <p className="text-xs">Uploading cover…</p>}
      </div>

      {coverEditor && (
        <BannerEditorDialog
          imageUrl={coverEditor.url}
          crossOrigin={coverEditor.crossOrigin}
          onCancel={closeCoverEditor}
          onSave={(blob) => { closeCoverEditor(); onCoverUpload(blob); }}
        />
      )}
    </div>
  );
}

function CourseLessonsPanel({ course, lang, onBack }: { course: { id: string; title_sorani: string; level_id: string }; lang: string; onBack: () => void }) {
  const { t } = useDialect();
  const qc = useQueryClient();
  const list = useServerFn(adminListLessons);
  const upsert = useServerFn(adminUpsertLesson);
  const del = useServerFn(adminDeleteLesson);
  const q = useQuery({ queryKey: ["admin-lessons", course.id], queryFn: () => list({ data: { courseId: course.id } }) });
  const [editing, setEditing] = useState<null | Record<string, unknown>>(null);
  const [open, setOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

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

  return (
    <div>
      <button onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground mb-3">← Back to courses</button>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-lg font-semibold">{course.title_sorani}</h3>
        <Button onClick={() => setAddOpen(true)}>{t("add_new")}</Button>
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
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Add Lesson</DialogTitle></DialogHeader>
          <LessonImportPanel
            course={course}
            lang={lang}
            orderStart={q.data?.lessons.length ?? 0}
            onImported={() => qc.invalidateQueries({ queryKey: ["admin-lessons"] })}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>{t("cancel")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t("admin_lessons")}</DialogTitle></DialogHeader>
          {editing && (
            <LessonForm value={editing} onChange={setEditing} lang={lang} />
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

// The entire "Add Lesson" experience: paste one block of JSON (title + content),
// optionally attach image/audio files that get matched to the JSON by filename,
// and save. Everything else — the Sorani/Badini title, and any missing Kurdish
// translation on a word/sentence — is filled in automatically via AI, so nothing
// but the JSON box and an upload field is ever shown here. The dialog stays open
// after each save so blocks can be pasted one after another.
function LessonImportPanel({ course, lang, orderStart, onImported }: { course: { id: string; level_id: string }; lang: string; orderStart: number; onImported: () => void }) {
  const upsert = useServerFn(adminUpsertLesson);
  const translate = useServerFn(translateLessonWords);
  const [jsonText, setJsonText] = useState("");
  const [assets, setAssets] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addedCount, setAddedCount] = useState(0);
  // The flow mirrors the pasted JSON live: whenever the JSON (or the selected
  // block, or an uploaded asset) changes, the flow below is rebuilt from it.
  // Edits made in the flow stick until the JSON changes again.
  const [blockIdx, setBlockIdx] = useState(0);
  const [flowTitle, setFlowTitle] = useState("");
  const [flowSteps, setFlowSteps] = useState<LessonStep[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [blockTitles, setBlockTitles] = useState<string[]>([]);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const next = { ...assets };
      for (const file of Array.from(files)) {
        const path = `${course.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${file.name}`;
        const { error } = await supabase.storage.from("lesson-assets").upload(path, file, { upsert: false, contentType: file.type || undefined });
        if (error) {
          toast.error(`${file.name}: ${error.message}`);
          continue;
        }
        next[file.name] = supabase.storage.from("lesson-assets").getPublicUrl(path).data.publicUrl;
      }
      setAssets(next);
    } finally {
      setUploading(false);
    }
  };

  const removeAsset = (name: string) => setAssets((prev) => { const next = { ...prev }; delete next[name]; return next; });

  // Live parse: JSON in → flow out. Debounced a touch so typing stays smooth.
  useEffect(() => {
    const resolveAsset = (ref: string): string => {
      if (!ref) return "";
      if (/^https?:\/\//i.test(ref)) return ref;
      const base = ref.split("/").pop() ?? ref;
      return assets[base] ?? ref;
    };

    const timer = setTimeout(() => {
      if (!jsonText.trim()) {
        setFlowSteps(null);
        setFlowTitle("");
        setBlockTitles([]);
        setSummary(null);
        setParseError(null);
        return;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(jsonText);
      } catch (e) {
        setParseError((e as Error).message);
        return;
      }
      setParseError(null);

      const root = (parsed ?? {}) as Record<string, unknown>;
      const blocks: Record<string, unknown>[] = Array.isArray(root.blocks)
        ? (root.blocks as Record<string, unknown>[])
        : Array.isArray(parsed)
        ? (parsed as Record<string, unknown>[])
        : [root];
      setBlockTitles(blocks.map((b, i) => (typeof b.title === "string" && b.title.trim() ? b.title.trim() : `Block ${i + 1}`)));
      const idx = Math.min(blockIdx, blocks.length - 1);
      const block = blocks[idx] ?? {};

      const titleEn = typeof block.title === "string" ? block.title.trim() : "";
      const content = Array.isArray(block.content) ? (block.content as unknown[]) : [];
      const { steps: rawSteps, summary: sum } = blockContentToSteps(content);
      const steps: LessonStep[] = rawSteps.map((s) => {
        if (s.type === "image") return { ...s, url: resolveAsset(s.url) };
        if (s.type === "word" || s.type === "sentence") {
          return {
            ...s,
            audio_url: s.audio_url ? resolveAsset(s.audio_url) : s.audio_url,
            image_url: s.image_url ? resolveAsset(s.image_url) : s.image_url,
          };
        }
        return s;
      });
      setFlowTitle(titleEn);
      setFlowSteps(steps);
      setSummary(sum);
    }, 250);
    return () => clearTimeout(timer);
    // Deliberately keyed on the JSON, the chosen block and the uploaded assets.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jsonText, blockIdx, assets]);

  const resetPanel = () => {
    setJsonText("");
    setAssets({});
    setFlowTitle("");
    setFlowSteps(null);
    setBlockTitles([]);
    setSummary(null);
    setBlockIdx(0);
  };

  const runSave = async () => {
    const steps = flowSteps;
    const titleEn = flowTitle.trim();
    if (!steps || steps.length === 0) {
      toast.error("Paste some lesson JSON first — the flow below is empty.");
      return;
    }
    if (!titleEn) {
      toast.error("Give the lesson an English title.");
      return;
    }
    const unresolvedAssets = steps.filter((s) =>
      (s.type === "image" && !!s.url && !/^https?:\/\//i.test(s.url)) ||
      ((s.type === "word" || s.type === "sentence") &&
        ((!!s.audio_url && !/^https?:\/\//i.test(s.audio_url)) || (!!s.image_url && !/^https?:\/\//i.test(s.image_url)))),
    ).length;

    setSaving(true);
    try {
      const need: { key: string; text: string }[] = [{ key: "__title__", text: titleEn }];
      steps.forEach((s, i) => {
        if ((s.type === "word" || s.type === "sentence") && (!s.kurdish_sorani?.trim() || !s.kurdish_badini?.trim())) {
          need.push({ key: `s${i}`, text: s.target });
        }
      });
      const res = await translate({ data: { source_language: lang as never, items: need.map((n) => ({ text: n.text })) } });
      const byKey = new Map(need.map((n, i) => [n.key, res.translations[i]]));

      const titleTr = byKey.get("__title__") ?? { sorani: "", badini: "" };
      const finalSteps = steps.map((s, i) => {
        if (s.type !== "word" && s.type !== "sentence") return s;
        const tr = byKey.get(`s${i}`);
        if (!tr) return s;
        return {
          ...s,
          kurdish_sorani: s.kurdish_sorani?.trim() || tr.sorani,
          kurdish_badini: s.kurdish_badini?.trim() || tr.badini,
        };
      });

      await upsert({
        data: {
          course_id: course.id,
          level_id: course.level_id,
          order_index: orderStart + addedCount,
          title_sorani: titleTr.sorani,
          title_badini: titleTr.badini,
          title_en: titleEn,
          dialogue_json: [],
          steps_json: finalSteps,
        } as never,
      });

      setAddedCount((c) => c + 1);
      const more = blockTitles.length > 1 && blockIdx < blockTitles.length - 1;
      if (more) {
        setBlockIdx((i) => i + 1);
      } else {
        resetPanel();
      }
      onImported();

      let msg = `Saved "${titleEn}" — ${finalSteps.length} step${finalSteps.length === 1 ? "" : "s"}. Any missing translations were filled in with AI.`;
      if (more) msg += ` Moved on to block ${blockIdx + 2} of ${blockTitles.length}.`;
      if (unresolvedAssets) msg += ` ${unresolvedAssets} image/audio reference${unresolvedAssets === 1 ? "" : "s"} isn't a real URL — upload a file with a matching name, or fix it in the flow.`;
      toast.success(msg);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const skippedParts = summary ? Object.entries(summary.skipped).map(([k, v]) => `${v} ${k}`) : [];

  return (
    <div className="grid gap-3">
      <Textarea
        rows={flowSteps ? 8 : 16}
        className="font-mono text-xs"
        dir="ltr"
        value={jsonText}
        onChange={(e) => setJsonText(e.target.value)}
        placeholder={BLOCK_IMPORT_EXAMPLE}
      />
      {parseError ? (
        <p className="text-xs text-destructive">Invalid JSON — {parseError}</p>
      ) : (
        <p className="text-xs text-muted-foreground">The flow below updates automatically as you paste or edit the JSON.</p>
      )}

      {blockTitles.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">{blockTitles.length} blocks:</span>
          {blockTitles.map((title, i) => (
            <Button key={i} type="button" size="sm" variant={i === blockIdx ? "secondary" : "ghost"} className="h-7 text-xs" onClick={() => setBlockIdx(i)}>
              {i + 1}. {title}
            </Button>
          ))}
        </div>
      )}

      <div>
        <Label>Images &amp; audio (optional)</Label>
        <p className="text-xs text-muted-foreground mb-1.5">
          Upload files with the same name your JSON references — e.g. upload <code>hello.png</code> to fill in an item with <code>"image": "images/hello.png"</code>. Anything you don't upload is left as-is.
        </p>
        <Input type="file" multiple accept="image/*,audio/*" disabled={uploading} onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} />
        {uploading && <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Uploading…</p>}
        {Object.keys(assets).length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {Object.keys(assets).map((name) => (
              <span key={name} className="inline-flex items-center gap-1.5 text-xs bg-muted rounded-full pl-2.5 pr-1.5 py-1">
                {name}
                <button type="button" onClick={() => removeAsset(name)} className="text-muted-foreground hover:text-destructive"><X className="h-3 w-3" /></button>
              </span>
            ))}
          </div>
        )}
      </div>

      {flowSteps && (
        <div className="rounded-md border p-3 bg-muted/30 grid gap-3">
          <div>
            <Label>Lesson title (English)</Label>
            <Input dir="ltr" value={flowTitle} onChange={(e) => setFlowTitle(e.target.value)} />
            <p className="text-xs text-muted-foreground mt-1">Kurdish titles are generated automatically when you save.</p>
          </div>
          <div>
            <Label>Flow — step by step</Label>
            <p className="text-xs text-muted-foreground mt-0.5 mb-2">
              {summary
                ? `${flowSteps.length} step(s) from your JSON — ${summary.words} word(s), ${summary.sentences} sentence(s)${skippedParts.length ? `, skipped ${skippedParts.join(", ")}` : ""}.`
                : "This is exactly what learners will walk through."}{" "}
              Reorder, edit or delete steps, add a picture to any word, and fill Kurdish with AI. Editing the JSON above rebuilds this flow.
            </p>
            <LessonStepsEditor value={flowSteps} onChange={setFlowSteps} sourceLanguage={lang} courseId={course.id} />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        {addedCount > 0 ? <span className="text-xs text-muted-foreground">{addedCount} lesson{addedCount === 1 ? "" : "s"} added this session</span> : <span />}
        <Button onClick={runSave} disabled={saving || uploading || !flowSteps || flowSteps.length === 0}>
          {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}
          Save Lesson{blockTitles.length > 1 ? ` (block ${blockIdx + 1}/${blockTitles.length})` : ""}
        </Button>
      </div>
    </div>
  );
}



type LessonStep =
  | { type: "word"; target: string; kurdish_sorani?: string; kurdish_badini?: string; audio_url?: string; image_url?: string }
  | { type: "sentence"; target: string; kurdish_sorani?: string; kurdish_badini?: string; audio_url?: string; image_url?: string }
  | { type: "image"; url: string; caption?: string }
  | { type: "tip"; text: string };

function blankStep(type: LessonStep["type"]): LessonStep {
  if (type === "word" || type === "sentence") return { type, target: "", kurdish_sorani: "", kurdish_badini: "", audio_url: "", image_url: "" };
  if (type === "image") return { type, url: "", caption: "" };
  return { type, text: "" };
}

const JSON_STEPS_EXAMPLE = `[
  { "type": "word", "target": "Hello", "kurdish_sorani": "", "kurdish_badini": "" },
  { "type": "sentence", "target": "Hello, my name is John." },
  { "type": "image", "url": "https://.../hello.png", "caption": "optional" },
  { "type": "tip", "text": "optional grammar aside" }
]`;

const BLOCK_IMPORT_EXAMPLE = `{
  "title": "Greetings",
  "content": [
    { "type": "word", "word": "Hello", "translation": "سڵاو", "image": "images/hello.png", "sentence": "Hello, my name is John." },
    { "type": "word", "word": "Goodbye", "translation": "خواحافیز", "sentence": "Goodbye! See you tomorrow." }
  ]
}`;

type ImportSummary = { words: number; sentences: number; images: number; tips: number; assetWarnings: number; skipped: Record<string, number> };

// Accepts either the app's own step shape (target/kurdish_sorani/kurdish_badini/audio_url)
// or the more natural "word bundle" shape from a hand-authored course JSON
// (word/translation/image/audio/sentence combined on one object) and normalizes
// either into the app's LessonStep[]. review/test/exam items aren't supported
// yet, so they're counted and skipped rather than silently dropped.
function blockContentToSteps(content: unknown[]): { steps: LessonStep[]; summary: ImportSummary } {
  const steps: LessonStep[] = [];
  const summary: ImportSummary = { words: 0, sentences: 0, images: 0, tips: 0, assetWarnings: 0, skipped: {} };
  const asStr = (v: unknown): string => (typeof v === "string" ? v : v == null ? "" : String(v));
  const asAsset = (v: unknown): string => {
    const s = asStr(v);
    if (s && !/^https?:\/\//i.test(s)) summary.assetWarnings++;
    return s;
  };

  for (const raw of content ?? []) {
    const item = (raw ?? {}) as Record<string, unknown>;
    const type = typeof item.type === "string" ? item.type : undefined;

    if (type === "word") {
      steps.push({
        type: "word",
        target: asStr(item.word ?? item.target),
        kurdish_sorani: asStr(item.translation ?? item.kurdish_sorani),
        kurdish_badini: asStr(item.kurdish_badini),
        audio_url: item.audio || item.audio_url ? asAsset(item.audio ?? item.audio_url) : "",
        image_url: item.image || item.image_url ? asAsset(item.image ?? item.image_url) : "",
      });
      summary.words++;
      if (item.image || item.image_url) summary.images++;
      if (item.sentence) {
        steps.push({ type: "sentence", target: asStr(item.sentence), kurdish_sorani: "", kurdish_badini: "", audio_url: "", image_url: "" });
        summary.sentences++;
      }
    } else if (type === "sentence") {
      steps.push({
        type: "sentence",
        target: asStr(item.target ?? item.sentence),
        kurdish_sorani: asStr(item.kurdish_sorani ?? item.translation),
        kurdish_badini: asStr(item.kurdish_badini),
        audio_url: item.audio || item.audio_url ? asAsset(item.audio ?? item.audio_url) : "",
        image_url: item.image || item.image_url ? asAsset(item.image ?? item.image_url) : "",
      });
      summary.sentences++;
    } else if (type === "image") {
      steps.push({ type: "image", url: asAsset(item.url ?? item.image), caption: asStr(item.caption) });
      summary.images++;
    } else if (type === "tip") {
      steps.push({ type: "tip", text: asStr(item.text) });
      summary.tips++;
    } else {
      const key = type ?? "unknown";
      summary.skipped[key] = (summary.skipped[key] ?? 0) + 1;
    }
  }
  return { steps, summary };
}

function LessonStepsEditor({ value, onChange, sourceLanguage, courseId }: { value: LessonStep[]; onChange: (v: LessonStep[]) => void; sourceLanguage: string; courseId?: string }) {
  const steps = value ?? [];
  const translate = useServerFn(translateLessonWords);
  const makeImage = useServerFn(generateWordImage);
  const findPhotos = useServerFn(searchWordPhotos);
  const importPhoto = useServerFn(importPhotoToLibrary);
  const [translatingAll, setTranslatingAll] = useState(false);
  const [translatingIdx, setTranslatingIdx] = useState<number | null>(null);
  const [imagingIdx, setImagingIdx] = useState<number | null>(null);
  const [imagingAll, setImagingAll] = useState(false);
  const [mode, setMode] = useState<"builder" | "json">("builder");
  // Stock-photo picker: real photos usually explain a concrete word better than AI art.
  const [photoFor, setPhotoFor] = useState<number | null>(null);
  const [photoQuery, setPhotoQuery] = useState("");
  const [photoHits, setPhotoHits] = useState<{ url: string; thumb: string; credit: string }[]>([]);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoPicking, setPhotoPicking] = useState<string | null>(null);
  const [photosAll, setPhotosAll] = useState(false);


  const update = (i: number, patch: Record<string, unknown>) => {
    const next = steps.slice();
    next[i] = { ...next[i], ...patch } as LessonStep;
    onChange(next);
  };
  const remove = (i: number) => onChange(steps.filter((_, idx) => idx !== i));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= steps.length) return;
    const next = steps.slice();
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const add = (type: LessonStep["type"]) => onChange([...steps, blankStep(type)]);

  const isWordOrSentence = (s: LessonStep): s is Extract<LessonStep, { type: "word" | "sentence" }> =>
    s.type === "word" || s.type === "sentence";

  const translateStep = async (i: number) => {
    const s = steps[i];
    if (!isWordOrSentence(s) || !s.target.trim()) return;
    setTranslatingIdx(i);
    try {
      const res = await translate({ data: { source_language: sourceLanguage as never, items: [{ text: s.target }] } });
      const tr = res.translations[0];
      update(i, { kurdish_sorani: tr.sorani, kurdish_badini: tr.badini });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setTranslatingIdx(null);
    }
  };

  const translateAllMissing = async () => {
    const targets = steps
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => isWordOrSentence(s) && s.target.trim() && !(s.kurdish_sorani?.trim() && s.kurdish_badini?.trim()));
    if (targets.length === 0) {
      toast.info("Nothing to translate — every word/sentence already has both Kurdish fields filled in.");
      return;
    }
    setTranslatingAll(true);
    try {
      const res = await translate({
        data: { source_language: sourceLanguage as never, items: targets.map(({ s }) => ({ text: (s as { target: string }).target })) },
      });
      const next = steps.slice();
      targets.forEach(({ i }, idx) => {
        const tr = res.translations[idx];
        next[i] = { ...next[i], kurdish_sorani: tr.sorani, kurdish_badini: tr.badini } as LessonStep;
      });
      onChange(next);
      toast.success(`Translated ${targets.length} item${targets.length === 1 ? "" : "s"}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setTranslatingAll(false);
    }
  };

  // Picture support: any word/sentence step can carry an illustration so learners
  // grasp the meaning visually. Images are either generated with AI or uploaded.
  const generateImageFor = async (i: number) => {
    const s = steps[i];
    if (!isWordOrSentence(s) || !s.target.trim()) return;
    setImagingIdx(i);
    try {
      const res = await makeImage({ data: { word: s.target, hint: s.kurdish_sorani || undefined, course_id: courseId } });
      update(i, { image_url: res.url });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setImagingIdx(null);
    }
  };

  const generateAllMissingImages = async () => {
    const targets = steps
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => s.type === "word" && s.target.trim() && !s.image_url?.trim());
    if (targets.length === 0) {
      toast.info("Every word already has a picture.");
      return;
    }
    setImagingAll(true);
    const next = steps.slice();
    let done = 0;
    for (const { s, i } of targets) {
      try {
        const res = await makeImage({ data: { word: (s as { target: string }).target, course_id: courseId } });
        next[i] = { ...next[i], image_url: res.url } as LessonStep;
        done++;
        onChange(next.slice());
      } catch (e) {
        toast.error(`${(s as { target: string }).target}: ${(e as Error).message}`);
        break;
      }
    }
    setImagingAll(false);
    if (done) toast.success(`Generated ${done} picture${done === 1 ? "" : "s"}`);
  };

  const uploadImageFor = async (i: number, file: File) => {
    setImagingIdx(i);
    try {
      const path = `${courseId ?? "words"}/up-${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("lesson-assets").upload(path, file, { contentType: file.type || undefined });
      if (error) throw new Error(error.message);
      update(i, { image_url: supabase.storage.from("lesson-assets").getPublicUrl(path).data.publicUrl });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setImagingIdx(null);
    }
  };

  // --- Stock photo search (Pixabay when a key is set, otherwise Openverse) ---
  const runPhotoSearch = async (q: string) => {
    if (!q.trim()) return;
    setPhotoLoading(true);
    try {
      const res = await findPhotos({ data: { query: q.trim(), limit: 12 } });
      setPhotoHits(res.hits);
      if (res.hits.length === 0) toast.info(`No photos found for "${q}". Try a simpler word.`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPhotoLoading(false);
    }
  };

  const openPhotoPicker = (i: number) => {
    const s = steps[i];
    const q = isWordOrSentence(s) ? s.target : "";
    setPhotoFor(i);
    setPhotoQuery(q);
    setPhotoHits([]);
    if (q.trim()) void runPhotoSearch(q);
  };

  const choosePhoto = async (url: string) => {
    if (photoFor === null) return;
    const s = steps[photoFor];
    setPhotoPicking(url);
    try {
      const res = await importPhoto({ data: { url, word: isWordOrSentence(s) ? s.target : undefined, course_id: courseId } });
      update(photoFor, { image_url: res.url });
      setPhotoFor(null);
      toast.success("Picture added");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPhotoPicking(null);
    }
  };

  const findAllMissingPhotos = async () => {
    const targets = steps
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => s.type === "word" && s.target.trim() && !s.image_url?.trim());
    if (targets.length === 0) {
      toast.info("Every word already has a picture.");
      return;
    }
    setPhotosAll(true);
    const next = steps.slice();
    let done = 0;
    for (const { s, i } of targets) {
      const word = (s as { target: string }).target;
      try {
        const res = await findPhotos({ data: { query: word, limit: 1 } });
        const hit = res.hits[0];
        if (!hit) continue;
        const saved = await importPhoto({ data: { url: hit.url, word, course_id: courseId } });
        next[i] = { ...next[i], image_url: saved.url } as LessonStep;
        done++;
        onChange(next.slice());
      } catch (e) {
        toast.error(`${word}: ${(e as Error).message}`);
        break;
      }
    }
    setPhotosAll(false);
    toast[done ? "success" : "info"](done ? `Added ${done} photo${done === 1 ? "" : "s"}` : "No photos found for the remaining words.");
  };



  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="inline-flex rounded-md border p-0.5 bg-muted/40">
          <Button type="button" size="sm" variant={mode === "builder" ? "default" : "ghost"} className="h-7 px-2.5" onClick={() => setMode("builder")}>Builder</Button>
          <Button type="button" size="sm" variant={mode === "json" ? "default" : "ghost"} className="h-7 px-2.5" onClick={() => setMode("json")}>Paste JSON</Button>
        </div>
        {steps.some(isWordOrSentence) && (
          <div className="flex gap-2 flex-wrap">
            <Button type="button" variant="secondary" size="sm" onClick={translateAllMissing} disabled={translatingAll}>
              {translatingAll ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1.5" />}
              Translate all with AI
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={findAllMissingPhotos} disabled={photosAll || imagingAll}>
              {photosAll ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> : <Search className="h-3 w-3 mr-1.5" />}
              Find missing photos
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={generateAllMissingImages} disabled={imagingAll || photosAll}>
              {imagingAll ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> : <ImageIcon className="h-3 w-3 mr-1.5" />}
              Generate missing pictures (AI)
            </Button>
          </div>
        )}
      </div>


      {mode === "json" ? (
        <div className="grid gap-1.5">
          <Textarea
            rows={14}
            className="font-mono text-xs"
            dir="ltr"
            value={JSON.stringify(steps, null, 2)}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);
                if (Array.isArray(parsed)) onChange(parsed);
              } catch {
                /* keep typing */
              }
            }}
          />
          <p className="text-xs text-muted-foreground">
            Paste an array of step objects. Leave <code>kurdish_sorani</code> / <code>kurdish_badini</code> blank and use "Translate all with AI" (above) to fill them in.
          </p>
          <pre className="text-[11px] leading-snug bg-muted/40 rounded-md p-2 overflow-x-auto">{JSON_STEPS_EXAMPLE}</pre>
        </div>
      ) : (
        <>
          {steps.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No steps yet — learners will go straight from the intro to the quiz. Add a word or sentence below to build a step-by-step walkthrough first.
            </p>
          )}
          {steps.map((s, i) => (
            <div key={i} className="rounded-md border p-3 bg-muted/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{i + 1}. {s.type}</span>
                <div className="flex gap-1">
                  <Button type="button" size="icon" variant="ghost" className="h-6 w-6" onClick={() => move(i, -1)} disabled={i === 0}><ChevronUp className="h-3 w-3" /></Button>
                  <Button type="button" size="icon" variant="ghost" className="h-6 w-6" onClick={() => move(i, 1)} disabled={i === steps.length - 1}><ChevronDown className="h-3 w-3" /></Button>
                  <Button type="button" size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => remove(i)}><Trash2 className="h-3 w-3" /></Button>
                </div>
              </div>

              {(s.type === "word" || s.type === "sentence") && (
                <div className="grid gap-2">
                  <Input
                    dir="ltr"
                    placeholder={s.type === "word" ? "Word, e.g. apple" : "Sentence, e.g. I eat an apple every day."}
                    value={s.target}
                    onChange={(e) => update(i, { target: e.target.value })}
                  />
                  <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                    <Input dir="rtl" placeholder="Kurdish (Sorani)" value={s.kurdish_sorani ?? ""} onChange={(e) => update(i, { kurdish_sorani: e.target.value })} />
                    <Input dir="rtl" placeholder="Kurdish (Badini)" value={s.kurdish_badini ?? ""} onChange={(e) => update(i, { kurdish_badini: e.target.value })} />
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="h-9 w-9 shrink-0"
                      title="Translate this with AI"
                      onClick={() => translateStep(i)}
                      disabled={translatingIdx === i || !s.target.trim()}
                    >
                      {translatingIdx === i ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                  <Input placeholder="Audio URL (optional — leave blank to use text-to-speech)" value={s.audio_url ?? ""} onChange={(e) => update(i, { audio_url: e.target.value })} />
                  <div className="rounded-md border bg-background p-2 grid gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-medium text-muted-foreground">Picture</span>
                      <Button type="button" size="sm" variant="outline" className="h-7" disabled={!s.target.trim()} onClick={() => openPhotoPicker(i)}>
                        <Search className="h-3 w-3 mr-1.5" />
                        Find photo
                      </Button>
                      <Button type="button" size="sm" variant="ghost" className="h-7" disabled={imagingIdx === i || imagingAll || !s.target.trim()} onClick={() => generateImageFor(i)}>
                        {imagingIdx === i ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> : <ImageIcon className="h-3 w-3 mr-1.5" />}
                        {s.image_url ? "Regenerate with AI" : "AI illustration"}
                      </Button>
                      <label className="text-xs underline cursor-pointer text-muted-foreground">
                        upload
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImageFor(i, f); e.target.value = ""; }} />
                      </label>
                      {s.image_url && (
                        <button type="button" className="text-xs text-destructive" onClick={() => update(i, { image_url: "" })}>remove</button>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {s.image_url && <img src={s.image_url} alt="" className="h-14 w-14 rounded-md object-cover border" />}
                      <Input dir="ltr" placeholder="Image URL (optional)" value={s.image_url ?? ""} onChange={(e) => update(i, { image_url: e.target.value })} />
                    </div>
                  </div>
                </div>
              )}
              {s.type === "image" && (
                <div className="grid gap-2">
                  <Input placeholder="Image URL" value={s.url} onChange={(e) => update(i, { url: e.target.value })} />
                  <Input placeholder="Caption (optional)" value={s.caption ?? ""} onChange={(e) => update(i, { caption: e.target.value })} />
                </div>
              )}
              {s.type === "tip" && (
                <Textarea placeholder="A short note or grammar aside" value={s.text} onChange={(e) => update(i, { text: e.target.value })} />
              )}
            </div>
          ))}

          <div className="flex flex-wrap gap-2 mt-1">
            <Button type="button" variant="outline" size="sm" onClick={() => add("word")}>+ Word</Button>
            <Button type="button" variant="outline" size="sm" onClick={() => add("sentence")}>+ Sentence</Button>
            <Button type="button" variant="outline" size="sm" onClick={() => add("image")}>+ Image</Button>
            <Button type="button" variant="outline" size="sm" onClick={() => add("tip")}>+ Tip</Button>
          </div>
        </>
      )}
    </div>
  );
}

function LessonForm({ value, onChange, lang }: { value: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void; lang: string }) {
  const set = (k: string, v: unknown) => onChange({ ...value, [k]: v });
  const translate = useServerFn(translateLessonWords);
  const [translatingTitle, setTranslatingTitle] = useState(false);

  const translateTitle = async () => {
    const titleEn = ((value.title_en ?? "") as string).trim();
    if (!titleEn) {
      toast.error("Type an English title first.");
      return;
    }
    setTranslatingTitle(true);
    try {
      const res = await translate({ data: { source_language: lang as never, items: [{ text: titleEn }] } });
      const tr = res.translations[0];
      onChange({ ...value, title_sorani: tr.sorani, title_badini: tr.badini });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setTranslatingTitle(false);
    }
  };

  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
        <div><Label>Title (English)</Label><Input value={(value.title_en ?? "") as string} onChange={(e) => set("title_en", e.target.value)} /></div>
        <Button type="button" variant="outline" size="sm" onClick={translateTitle} disabled={translatingTitle}>
          {translatingTitle ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1.5" />}
          Translate title
        </Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div><Label>Order</Label><Input type="number" value={value.order_index as number} onChange={(e) => set("order_index", Number(e.target.value))} /></div>
        <div><Label>Title (Sorani)</Label><Input value={(value.title_sorani ?? "") as string} onChange={(e) => set("title_sorani", e.target.value)} /></div>
      </div>
      <div><Label>Title (Badini)</Label><Input value={(value.title_badini ?? "") as string} onChange={(e) => set("title_badini", e.target.value)} /></div>
      <div><Label>Summary (Sorani)</Label><Textarea value={(value.summary_sorani ?? "") as string} onChange={(e) => set("summary_sorani", e.target.value)} /></div>
      <div><Label>Summary (Badini)</Label><Textarea value={(value.summary_badini ?? "") as string} onChange={(e) => set("summary_badini", e.target.value)} /></div>
      <div><Label>Summary (English)</Label><Textarea value={(value.summary_en ?? "") as string} onChange={(e) => set("summary_en", e.target.value)} /></div>
      <div><Label>Grammar (Sorani, Markdown)</Label><Textarea rows={5} value={(value.grammar_md_sorani ?? "") as string} onChange={(e) => set("grammar_md_sorani", e.target.value)} /></div>
      <div><Label>Grammar (Badini, Markdown)</Label><Textarea rows={5} value={(value.grammar_md_badini ?? "") as string} onChange={(e) => set("grammar_md_badini", e.target.value)} /></div>
      <div><Label>Grammar (English, Markdown)</Label><Textarea rows={5} value={(value.grammar_md_en ?? "") as string} onChange={(e) => set("grammar_md_en", e.target.value)} /></div>

      <div className="rounded-md border p-3 bg-muted/30">
        <Label>Words &amp; Sentences (step-by-step)</Label>
        <p className="text-xs text-muted-foreground mt-0.5 mb-3">Learners walk through these one at a time, before the quiz. Each word/sentence is read aloud automatically. Type the word — click the <Sparkles className="h-3 w-3 inline -mt-0.5" /> button or "Translate all with AI" to fill in the Kurdish fields instead of typing them yourself.</p>
        <LessonStepsEditor value={(value.steps_json as LessonStep[]) ?? []} onChange={(v) => set("steps_json", v)} sourceLanguage={lang} courseId={value.course_id as string | undefined} />
      </div>

      <div>
        <Label>Dialogue JSON: [{"{"}"speaker","text","translation_sorani","translation_badini"{"}"}]</Label>
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
        <Button onClick={() => { setEditing({ language_code: lang, level_cefr: "A1", category: null, title: "", video_path: "", banner_path: "", youtube_id: "", transcript_json: [] }); setOpen(true); }}>{t("add_new")}</Button>
      </div>
      <VideoWordsSummary videos={q.data?.videos ?? []} />
      <div className="grid gap-2">
        {(q.data?.videos ?? []).length === 0 && <p className="text-muted-foreground">{t("no_data")}</p>}
        {(q.data?.videos ?? []).map((v) => (
          <Card key={v.id}>
            <CardContent className="p-3 flex justify-between items-center">
              <div>
                <div className="font-medium flex items-center gap-2 flex-wrap">
                  {v.title}
                  {v.category ? <Badge variant="secondary">{t(`video_category_${v.category}` as never)}</Badge> : null}
                </div>
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

// Small stats strip above the video list: total transcript word count and
// highlighted-word count across every video currently loaded (i.e. for the
// selected language), plus an expandable list of the highlights themselves.
// Pulled straight out of transcript_json — no extra query needed.
function VideoWordsSummary({ videos }: { videos: Array<{ id: string; title: string; transcript_json: unknown }> }) {
  const [expanded, setExpanded] = useState(false);
  const { totalWords, highlights } = useMemo(() => {
    let totalWords = 0;
    const highlights: Array<WordHighlight & { videoTitle: string }> = [];
    for (const v of videos) {
      const lines = (v.transcript_json as TranscriptLine[]) ?? [];
      for (const line of lines) {
        totalWords += tokenizeWords(line.en).length;
        for (const h of line.highlights ?? []) highlights.push({ ...h, videoTitle: v.title });
      }
    }
    return { totalWords, highlights };
  }, [videos]);

  if (videos.length === 0) return null;

  return (
    <Card className="mb-4">
      <CardContent className="p-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="font-display font-semibold">Words</h3>
          <div className="flex gap-4 text-sm">
            <span><span className="font-semibold">{totalWords}</span> <span className="text-muted-foreground">total words</span></span>
            <span><span className="font-semibold">{highlights.length}</span> <span className="text-muted-foreground">highlighted</span></span>
          </div>
        </div>
        {highlights.length > 0 && (
          <>
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground mt-2 underline decoration-dotted"
              onClick={() => setExpanded((e) => !e)}
            >
              {expanded ? "Hide highlighted words" : `Show highlighted words (${highlights.length})`}
            </button>
            {expanded && (
              <div className="mt-3 grid gap-1.5 max-h-64 overflow-y-auto pr-1">
                {highlights.map((h, i) => (
                  <div key={`${h.id}-${i}`} className="flex items-center justify-between gap-3 text-sm rounded-md border px-2.5 py-1.5 bg-muted/20">
                    <div className="min-w-0 flex items-baseline gap-2">
                      <span dir="ltr" className="font-medium">{h.word}</span>
                      <span dir="rtl" className="text-muted-foreground truncate">{h.meaning_ku_sorani || h.meaning_en || "—"}</span>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0 truncate max-w-[35%]">{h.videoTitle}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
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

// Reads a video file's duration in the browser (via a throwaway <video>
// element's loadedmetadata event) so it can be saved to duration_seconds
// automatically on upload — nothing server-side ever inspects the file, and
// admins never have to type a duration in by hand. Resolves to null if the
// browser can't read it (corrupt/unsupported file), in which case the video
// still uploads fine, it just won't count toward the "total video length"
// stat on Admin > Highlights until a duration is available.
function readVideoDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const el = document.createElement("video");
    el.preload = "metadata";
    const cleanup = (result: number | null) => { URL.revokeObjectURL(url); resolve(result); };
    el.onloadedmetadata = () => cleanup(Number.isFinite(el.duration) ? Math.round(el.duration) : null);
    el.onerror = () => cleanup(null);
    el.src = url;
  });
}

function VideoForm({ value, onChange }: { value: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void }) {
  const { t } = useDialect();
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
      // video_path and duration_seconds are merged into one onChange call (rather than two
      // separate set() calls) since set()'s closure over `value` would otherwise go stale
      // while awaiting the duration read, silently dropping the video_path update.
      const seconds = await readVideoDuration(file);
      onChange({ ...value, video_path: path, ...(seconds ? { duration_seconds: seconds } : {}) });
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
      <div><Label>{t("video_category")}</Label>
        <Select
          value={(value.category as string) || "uncategorized"}
          onValueChange={(v) => set("category", v === "uncategorized" ? null : v)}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="uncategorized">{t("video_category_uncategorized")}</SelectItem>
            {VIDEO_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{t(`video_category_${c}` as never)}</SelectItem>)}
          </SelectContent>
        </Select>
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
  /** Set when this paragraph has an admin-uploaded, speech-recognized narration MP3 attached (see the "Upload audio" panel). */
  audio_path?: string;
  audio_word_timings?: { start: number; end: number }[];
  audio_text_hash?: string;
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
  const transcribeFn = useServerFn(transcribeBookAudio);
  const [transcribingAudio, setTranscribingAudio] = useState(false);
  const [audioProgress, setAudioProgress] = useState<{ done: number; total: number } | null>(null);
  const [importingPdf, setImportingPdf] = useState(false);
  const [pdfProgress, setPdfProgress] = useState<{ done: number; total: number } | null>(null);

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

  // Upload a whole PDF at once. Pages with a real text layer are read
  // directly by pdf.js (instant, free) and any images sitting on those pages
  // are cropped out and uploaded as inline image blocks. Pages with no text
  // layer (a scan, or a pure illustration) are inserted as an image block
  // instead of text — nothing guesses at the words. To get real text (and
  // narration audio) for one of those pages, upload a recording of it being
  // read aloud in the "Upload audio" panel below.
  const onUploadPdfBook = async (file: File) => {
    setImportingPdf(true);
    setPdfProgress({ done: 0, total: 0 });
    try {
      const lang = (value.language_code as string) || "en";
      const pages = await extractPdfBook(file, (done, total) => setPdfProgress({ done, total }));

      // Upload embedded images (present on pages that already had text) and
      // whole-page images (for pages with no text layer) to the same public bucket.
      const imagePathsByPage = new Map<number, string[]>();
      for (const page of pages) {
        const blobs = page.noTextLayer ? (page.pageImage ? [page.pageImage] : []) : page.images;
        if (blobs.length === 0) continue;
        const paths: string[] = [];
        for (const blob of blobs) {
          const ext = page.noTextLayer ? "jpg" : "png";
          const path = `${lang}/${crypto.randomUUID()}.${ext}`;
          const { error } = await supabase.storage
            .from("book-images")
            .upload(path, blob, { upsert: false, contentType: page.noTextLayer ? "image/jpeg" : "image/png" });
          if (error) throw error;
          paths.push(path);
        }
        imagePathsByPage.set(page.pageNumber, paths);
      }

      // Stitch it all back together in original page order: a page's
      // paragraph(s) first, then any images that sat on that page (or, for a
      // page with no text layer, the whole page as a single image).
      const newParagraphs: BookParagraph[] = [];
      for (const page of pages) {
        for (const text of page.paragraphs) {
          newParagraphs.push({ type: "paragraph", text, ku_sorani: "", ku_badini: "" });
        }
        for (const imagePath of imagePathsByPage.get(page.pageNumber) ?? []) {
          newParagraphs.push({ type: "image", image_path: imagePath, caption: "" });
        }
      }

      const existing = (value.content_json as BookParagraph[]) ?? [];
      set("content_json", [...existing, ...newParagraphs]);

      const noTextLayerCount = pages.filter((p) => p.noTextLayer).length;
      const imageCount = newParagraphs.filter((p) => p.type === "image").length;
      const paragraphCount = newParagraphs.length - imageCount;
      toast.success(
        `Added ${paragraphCount} paragraph${paragraphCount === 1 ? "" : "s"}` +
          (imageCount ? ` and ${imageCount} image${imageCount === 1 ? "" : "s"}` : "") +
          ` from ${pages.length} page${pages.length === 1 ? "" : "s"}` +
          (noTextLayerCount
            ? ` (${noTextLayerCount} had no text layer and were added as images — use the audio panel below or type the text in manually)`
            : ""),
      );
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setImportingPdf(false);
      setPdfProgress(null);
    }
  };

  // Upload one or more MP3 recordings of the book being read aloud — one file
  // per paragraph or page works best. Files are recognized one at a time
  // (not batched together): each is uploaded to the public "book-audio"
  // bucket, sent to speech-to-text, and turned into a new paragraph with the
  // recognized text and that audio attached, so the reader can play the real
  // recording back with word-by-word highlighting.
  const onUploadBookAudio = async (files: File[]) => {
    setTranscribingAudio(true);
    setAudioProgress({ done: 0, total: files.length });
    try {
      const lang = (value.language_code as string) || "en";
      let skipped = 0;
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const ext = file.name.split(".").pop() || "mp3";
        const path = `${lang}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("book-audio").upload(path, file, { upsert: false, contentType: file.type || "audio/mpeg" });
        if (error) throw error;

        try {
          const { text, wordTimings } = await transcribeFn({ data: { path } });
          const existing = (value.content_json as BookParagraph[]) ?? [];
          const newParagraph: BookParagraph = {
            type: "paragraph",
            text,
            ku_sorani: "",
            ku_badini: "",
            audio_path: path,
            audio_word_timings: wordTimings,
            audio_text_hash: hashText(text),
          };
          set("content_json", [...existing, newParagraph]);
        } catch (e) {
          skipped += 1;
          toast.error(`${file.name}: ${(e as Error).message}`);
        }
        setAudioProgress({ done: i + 1, total: files.length });
      }
      const added = files.length - skipped;
      if (added > 0) {
        toast.success(`Added ${added} paragraph${added === 1 ? "" : "s"} from ${added} recording${added === 1 ? "" : "s"}`);
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setTranscribingAudio(false);
      setAudioProgress(null);
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
        <Label>Upload a PDF</Label>
        <p className="text-xs text-muted-foreground">
          Upload the whole book as one PDF and it's split into pages automatically. Pages with
          real text (almost any exported or "printed to PDF" book) are read directly and
          instantly, and any pictures sitting on those pages are pulled out and added as image
          blocks right where they belong. Pages with no text layer (a scan, or a page that's a
          pure illustration) are added as a single image instead — use the audio panel below, or
          type the text in manually further down, to give that page real, readable text.
        </p>
        <Input
          type="file"
          accept="application/pdf"
          disabled={importingPdf}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onUploadPdfBook(f);
            e.target.value = "";
          }}
        />
        {importingPdf && (
          <p className="text-xs flex items-center gap-1.5">
            <Loader2 className="h-3 w-3 animate-spin" />
            Reading PDF… {pdfProgress ? `${pdfProgress.done}/${pdfProgress.total} pages` : ""}
          </p>
        )}
      </div>

      <div className="rounded-md border p-3 bg-muted/30 grid gap-2">
        <Label>Upload audio (speech is recognized automatically)</Label>
        <p className="text-xs text-muted-foreground">
          Upload MP3 recordings of the book being read aloud, in reading order — one file per
          paragraph or page works best. Each recording is recognized one at a time and added
          below as a paragraph with its text and that exact audio attached, so learners can play
          the real recording back with word-by-word highlighting while they read.
        </p>
        <Input
          type="file"
          accept="audio/mpeg,audio/mp3,.mp3"
          multiple
          disabled={transcribingAudio}
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length) onUploadBookAudio(files);
            e.target.value = "";
          }}
        />
        {transcribingAudio && (
          <p className="text-xs flex items-center gap-1.5">
            <Loader2 className="h-3 w-3 animate-spin" />
            Recognizing speech… {audioProgress ? `${audioProgress.done}/${audioProgress.total}` : ""}
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
          No content yet. Click "Add paragraph" / "Add image" above, or upload a PDF or audio recordings above.
        </p>
      )}
      {value.map((p, i) => {
        const isImage = p.type === "image";
        const hasAudio = !isImage && !!p.audio_path;
        const audioStale = hasAudio && p.audio_text_hash !== hashText(p.text ?? "");
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
                  {hasAudio && (
                    <div className="flex items-center justify-between gap-2 text-xs rounded border bg-background px-2 py-1.5">
                      <span className="text-muted-foreground">
                        🎙️ Narration audio attached
                        {audioStale && " — text edited since, highlighting may be off"}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2"
                        onClick={() => update(i, { audio_path: undefined, audio_word_timings: undefined, audio_text_hash: undefined })}
                      >
                        Remove audio
                      </Button>
                    </div>
                  )}
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

function formatDuration(totalSeconds: number): string {
  if (!totalSeconds) return "0m";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/**
 * Admin > Highlights: every highlighted word across every video's transcript
 * (all languages, all levels) in one searchable table, plus two live counters
 * — total words transcribed and total video runtime — sourced from
 * adminGetVideoInsights. Both counters recompute from whatever's actually in
 * the database on every load, so uploading/transcribing/highlighting more
 * videos later just makes the numbers grow; nothing here needs to be
 * manually kept in sync.
 */
function HighlightsTab() {
  const { t } = useDialect();
  const fn = useServerFn(adminGetVideoInsights);
  const q = useQuery({ queryKey: ["admin-video-insights"], queryFn: () => fn({}) });
  const [search, setSearch] = useState("");
  const [langFilter, setLangFilter] = useState("all");

  const highlights = q.data?.highlights ?? [];
  const filtered = highlights.filter((h) => {
    if (langFilter !== "all" && h.language_code !== langFilter) return false;
    const needle = search.trim().toLowerCase();
    if (!needle) return true;
    return (
      h.word.toLowerCase().includes(needle) ||
      h.meaning_en.toLowerCase().includes(needle) ||
      h.meaning_ku_sorani.includes(search.trim()) ||
      h.meaning_ku_badini.includes(search.trim()) ||
      h.video_title.toLowerCase().includes(needle)
    );
  });

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">{t("admin_highlighted_words")}</div>
            <div className="text-3xl font-display font-bold">{q.isLoading ? "—" : highlights.length.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">{t("admin_words_transcribed")}</div>
            <div className="text-3xl font-display font-bold">{q.isLoading ? "—" : (q.data?.totalWordsTranscribed ?? 0).toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">{t("admin_total_video_length")}</div>
            <div className="text-3xl font-display font-bold">{q.isLoading ? "—" : formatDuration(q.data?.totalDurationSeconds ?? 0)}</div>
            {!!q.data?.videosMissingDuration && (
              <div className="text-[11px] text-muted-foreground mt-1">
                {q.data.videosMissingDuration} of {q.data.totalVideos} video{q.data.totalVideos === 1 ? "" : "s"} uploaded before duration tracking — those aren't counted yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Input
          placeholder="Search words, meanings, or video title…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={langFilter} onValueChange={setLangFilter}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All languages</SelectItem>
            {LANGS.map((l) => <SelectItem key={l} value={l}>{l.toUpperCase()}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {q.isLoading ? (
        <p className="text-muted-foreground">{t("loading")}</p>
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground">{t("no_data")}</p>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Word</TableHead>
                <TableHead>Meaning (English)</TableHead>
                <TableHead>Meaning (Kurdish)</TableHead>
                <TableHead>Video</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((h) => (
                <TableRow key={h.key}>
                  <TableCell>
                    <div className="font-medium">{h.word}</div>
                    <Badge variant="secondary" className="mt-1 text-[10px] font-normal">{h.part_of_speech}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[240px]">{h.meaning_en || "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[240px]">
                    <div dir="rtl">{h.meaning_ku_sorani || "—"}</div>
                    {h.meaning_ku_badini && <div dir="rtl" className="opacity-70">{h.meaning_ku_badini}</div>}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {h.video_title}
                    <span className="block uppercase">{h.language_code} · {h.level_cefr}</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
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
