// Three-step lesson builder used from Admin → Lessons.
//   1. Details — pick the course (unless it's already locked in) and name
//      the lesson. Nothing technical here, just what the learner will see.
//   2. Build the lesson on an n8n-style workflow canvas — every node is one
//      step the learner will see; click a node to edit it in the side panel.
//      A JSON blob can optionally be imported here to fast-forward, but it's
//      never required — words/sentences/pictures/tips can all be added by
//      hand from the toolbar.
//   3. Add a cover image and save — the lesson then shows up in its course's
//      lesson list immediately.
// Editing an existing lesson re-opens the very same steps, pre-filled with
// whatever was saved (plus the JSON it was originally imported from, if
// any), so nothing has to be rebuilt from scratch.
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Loader2, Plus, Trash2, ArrowLeft, ArrowRight, Image as ImageIcon, Volume2,
  Sparkles, Search, Upload, X, Type, MessageSquare, Lightbulb, HelpCircle, ZoomIn, ZoomOut, Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { type LessonStep, blankStep, parseLessonJson, JSON_STEPS_EXAMPLE } from "@/lib/lesson-steps";
import {
  adminUpsertLesson, adminUpsertExercise, adminDeleteExercise,
  translateLessonWords, searchWordPhotos, importPhotoToLibrary, generateWordImage, generateWordAudio,
} from "@/lib/admin.functions";

export type WizardExercise = {
  id?: string;
  type: "multiple_choice" | "fill_blank" | "translate" | "listening";
  prompt: string;
  choices: string[];
  correct: string;
  hint_sorani?: string;
  hint_badini?: string;
};

export type WizardLesson = {
  id?: string;
  title_en?: string | null;
  title_sorani?: string | null;
  title_badini?: string | null;
  order_index?: number;
  cover_image_path?: string | null;
  source_json?: string | null;
  steps_json?: unknown;
  lesson_exercises?: Array<{ id: string; type: string; order_index: number; prompt_json: unknown; answer_json: unknown }>;
};

// A course the admin can pick for a new lesson when one isn't already
// locked in (see the `course` vs `courses` props below).
export type WizardCourseOption = {
  id: string;
  level_id: string;
  title_sorani: string;
  title_badini?: string | null;
  title_en?: string | null;
  lessons?: Array<{ id: string }> | null;
};

type Node = { kind: "step"; index: number } | { kind: "exercise"; index: number };

const STEP_LABELS = ["Details", "Build lesson", "Cover & save"];

export function LessonWizard({ open, onOpenChange, course, courses, lang, defaultOrderIndex, lesson, onSaved, inline = false }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  // Pass a specific course to lock the lesson to it (e.g. opened from
  // inside that course's own lesson list). Pass `null`/`undefined` together
  // with `courses` to let the admin choose the course as step 1 instead.
  course?: { id: string; level_id: string; title_sorani?: string } | null;
  courses?: WizardCourseOption[];
  lang: string;
  defaultOrderIndex: number;
  lesson?: WizardLesson | null;
  onSaved: (courseId: string) => void;
  inline?: boolean;
}) {

  const [stage, setStage] = useState(0);
  const [courseId, setCourseId] = useState("");
  const [jsonText, setJsonText] = useState("");
  const [jsonDialogOpen, setJsonDialogOpen] = useState(false);
  const [steps, setSteps] = useState<LessonStep[]>([]);
  const [exercises, setExercises] = useState<WizardExercise[]>([]);
  const [removedExerciseIds, setRemovedExerciseIds] = useState<string[]>([]);
  const [titleEn, setTitleEn] = useState("");
  const [titleSorani, setTitleSorani] = useState("");
  const [titleBadini, setTitleBadini] = useState("");
  const [coverPath, setCoverPath] = useState<string>("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Locked in from the caller (opened from inside a specific course's
  // lesson list) vs. left for the admin to pick in step 1.
  const locked = !!course;

  const upsertLesson = useServerFn(adminUpsertLesson);
  const upsertExercise = useServerFn(adminUpsertExercise);
  const deleteExercise = useServerFn(adminDeleteExercise);
  const translate = useServerFn(translateLessonWords);
  const searchPhotos = useServerFn(searchWordPhotos);
  const importPhoto = useServerFn(importPhotoToLibrary);
  const genImage = useServerFn(generateWordImage);
  const genAudio = useServerFn(generateWordAudio);

  // Load / reset whenever the wizard opens.
  useEffect(() => {
    if (!open) return;
    setStage(0);
    setParseError(null);
    setJsonDialogOpen(false);
    setRemovedExerciseIds([]);
    setCourseId(course?.id ?? "");
    if (lesson) {
      setJsonText(typeof lesson.source_json === "string" ? lesson.source_json : JSON.stringify(lesson.steps_json ?? [], null, 2));
      setSteps(Array.isArray(lesson.steps_json) ? (lesson.steps_json as LessonStep[]) : []);
      setTitleEn(lesson.title_en ?? "");
      setTitleSorani(lesson.title_sorani ?? "");
      setTitleBadini(lesson.title_badini ?? "");
      setCoverPath(lesson.cover_image_path ?? "");
      setExercises(
        (lesson.lesson_exercises ?? [])
          .slice()
          .sort((a, b) => a.order_index - b.order_index)
          .map((e) => {
            const p = (e.prompt_json ?? {}) as { prompt?: string; choices?: string[]; hint_sorani?: string; hint_badini?: string };
            const a = (e.answer_json ?? {}) as { correct?: string };
            return {
              id: e.id,
              type: (e.type as WizardExercise["type"]) ?? "multiple_choice",
              prompt: p.prompt ?? "",
              choices: p.choices ?? [],
              correct: a.correct ?? "",
              hint_sorani: p.hint_sorani ?? "",
              hint_badini: p.hint_badini ?? "",
            };
          }),
      );
    } else {
      setJsonText("");
      setSteps([]);
      setExercises([]);
      setTitleEn("");
      setTitleSorani("");
      setTitleBadini("");
      setCoverPath("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, lesson?.id]);

  const coverUrl = coverPath ? supabase.storage.from("lesson-assets").getPublicUrl(coverPath).data.publicUrl : "";

  /* -------- optional JSON import, used from inside the Build stage -------- */
  // Purely additive: parsed steps are appended to whatever's already on the
  // canvas, never overwrite it. Building by hand and importing JSON can be
  // mixed freely, in any order.
  const importFromJson = async () => {
    let parsed: ReturnType<typeof parseLessonJson>;
    try {
      parsed = parseLessonJson(jsonText);
      setParseError(null);
    } catch (e) {
      setParseError((e as Error).message);
      return;
    }
    const merged = [...steps, ...parsed.steps];
    setSteps(merged);
    if (parsed.title && !titleEn.trim()) setTitleEn(parsed.title);
    setJsonDialogOpen(false);
    setJsonText("");
    toast.success(`${parsed.steps.length} step${parsed.steps.length === 1 ? "" : "s"} added from JSON`);
    const withPhotos = await fetchMissingPhotos(merged);
    setSteps(withPhotos);
  };

  const missingImages = useMemo(
    () => steps.filter((s) => s.type === "word" && !s.image_url && s.target.trim()).length,
    [steps],
  );

  const fetchMissingPhotos = async (list: LessonStep[]) => {
    const targets = list
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => s.type === "word" && !("image_url" in s && s.image_url) && (s as { target: string }).target.trim());
    if (targets.length === 0) return list;
    setBusy(`Finding pictures (0/${targets.length})`);
    const next = [...list];
    let done = 0;
    for (const { s, i } of targets) {
      const word = (s as { target: string }).target;
      try {
        const res = await searchPhotos({ data: { query: word, limit: 1 } });
        const hit = res.hits?.[0];
        if (hit) {
          const saved = await importPhoto({ data: { url: hit.url, word, course_id: courseId } });
          next[i] = { ...(next[i] as Extract<LessonStep, { type: "word" }>), image_url: saved.url };
        }
      } catch {
        /* keep going — a missing picture shouldn't stop the batch */
      }
      done += 1;
      setBusy(`Finding pictures (${done}/${targets.length})`);
      setSteps([...next]);
    }
    setBusy(null);
    return next;
  };

  /* ---------------- step 3: save ---------------- */
  // Prefer the locked-in course's level, otherwise look it up from the
  // picker options the admin chose from.
  const levelId = locked ? course!.level_id : courses?.find((c) => c.id === courseId)?.level_id;
  const orderIndex = lesson?.order_index
    ?? (locked ? undefined : courses?.find((c) => c.id === courseId)?.lessons?.length)
    ?? defaultOrderIndex;

  const save = async () => {
    if (!courseId) { toast.error("Choose a course for this lesson first."); return; }
    if (!titleEn.trim() && !titleSorani.trim()) { toast.error("Give the lesson a title first."); return; }
    if (!levelId) { toast.error("Couldn't find the level for that course — try reopening the wizard."); return; }
    setSaving(true);
    try {
      let so = titleSorani;
      let ba = titleBadini;
      if (!so.trim() || !ba.trim()) {
        try {
          const r = await translate({ data: { source_language: lang as never, items: [{ text: titleEn || "Lesson" }] } });
          const first = r.translations?.[0];
          if (first) { so = so || first.sorani; ba = ba || first.badini; }
        } catch { /* fall back to the English title */ }
      }
      so = so || titleEn || "Lesson";
      ba = ba || so;

      const saved = await upsertLesson({
        data: {
          ...(lesson?.id ? { id: lesson.id } : {}),
          level_id: levelId,
          course_id: courseId,
          order_index: orderIndex,
          title_en: titleEn || undefined,
          title_sorani: so,
          title_badini: ba,
          dialogue_json: [],
          steps_json: steps as never,
          cover_image_path: coverPath || null,
          source_json: jsonText || null,
        } as never,
      });
      const lessonId = (saved.lesson as { id: string }).id;

      for (const id of removedExerciseIds) {
        try { await deleteExercise({ data: { id } }); } catch { /* already gone */ }
      }
      for (let i = 0; i < exercises.length; i++) {
        const ex = exercises[i];
        await upsertExercise({
          data: {
            ...(ex.id ? { id: ex.id } : {}),
            lesson_id: lessonId,
            order_index: i,
            type: ex.type,
            prompt_json: {
              prompt: ex.prompt,
              ...(ex.choices.filter(Boolean).length ? { choices: ex.choices.filter(Boolean) } : {}),
              hint_sorani: ex.hint_sorani ?? "",
              hint_badini: ex.hint_badini ?? "",
            },
            answer_json: { correct: ex.correct },
          } as never,
        });
      }
      toast.success(lesson?.id ? "Lesson updated" : "Lesson created");
      onSaved(courseId);
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const uploadCover = async (file: File) => {
    setBusy("Uploading cover");
    try {
      const path = `covers/${courseId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
      const { error } = await supabase.storage.from("lesson-assets").upload(path, file, { upsert: false });
      if (error) throw new Error(error.message);
      setCoverPath(path);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const body = (
    <>
        <div className={cn("px-6 pt-5 pb-3 border-b", inline && "px-0 pt-0")}>
          <div className="flex items-center gap-3 text-lg font-semibold">


            {lesson?.id ? "Edit lesson" : "Create a new lesson"}
            <span className="flex items-center gap-1.5">
              {STEP_LABELS.map((label, i) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setStage(i)}
                  className={cn(
                    "text-xs rounded-full px-3 py-1 border transition-colors",
                    i === stage ? "bg-primary text-primary-foreground border-transparent" : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  {i + 1}. {label}
                </button>
              ))}
            </span>
          </div>
        </div>


        <div className="flex-1 min-h-0 overflow-hidden">
          {stage === 0 && (
            <div className="h-full overflow-y-auto p-6 max-w-2xl mx-auto space-y-5">
              {locked ? (
                <p className="text-sm text-muted-foreground">
                  Adding this lesson to <span className="font-medium text-foreground">{course?.title_sorani ?? "this course"}</span>.
                </p>
              ) : (
                <div>
                  <Label>Course</Label>
                  <Select value={courseId} onValueChange={setCourseId}>
                    <SelectTrigger><SelectValue placeholder="Choose a course…" /></SelectTrigger>
                    <SelectContent>
                      {(courses ?? []).map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.title_sorani}{c.title_en ? ` (${c.title_en})` : ""}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {(courses ?? []).length === 0 && (
                    <p className="text-xs text-muted-foreground mt-1.5">No courses yet for this language and level — add one first, then come back to add lessons to it.</p>
                  )}
                </div>
              )}
              <div className="grid gap-3">
                <div><Label>Lesson name (English)</Label><Input dir="ltr" value={titleEn} onChange={(e) => setTitleEn(e.target.value)} placeholder="e.g. Greetings and Introductions" /></div>
                <div><Label>Name (Sorani)</Label><Input dir="rtl" value={titleSorani} onChange={(e) => setTitleSorani(e.target.value)} placeholder="Left empty → translated automatically" /></div>
                <div><Label>Name (Badini)</Label><Input dir="rtl" value={titleBadini} onChange={(e) => setTitleBadini(e.target.value)} placeholder="Left empty → translated automatically" /></div>
              </div>
              <p className="text-sm text-muted-foreground">
                Next you'll build the lesson itself — add words, sentences, pictures and tips on the canvas (or import a batch from JSON in one go), then finish with a cover image.
              </p>
            </div>
          )}

          {stage === 1 && (
            <div className="h-full flex flex-col min-h-0">
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 border-b bg-muted/30 shrink-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => setJsonDialogOpen(true)}>
                    <Upload className="h-3.5 w-3.5 mr-1.5" /> Import from JSON
                  </Button>
                  {steps.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {steps.length} step{steps.length === 1 ? "" : "s"} · {missingImages} without a picture
                    </span>
                  )}
                </div>
                <Button size="sm" variant="outline" disabled={!!busy || missingImages === 0} onClick={() => fetchMissingPhotos(steps)}>
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <ImageIcon className="h-3.5 w-3.5 mr-1.5" />}
                  {busy ?? "Fetch missing pictures"}
                </Button>
              </div>
              <div className="flex-1 min-h-0">
                <WorkflowCanvas
                  steps={steps}
                  setSteps={setSteps}
                  exercises={exercises}
                  setExercises={setExercises}
                  onRemoveExercise={(id) => id && setRemovedExerciseIds((r) => [...r, id])}
                  courseId={courseId}
                  lang={lang}
                  busy={busy}
                  setBusy={setBusy}
                  searchPhotos={searchPhotos}
                  importPhoto={importPhoto}
                  genImage={genImage}
                  genAudio={genAudio}
                  translate={translate}
                />
              </div>
            </div>
          )}

          {stage === 2 && (
            <div className="h-full overflow-y-auto p-6 max-w-2xl mx-auto space-y-5">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{titleEn || titleSorani || "Untitled lesson"}</span> · {steps.length} step{steps.length === 1 ? "" : "s"} · {exercises.length} exercise{exercises.length === 1 ? "" : "s"}
              </p>
              <div>
                <Label>Lesson cover image</Label>
                <div className="mt-2 flex items-center gap-4">
                  <div className="h-28 w-44 rounded-xl overflow-hidden bg-muted grid place-items-center shrink-0">
                    {coverUrl ? <img src={coverUrl} alt="" className="h-full w-full object-cover" /> : <ImageIcon className="h-6 w-6 text-muted-foreground" />}
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="inline-flex">
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadCover(f); e.currentTarget.value = ""; }} />
                      <span className={cn("inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer hover:bg-muted", busy && "opacity-60 pointer-events-none")}>
                        {busy === "Uploading cover" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Upload image
                      </span>
                    </label>
                    {coverPath && <Button variant="ghost" size="sm" onClick={() => setCoverPath("")}><X className="h-4 w-4 mr-1" /> Remove</Button>}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <Dialog open={jsonDialogOpen} onOpenChange={setJsonDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Import from JSON</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">
              Optional shortcut — paste the JSON for this lesson and its words, sentences, pictures and tips are added to the canvas automatically (pictures are fetched too). You can keep adding or editing steps by hand afterwards.
            </p>
            <Textarea
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              rows={12}
              className="font-mono text-xs"
              placeholder={JSON_STEPS_EXAMPLE}
              dir="ltr"
            />
            {parseError && <p className="text-sm text-destructive">{parseError}</p>}
            <DialogFooter>
              <Button variant="outline" onClick={() => setJsonDialogOpen(false)}>Cancel</Button>
              <Button onClick={importFromJson} disabled={!jsonText.trim() || !!busy}>
                {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Add to lesson
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="border-t px-6 py-3 flex items-center justify-between">
          <Button variant="outline" onClick={() => (stage === 0 ? onOpenChange(false) : setStage(stage - 1))} disabled={saving}>
            {stage === 0 ? "Cancel" : <><ArrowLeft className="h-4 w-4 mr-1" /> Back</>}
          </Button>
          {stage < 2 ? (
            <Button
              disabled={!!busy}
              onClick={() => {
                if (stage === 0) {
                  if (!locked && !courseId) { toast.error("Choose a course for this lesson first."); return; }
                  if (!titleEn.trim() && !titleSorani.trim()) { toast.error("Give the lesson a name first."); return; }
                }
                setStage(stage + 1);
              }}
            >
              {busy ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{busy}</> : <>Next <ArrowRight className="h-4 w-4 ml-1" /></>}
            </Button>
          ) : (
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {lesson?.id ? "Save changes" : "Save lesson"}
            </Button>
          )}
        </div>
    </>
  );

  if (inline) {
    return <div className="flex flex-col h-[calc(100vh-14rem)] min-h-[600px] rounded-xl border bg-card overflow-hidden">{body}</div>;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(1200px,95vw)] h-[92vh] p-0 flex flex-col overflow-hidden">
        {body}
      </DialogContent>
    </Dialog>
  );

}

/* =================== n8n-style workflow canvas =================== */

const NODE_W = 210;
const NODE_H = 108;
const GAP_X = 70;

function nodeMeta(kind: "word" | "sentence" | "image" | "tip" | "exercise") {
  switch (kind) {
    case "word": return { label: "Word", Icon: Type, color: "bg-primary/10 text-primary-ink" };
    case "sentence": return { label: "Sentence", Icon: MessageSquare, color: "bg-accent/20 text-foreground" };
    case "image": return { label: "Image", Icon: ImageIcon, color: "bg-muted text-foreground" };
    case "tip": return { label: "Tip", Icon: Lightbulb, color: "bg-secondary text-secondary-foreground" };
    default: return { label: "Exercise", Icon: HelpCircle, color: "bg-destructive/10 text-destructive" };
  }
}

function WorkflowCanvas(props: {
  steps: LessonStep[];
  setSteps: (s: LessonStep[]) => void;
  exercises: WizardExercise[];
  setExercises: (e: WizardExercise[]) => void;
  onRemoveExercise: (id?: string) => void;
  courseId: string;
  lang: string;
  busy: string | null;
  setBusy: (v: string | null) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  searchPhotos: any; genImage: any; genAudio: any; importPhoto: any; translate: any;
}) {
  const { steps, setSteps, exercises, setExercises, onRemoveExercise } = props;
  const [selected, setSelected] = useState<Node | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 30, y: 30 });
  const dragRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  const nodes: Node[] = [
    ...steps.map((_, i) => ({ kind: "step" as const, index: i })),
    ...exercises.map((_, i) => ({ kind: "exercise" as const, index: i })),
  ];
  const perRow = 5;
  const pos = (i: number) => ({ x: (i % perRow) * (NODE_W + GAP_X), y: Math.floor(i / perRow) * (NODE_H + 70) });

  const updateStep = (i: number, patch: Partial<Record<string, unknown>>) => {
    const next = [...steps];
    next[i] = { ...(next[i] as object), ...patch } as LessonStep;
    setSteps(next);
  };
  const moveStep = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= steps.length) return;
    const next = [...steps];
    [next[i], next[j]] = [next[j], next[i]];
    setSteps(next);
    setSelected({ kind: "step", index: j });
  };

  return (
    <div className="h-full flex min-h-0">
      <div className="flex-1 min-w-0 relative bg-[radial-gradient(circle,hsl(var(--muted-foreground)/0.25)_1px,transparent_1px)] [background-size:22px_22px] overflow-hidden">
        <div className="absolute z-10 top-3 left-3 flex flex-wrap gap-2">
          {(["word", "sentence", "image", "tip"] as const).map((k) => (
            <Button key={k} size="sm" variant="secondary" onClick={() => { setSteps([...steps, blankStep(k)]); setSelected({ kind: "step", index: steps.length }); }}>
              <Plus className="h-3.5 w-3.5 mr-1" /> {nodeMeta(k).label}
            </Button>
          ))}
          <Button size="sm" variant="secondary" onClick={() => { setExercises([...exercises, { type: "multiple_choice", prompt: "", choices: ["", ""], correct: "" }]); setSelected({ kind: "exercise", index: exercises.length }); }}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Exercise
          </Button>
        </div>
        <div className="absolute z-10 top-3 right-3 flex gap-1">
          <Button size="icon" variant="secondary" onClick={() => setZoom((z) => Math.max(0.4, z - 0.1))}><ZoomOut className="h-4 w-4" /></Button>
          <Button size="icon" variant="secondary" onClick={() => setZoom((z) => Math.min(1.4, z + 0.1))}><ZoomIn className="h-4 w-4" /></Button>
        </div>

        <div
          className="absolute inset-0 cursor-grab active:cursor-grabbing"
          onMouseDown={(e) => { dragRef.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y }; }}
          onMouseMove={(e) => {
            const d = dragRef.current;
            if (!d) return;
            setPan({ x: d.px + (e.clientX - d.x), y: d.py + (e.clientY - d.y) });
          }}
          onMouseUp={() => { dragRef.current = null; }}
          onMouseLeave={() => { dragRef.current = null; }}
        >
          <div className="absolute origin-top-left" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
            <svg className="absolute overflow-visible pointer-events-none" width="1" height="1">
              {nodes.slice(0, -1).map((_, i) => {
                const a = pos(i); const b = pos(i + 1);
                const sameRow = Math.floor(i / perRow) === Math.floor((i + 1) / perRow);
                const x1 = a.x + NODE_W, y1 = a.y + NODE_H / 2;
                const x2 = sameRow ? b.x : b.x + NODE_W / 2, y2 = sameRow ? b.y + NODE_H / 2 : b.y;
                const d = sameRow
                  ? `M${x1},${y1} C${x1 + 35},${y1} ${x2 - 35},${y2} ${x2},${y2}`
                  : `M${x1},${y1} C${x1 + 45},${y1} ${x2},${y2 - 45} ${x2},${y2}`;
                return <path key={i} d={d} fill="none" stroke="hsl(var(--muted-foreground)/0.45)" strokeWidth={2} />;
              })}
            </svg>
            {nodes.map((n, i) => {
              const p = pos(i);
              const isStep = n.kind === "step";
              const step = isStep ? steps[n.index] : null;
              const ex = !isStep ? exercises[n.index] : null;
              const meta = nodeMeta(isStep ? (step!.type as never) : "exercise");
              const isSel = selected?.kind === n.kind && selected.index === n.index;
              const title = isStep
                ? step!.type === "tip" ? step!.text : step!.type === "image" ? (step!.caption || "Image") : (step as { target: string }).target
                : ex!.prompt || "New exercise";
              const img = isStep && step!.type === "image" ? step!.url : isStep ? (step as { image_url?: string }).image_url : undefined;
              return (
                <button
                  key={`${n.kind}-${n.index}`}
                  type="button"
                  onClick={() => setSelected(n)}
                  onMouseDown={(e) => e.stopPropagation()}
                  style={{ left: p.x, top: p.y, width: NODE_W, height: NODE_H }}
                  className={cn(
                    "absolute text-left rounded-xl border bg-card shadow-sm p-3 transition-all hover:shadow-md",
                    isSel ? "border-primary ring-2 ring-primary/30" : "border-border",
                  )}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={cn("h-6 w-6 rounded-md grid place-items-center", meta.color)}><meta.Icon className="h-3.5 w-3.5" /></span>
                    <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{i + 1} · {meta.label}</span>
                  </div>
                  <div className="flex gap-2">
                    {img && <img src={img} alt="" className="h-10 w-10 rounded object-cover shrink-0" />}
                    <p className="text-sm line-clamp-2 min-w-0" dir="ltr">{title || <span className="text-muted-foreground">empty</span>}</p>
                  </div>
                  {isStep && (step as { audio_url?: string })?.audio_url && (
                    <Volume2 className="h-3.5 w-3.5 text-primary absolute bottom-2 right-2" />
                  )}
                </button>
              );
            })}
            {nodes.length === 0 && <p className="text-muted-foreground text-sm">Nothing yet — add a node from the toolbar.</p>}
          </div>
        </div>
      </div>

      <aside className="w-[340px] shrink-0 border-l overflow-y-auto p-4">
        {!selected && <p className="text-sm text-muted-foreground">Click a node on the canvas to edit it.</p>}
        {selected?.kind === "step" && steps[selected.index] && (
          <StepInspector
            step={steps[selected.index]}
            index={selected.index}
            total={steps.length}
            courseId={props.courseId}
            lang={props.lang}
            busy={props.busy}
            setBusy={props.setBusy}
            searchPhotos={props.searchPhotos}
            importPhoto={props.importPhoto}
            genImage={props.genImage}
            genAudio={props.genAudio}
            translate={props.translate}
            onChange={(patch) => updateStep(selected.index, patch)}
            onMove={(d) => moveStep(selected.index, d)}
            onDelete={() => { setSteps(steps.filter((_, i) => i !== selected.index)); setSelected(null); }}
          />
        )}
        {selected?.kind === "exercise" && exercises[selected.index] && (
          <ExerciseInspector
            value={exercises[selected.index]}
            onChange={(v) => { const next = [...exercises]; next[selected.index] = v; setExercises(next); }}
            onDelete={() => { onRemoveExercise(exercises[selected.index].id); setExercises(exercises.filter((_, i) => i !== selected.index)); setSelected(null); }}
          />
        )}
      </aside>
    </div>
  );
}

function StepInspector(props: {
  step: LessonStep;
  index: number;
  total: number;
  courseId: string;
  lang: string;
  busy: string | null;
  setBusy: (v: string | null) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  searchPhotos: any; importPhoto: any; genImage: any; genAudio: any; translate: any;
  onChange: (patch: Record<string, unknown>) => void;
  onMove: (dir: -1 | 1) => void;
  onDelete: () => void;
}) {
  const { step, onChange } = props;
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [hits, setHits] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [local, setLocal] = useState<string | null>(null);

  const isText = step.type === "word" || step.type === "sentence";
  const target = isText ? step.target : "";

  const runSearch = async (q: string) => {
    setSearching(true);
    try {
      const res = await props.searchPhotos({ data: { query: q, limit: 12 } });
      setHits(res.hits ?? []);
    } catch (e) { toast.error((e as Error).message); }
    finally { setSearching(false); }
  };

  const useHit = async (url: string) => {
    setLocal("photo");
    try {
      const saved = await props.importPhoto({ data: { url, word: target || "image", course_id: props.courseId } });
      onChange(step.type === "image" ? { url: saved.url } : { image_url: saved.url });
      setPickerOpen(false);
    } catch (e) { toast.error((e as Error).message); }
    finally { setLocal(null); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{nodeMeta(step.type).label} · step {props.index + 1}</p>
        <div className="flex gap-1">
          <Button size="icon" variant="ghost" onClick={() => props.onMove(-1)} disabled={props.index === 0}><ArrowLeft className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" onClick={() => props.onMove(1)} disabled={props.index === props.total - 1}><ArrowRight className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" onClick={props.onDelete}><Trash2 className="h-4 w-4 text-destructive" /></Button>
        </div>
      </div>

      {step.type === "tip" && (
        <div><Label>Tip</Label><Textarea rows={4} value={step.text} onChange={(e) => onChange({ text: e.target.value })} /></div>
      )}

      {step.type === "image" && (
        <>
          <div><Label>Image URL</Label><Input dir="ltr" value={step.url} onChange={(e) => onChange({ url: e.target.value })} /></div>
          <div><Label>Caption</Label><Input value={step.caption ?? ""} onChange={(e) => onChange({ caption: e.target.value })} /></div>
          {step.url && <img src={step.url} alt="" className="rounded-lg w-full object-cover max-h-40" />}
        </>
      )}

      {isText && (
        <>
          <div><Label>{step.type === "word" ? "Word" : "Sentence"} (English)</Label><Input dir="ltr" value={step.target} onChange={(e) => onChange({ target: e.target.value })} /></div>
          <div><Label>Sorani</Label><Input dir="rtl" value={step.kurdish_sorani ?? ""} onChange={(e) => onChange({ kurdish_sorani: e.target.value })} /></div>
          <div><Label>Badini</Label><Input dir="rtl" value={step.kurdish_badini ?? ""} onChange={(e) => onChange({ kurdish_badini: e.target.value })} /></div>
          <Button
            size="sm"
            variant="outline"
            className="w-full"
            disabled={local === "tr" || !step.target.trim()}
            onClick={async () => {
              setLocal("tr");
              try {
                const r = await props.translate({ data: { source_language: props.lang as never, items: [{ text: step.target }] } });
                const f = r.translations?.[0];
                if (f) onChange({ kurdish_sorani: f.sorani, kurdish_badini: f.badini });
              } catch (e) { toast.error((e as Error).message); }
              finally { setLocal(null); }
            }}
          >
            {local === "tr" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Wand2 className="h-4 w-4 mr-2" />} Translate to Kurdish
          </Button>

          <div className="space-y-2">
            <Label>Picture</Label>
            {step.image_url && <img src={step.image_url} alt="" className="rounded-lg w-full object-cover max-h-40" />}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => { setQuery(step.target); setPickerOpen(true); setHits([]); if (step.target.trim()) runSearch(step.target); }}>
                <Search className="h-4 w-4 mr-1" /> Find photo
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={local === "ai" || !step.target.trim()}
                onClick={async () => {
                  setLocal("ai");
                  try {
                    const r = await props.genImage({ data: { word: step.target, course_id: props.courseId } });
                    onChange({ image_url: r.url });
                  } catch (e) { toast.error((e as Error).message); }
                  finally { setLocal(null); }
                }}
              >
                {local === "ai" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />} AI image
              </Button>
              {step.image_url && <Button size="sm" variant="ghost" onClick={() => onChange({ image_url: "" })}><X className="h-4 w-4 mr-1" /> Remove</Button>}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Pronunciation audio</Label>
            {step.audio_url && <audio controls src={step.audio_url} className="w-full h-9" />}
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={local === "au" || !step.target.trim()}
                onClick={async () => {
                  setLocal("au");
                  try {
                    const r = await props.genAudio({ data: { text: step.target, course_id: props.courseId } });
                    onChange({ audio_url: r.url });
                  } catch (e) { toast.error((e as Error).message); }
                  finally { setLocal(null); }
                }}
              >
                {local === "au" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Volume2 className="h-4 w-4 mr-1" />} Generate audio
              </Button>
              {step.audio_url && <Button size="sm" variant="ghost" onClick={() => onChange({ audio_url: "" })}><X className="h-4 w-4 mr-1" /> Remove</Button>}
            </div>
          </div>
        </>
      )}

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Find a photo</DialogTitle></DialogHeader>
          <div className="flex gap-2">
            <Input dir="ltr" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && runSearch(query)} />
            <Button onClick={() => runSearch(query)} disabled={searching}>
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
          <div className="grid grid-cols-4 gap-3 max-h-[55vh] overflow-y-auto">
            {hits.map((h) => (
              <button key={h.url} type="button" className="group text-left" onClick={() => useHit(h.url)} disabled={local === "photo"}>
                <img src={h.thumb} alt="" className="aspect-square w-full object-cover rounded-lg group-hover:ring-2 ring-primary" />
                <p className="text-[10px] text-muted-foreground truncate mt-1">{h.credit}</p>
              </button>
            ))}
            {!searching && hits.length === 0 && <p className="text-sm text-muted-foreground col-span-4">No results yet.</p>}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ExerciseInspector({ value, onChange, onDelete }: {
  value: WizardExercise;
  onChange: (v: WizardExercise) => void;
  onDelete: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Exercise</p>
        <Button size="icon" variant="ghost" onClick={onDelete}><Trash2 className="h-4 w-4 text-destructive" /></Button>
      </div>
      <div>
        <Label>Type</Label>
        <Select value={value.type} onValueChange={(v) => onChange({ ...value, type: v as WizardExercise["type"] })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {(["multiple_choice", "fill_blank", "translate", "listening"] as const).map((t) => <SelectItem key={t} value={t}>{t.replace("_", " ")}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div><Label>Question</Label><Textarea rows={3} dir="ltr" value={value.prompt} onChange={(e) => onChange({ ...value, prompt: e.target.value })} /></div>
      {value.type === "multiple_choice" && (
        <div className="space-y-2">
          <Label>Choices</Label>
          {value.choices.map((c, i) => (
            <div key={i} className="flex gap-2">
              <Input dir="ltr" value={c} onChange={(e) => { const next = [...value.choices]; next[i] = e.target.value; onChange({ ...value, choices: next }); }} />
              <Button size="icon" variant="ghost" onClick={() => onChange({ ...value, choices: value.choices.filter((_, j) => j !== i) })}><X className="h-4 w-4" /></Button>
            </div>
          ))}
          <Button size="sm" variant="outline" onClick={() => onChange({ ...value, choices: [...value.choices, ""] })}><Plus className="h-4 w-4 mr-1" /> Add choice</Button>
        </div>
      )}
      <div><Label>Correct answer</Label><Input dir="ltr" value={value.correct} onChange={(e) => onChange({ ...value, correct: e.target.value })} /></div>
      <div><Label>Hint (Sorani)</Label><Input dir="rtl" value={value.hint_sorani ?? ""} onChange={(e) => onChange({ ...value, hint_sorani: e.target.value })} /></div>
      <div><Label>Hint (Badini)</Label><Input dir="rtl" value={value.hint_badini ?? ""} onChange={(e) => onChange({ ...value, hint_badini: e.target.value })} /></div>
    </div>
  );
}
