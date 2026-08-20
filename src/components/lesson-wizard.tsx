// Three-step lesson builder used from Admin → Lessons.
//   1. Details — just name the lesson. Nothing about "courses" is asked
//      here: saving auto-creates a 1:1 course behind the scenes to hold it
//      (that's the thing the learner-facing card actually shows/opens), so
//      a lesson is a fully standalone thing to the admin.
//   2. Build the lesson on an n8n-style workflow canvas — every node is one
//      step the learner will see; click a node to edit it in the side panel.
//      A JSON blob can optionally be imported here to fast-forward, but it's
//      never required — words/sentences/pictures/tips can all be added by
//      hand from the toolbar.
//   3. Add a cover image and save — the lesson (and its standalone course
//      card) is playable immediately.
// Editing an existing lesson re-opens the very same steps, pre-filled with
// whatever was saved (plus the JSON it was originally imported from, if
// any), so nothing has to be rebuilt from scratch. Pass `course` (plus
// `syncCourseCard`) only when a lesson already lives inside a real,
// hand-grouped multi-lesson course and should stay there.
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Loader2, Plus, Trash2, ArrowLeft, ArrowRight, Image as ImageIcon, Volume2,
  Sparkles, Search, Upload, X, Type, MessageSquare, Lightbulb, HelpCircle, ZoomIn, ZoomOut, Wand2,
  Shuffle, ExternalLink, RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { type LessonStep, type WordHighlight, type BuildableStepType, blankStep, parseLessonJson, tokenizeWords, BLOCK_IMPORT_EXAMPLE } from "@/lib/lesson-steps";
import {
  adminUpsertLesson, adminUpsertExercise, adminDeleteExercise, adminUpsertCourse,
  translateLessonWords, searchWordPhotos, importPhotoToLibrary, generateWordImage, generateWordAudio, generateWordMeaning,
} from "@/lib/admin.functions";
import { BannerEditorDialog } from "@/components/banner-editor";

export type WizardExercise = {
  id?: string;
  type: "multiple_choice" | "fill_blank" | "translate" | "listening" | "reorder";
  prompt: string;
  choices: string[];
  correct: string;
  hint_sorani?: string;
  hint_badini?: string;
};

const EXERCISE_TYPE_OPTIONS = ["multiple_choice", "fill_blank", "translate", "listening", "reorder"] as const;

const DEFAULT_REORDER_PROMPT = "Put the words in the correct order to rebuild the sentence.";

// Default instruction text is only auto-filled for brand-new reorder
// exercises — an admin who's already typed their own prompt keeps it.
function blankExercise(type: WizardExercise["type"] = "multiple_choice"): WizardExercise {
  return {
    id: crypto.randomUUID(),
    type,
    prompt: type === "reorder" ? DEFAULT_REORDER_PROMPT : "",
    choices: type === "multiple_choice" ? ["", ""] : [],
    correct: "",
  };
}

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

// A course a lesson can be locked into — only relevant for lessons that
// live inside a real, hand-grouped multi-lesson course (see `course` below).
export type WizardCourse = { id: string; level_id: string; order_index: number; title_sorani?: string };

type Node = { kind: "step"; index: number } | { kind: "exercise"; index: number };

const STEP_LABELS = ["Details", "Build lesson", "Cover & save"];

export function LessonWizard({ open, onOpenChange, course, syncCourseCard = false, levelId, lang, defaultOrderIndex, newCourseOrderIndex = 0, lesson, onSaved, inline = false }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  // Lock the lesson into an existing course (e.g. a legacy multi-lesson
  // course opened from inside its own lesson list). Leave this out for a
  // brand-new standalone lesson — a matching 1:1 course is auto-created on
  // save, so there's nothing to pick.
  course?: WizardCourse | null;
  // Only meaningful together with `course`: also keep that course's title
  // and cover synced to this lesson on save. Only pass this when `course`
  // truly wraps just this one lesson — never for a real multi-lesson course,
  // or every sibling lesson's card would get relabeled.
  syncCourseCard?: boolean;
  // The level (CEFR) a brand-new standalone course should be created under.
  // Ignored when `course` is set.
  levelId: string;
  lang: string;
  defaultOrderIndex: number;
  // Where a brand-new standalone lesson's auto-created course should sort
  // among its siblings on the learner's course grid (e.g. the current
  // lesson count, so it lands after everything already there). Ignored
  // when `course` is set — an existing course keeps its own order_index.
  newCourseOrderIndex?: number;
  lesson?: WizardLesson | null;
  onSaved: (course: { id: string; level_id: string; order_index: number; title_sorani: string }) => void;
  inline?: boolean;
}) {

  const [stage, setStage] = useState(0);
  const [jsonText, setJsonText] = useState("");
  const [jsonDialogOpen, setJsonDialogOpen] = useState(false);
  const [steps, setSteps] = useState<LessonStep[]>([]);
  const [exercises, setExercises] = useState<WizardExercise[]>([]);
  const [removedExerciseIds, setRemovedExerciseIds] = useState<string[]>([]);
  const [titleEn, setTitleEn] = useState("");
  const [titleSorani, setTitleSorani] = useState("");
  const [titleBadini, setTitleBadini] = useState("");
  const [coverPath, setCoverPath] = useState<string>("");
  const [coverEditor, setCoverEditor] = useState<{ url: string; crossOrigin: boolean; revoke: boolean } | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const upsertLesson = useServerFn(adminUpsertLesson);
  const upsertCourse = useServerFn(adminUpsertCourse);
  const upsertExercise = useServerFn(adminUpsertExercise);
  const deleteExercise = useServerFn(adminDeleteExercise);
  const translate = useServerFn(translateLessonWords);
  const searchPhotos = useServerFn(searchWordPhotos);
  const importPhoto = useServerFn(importPhotoToLibrary);
  const genImage = useServerFn(generateWordImage);
  const genAudio = useServerFn(generateWordAudio);
  const genMeaning = useServerFn(generateWordMeaning);

  // Load / reset whenever the wizard opens.
  useEffect(() => {
    if (!open) return;
    setStage(0);
    setParseError(null);
    setJsonDialogOpen(false);
    setCoverEditor(null);
    setRemovedExerciseIds([]);
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

  const coverUrl = coverPath ? supabase.storage.from("course-covers").getPublicUrl(coverPath).data.publicUrl : "";

  /* -------- optional JSON import, used from inside the Build stage -------- */
  // Purely additive: parsed steps/exercises are appended to whatever's
  // already on the canvas, never overwrite it. Building by hand and
  // importing JSON can be mixed freely, in any order.
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
    if (parsed.exercises.length > 0) setExercises((prev) => [...prev, ...parsed.exercises.map((e) => ({ ...e, id: crypto.randomUUID() }))]);
    if (parsed.title && !titleEn.trim()) setTitleEn(parsed.title);
    setJsonDialogOpen(false);
    setJsonText("");
    const parts = [`${parsed.steps.length} step${parsed.steps.length === 1 ? "" : "s"}`];
    if (parsed.exercises.length > 0) parts.push(`${parsed.exercises.length} exercise${parsed.exercises.length === 1 ? "" : "s"}`);
    toast.success(`${parts.join(" and ")} added from JSON`);
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
          const saved = await importPhoto({ data: { url: hit.url, word, course_id: course?.id } });
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
  const save = async () => {
    if (!titleEn.trim() && !titleSorani.trim()) { toast.error("Give the lesson a name first."); return; }
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

      // A lesson always needs a course_id (that's also what the learner's
      // lesson card actually reads its title/cover from), but the admin
      // never picks one: locked-in courses are reused as-is, and a brand
      // new standalone lesson gets its own 1:1 course created right here.
      let targetCourseId: string;
      let targetLevelId: string;
      if (course) {
        targetCourseId = course.id;
        targetLevelId = course.level_id;
        if (syncCourseCard) {
          await upsertCourse({
            data: {
              id: course.id,
              level_id: course.level_id,
              order_index: course.order_index,
              title_sorani: so,
              title_badini: ba,
              title_en: titleEn || undefined,
              cover_image_path: coverPath || null,
            } as never,
          });
        }
      } else {
        const savedCourse = await upsertCourse({
          data: {
            level_id: levelId,
            order_index: newCourseOrderIndex,
            title_sorani: so,
            title_badini: ba,
            title_en: titleEn || undefined,
            cover_image_path: coverPath || null,
          } as never,
        });
        targetCourseId = (savedCourse.course as { id: string }).id;
        targetLevelId = levelId;
      }

      const saved = await upsertLesson({
        data: {
          ...(lesson?.id ? { id: lesson.id } : {}),
          level_id: targetLevelId,
          course_id: targetCourseId,
          order_index: lesson?.order_index ?? defaultOrderIndex,
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
      onSaved({ id: targetCourseId, level_id: targetLevelId, order_index: course?.order_index ?? 0, title_sorani: so });
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // Covers live in the "course-covers" bucket and go through the same crop
  // editor as a course cover, since that's exactly what this becomes — the
  // picture shown on the card the learner taps.
  const uploadCover = async (blob: Blob) => {
    setBusy("Uploading cover");
    try {
      const path = `${crypto.randomUUID()}.jpg`;
      const { error } = await supabase.storage.from("course-covers").upload(path, blob, { upsert: false, contentType: blob.type || "image/jpeg" });
      if (error) throw new Error(error.message);
      setCoverPath(path);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  const openCoverEditorForFile = (file: File) => setCoverEditor({ url: URL.createObjectURL(file), crossOrigin: false, revoke: true });
  const openCoverEditorForCurrent = () => { if (coverUrl) setCoverEditor({ url: coverUrl, crossOrigin: true, revoke: false }); };
  const closeCoverEditor = () => { if (coverEditor?.revoke) URL.revokeObjectURL(coverEditor.url); setCoverEditor(null); };

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
              {course && (
                <p className="text-sm text-muted-foreground">
                  Adding this lesson to <span className="font-medium text-foreground">{course.title_sorani ?? "this course"}</span>.
                </p>
              )}
              <div className="grid gap-3">
                <div><Label>Lesson name (English)</Label><Input dir="ltr" value={titleEn} onChange={(e) => setTitleEn(e.target.value)} placeholder="e.g. Greetings and Introductions" /></div>
                <div><Label>Name (Sorani)</Label><Input dir="rtl" value={titleSorani} onChange={(e) => setTitleSorani(e.target.value)} placeholder="Left empty → translated automatically" /></div>
                <div><Label>Name (Badini)</Label><Input dir="rtl" value={titleBadini} onChange={(e) => setTitleBadini(e.target.value)} placeholder="Left empty → translated automatically" /></div>
              </div>
              <p className="text-sm text-muted-foreground">
                Next you'll build the lesson itself — add words, sentences, pictures and tips on the canvas (or import a batch from JSON in one go), then finish with a cover image{course ? "" : " — no course to set up, this lesson stands on its own"}.
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
                  courseId={course?.id}
                  lang={lang}
                  busy={busy}
                  setBusy={setBusy}
                  searchPhotos={searchPhotos}
                  importPhoto={importPhoto}
                  genImage={genImage}
                  genAudio={genAudio}
                  translate={translate}
                  generateMeaning={genMeaning}
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
                <Label>Cover image</Label>
                <div className="mt-2 flex items-center gap-4">
                  <div className="h-28 w-44 rounded-xl overflow-hidden bg-muted grid place-items-center shrink-0">
                    {coverUrl ? <img src={coverUrl} alt="" className="h-full w-full object-cover" /> : <ImageIcon className="h-6 w-6 text-muted-foreground" />}
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="inline-flex">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={!!busy}
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) openCoverEditorForFile(f); e.currentTarget.value = ""; }}
                      />
                      <span className={cn("inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer hover:bg-muted", busy && "opacity-60 pointer-events-none")}>
                        {busy === "Uploading cover" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} {coverPath ? "Replace image" : "Upload image"}
                      </span>
                    </label>
                    {coverPath && (
                      <>
                        <Button type="button" variant="outline" size="sm" disabled={!!busy} onClick={openCoverEditorForCurrent}>Adjust crop</Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setCoverPath("")}><X className="h-4 w-4 mr-1" /> Remove</Button>
                      </>
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">This is the picture learners see on the lesson's card — you'll be able to pan &amp; zoom it before it uploads.</p>
              </div>
            </div>
          )}
        </div>

        {coverEditor && (
          <BannerEditorDialog
            imageUrl={coverEditor.url}
            crossOrigin={coverEditor.crossOrigin}
            onCancel={closeCoverEditor}
            onSave={(blob) => { closeCoverEditor(); uploadCover(blob); }}
          />
        )}

        <Dialog open={jsonDialogOpen} onOpenChange={setJsonDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Import from JSON</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">
              Optional shortcut — paste the JSON for this lesson and its words, sentences, pictures, tips and exercises are added to the canvas automatically (pictures are fetched too). Exercises are optional — leave that array out entirely if this lesson doesn't need any. You can keep adding or editing anything by hand afterwards.
            </p>
            <Textarea
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              rows={12}
              className="font-mono text-xs"
              placeholder={BLOCK_IMPORT_EXAMPLE}
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
                if (stage === 0 && !titleEn.trim() && !titleSorani.trim()) {
                  toast.error("Give the lesson a name first.");
                  return;
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
  courseId?: string;
  lang: string;
  busy: string | null;
  setBusy: (v: string | null) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  searchPhotos: any; genImage: any; genAudio: any; importPhoto: any; translate: any; generateMeaning: any;
}) {
  const { steps, setSteps, exercises, setExercises, onRemoveExercise } = props;
  const [selected, setSelected] = useState<Node | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 30, y: 30 });
  const dragRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  // Exercises referenced by an inline `{ type: "exercise" }` step already
  // have a spot in the walkthrough, so they're drawn as part of that step's
  // node (see stepNodeTitle below) instead of getting their own separate
  // node at the end — otherwise the same exercise would appear twice.
  const inlineExerciseIds = new Set(
    steps.filter((s): s is Extract<LessonStep, { type: "exercise" }> => s.type === "exercise").map((s) => s.exerciseId),
  );
  const standaloneExercises = exercises
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => !e.id || !inlineExerciseIds.has(e.id));

  const nodes: Node[] = [
    ...steps.map((_, i) => ({ kind: "step" as const, index: i })),
    ...standaloneExercises.map(({ i }) => ({ kind: "exercise" as const, index: i })),
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

  // Full delete: removes the exercise itself AND, if it's currently placed
  // inline somewhere in the flow, the step marker pointing at it — otherwise
  // that marker would dangle and the player would just skip over it, but
  // it'd stick around cluttering the canvas.
  const removeExerciseCompletely = (id?: string) => {
    onRemoveExercise(id);
    if (id) setSteps(steps.filter((s) => !(s.type === "exercise" && s.exerciseId === id)));
  };

  // Drops a *new* exercise into the flow at the end (from there the admin
  // drags it into position with the same move arrows every other step
  // uses), or pulls an inline one back out to standalone — see the toggle
  // button in ExerciseInspector below.
  const placeExerciseInline = (id: string) => setSteps([...steps, { type: "exercise", exerciseId: id }]);
  const removeExerciseFromFlow = (id: string) => setSteps(steps.filter((s) => !(s.type === "exercise" && s.exerciseId === id)));

  // Quick-insert: after every 3rd sentence step, adds a brand-new "reorder"
  // exercise built from that sentence's own words and drops its marker
  // right there in the flow — the exact "word, sentence, word, sentence,
  // word, sentence, [rebuild it], word, sentence…" pattern in one click,
  // rather than hand-placing each one.
  const autoInsertSentenceBuilders = () => {
    let sentenceCount = 0;
    let added = 0;
    const nextSteps: LessonStep[] = [];
    const nextExercises = [...exercises];
    for (const s of steps) {
      nextSteps.push(s);
      if (s.type === "sentence" && s.target.trim()) {
        sentenceCount++;
        if (sentenceCount % 3 === 0) {
          const id = crypto.randomUUID();
          nextExercises.push({
            id,
            type: "reorder",
            prompt: DEFAULT_REORDER_PROMPT,
            choices: [],
            correct: s.target.trim(),
            hint_sorani: s.kurdish_sorani || "",
            hint_badini: s.kurdish_badini || "",
          });
          nextSteps.push({ type: "exercise", exerciseId: id });
          added++;
        }
      }
    }
    if (added === 0) {
      toast.info("Need at least 3 sentence steps for this — add more sentences first.");
      return;
    }
    setSteps(nextSteps);
    setExercises(nextExercises);
    toast.success(`Added ${added} sentence-builder exercise${added === 1 ? "" : "s"} into the flow.`);
  };

  // Node label/icon for a step: word/sentence/image/tip read their own
  // field, but a step that's really just a pointer at an exercise shows
  // that exercise's own prompt instead (it has no `target` of its own).
  const stepNodeTitle = (step: LessonStep): { meta: ReturnType<typeof nodeMeta>; title: string; img?: string } => {
    if (step.type === "exercise") {
      const ex = exercises.find((e) => e.id === step.exerciseId);
      return { meta: nodeMeta("exercise"), title: ex?.prompt || (ex ? "Exercise" : "Exercise (missing)") };
    }
    const meta = nodeMeta(step.type);
    const title = step.type === "tip" ? step.text : step.type === "image" ? (step.caption || "Image") : step.target;
    const img = step.type === "image" ? step.url : (step as { image_url?: string }).image_url;
    return { meta, title, img };
  };

  return (
    <div className="h-full flex min-h-0">
      <div className="flex-1 min-w-0 relative bg-[radial-gradient(circle,hsl(var(--muted-foreground)/0.25)_1px,transparent_1px)] [background-size:22px_22px] overflow-hidden">
        <div className="absolute z-10 top-3 left-3 flex flex-wrap gap-2 max-w-[calc(100%-7rem)]">
          {(["word", "sentence", "image", "tip"] as const).map((k) => (
            <Button key={k} size="sm" variant="secondary" onClick={() => { setSteps([...steps, blankStep(k as BuildableStepType)]); setSelected({ kind: "step", index: steps.length }); }}>
              <Plus className="h-3.5 w-3.5 mr-1" /> {nodeMeta(k).label}
            </Button>
          ))}
          <Button size="sm" variant="secondary" onClick={() => { setExercises([...exercises, blankExercise()]); setSelected({ kind: "exercise", index: exercises.length }); }}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Exercise
          </Button>
          <Button size="sm" variant="outline" onClick={autoInsertSentenceBuilders} title="After every 3rd sentence step, adds a sentence-builder exercise right there in the flow.">
            <Shuffle className="h-3.5 w-3.5 mr-1" /> Sentence builder ×3
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
              const stepInfo = isStep ? stepNodeTitle(step!) : null;
              const meta = isStep ? stepInfo!.meta : nodeMeta("exercise");
              const isSel = selected?.kind === n.kind && selected.index === n.index;
              const title = isStep ? stepInfo!.title : ex!.prompt || "New exercise";
              const img = isStep ? stepInfo!.img : undefined;
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
            generateMeaning={props.generateMeaning}
            exercises={exercises}
            onOpenExercise={(exerciseId) => {
              const exIdx = exercises.findIndex((e) => e.id === exerciseId);
              if (exIdx >= 0) setSelected({ kind: "exercise", index: exIdx });
            }}
            onChange={(patch) => updateStep(selected.index, patch)}
            onMove={(d) => moveStep(selected.index, d)}
            onDelete={() => { setSteps(steps.filter((_, i) => i !== selected.index)); setSelected(null); }}
          />
        )}
        {selected?.kind === "exercise" && exercises[selected.index] && (
          <ExerciseInspector
            value={exercises[selected.index]}
            isInline={!!exercises[selected.index].id && inlineExerciseIds.has(exercises[selected.index].id!)}
            onToggleInline={() => {
              const id = exercises[selected.index].id;
              if (!id) return;
              if (inlineExerciseIds.has(id)) removeExerciseFromFlow(id);
              else placeExerciseInline(id);
            }}
            onChange={(v) => { const next = [...exercises]; next[selected.index] = v; setExercises(next); }}
            onDelete={() => { removeExerciseCompletely(exercises[selected.index].id); setExercises(exercises.filter((_, i) => i !== selected.index)); setSelected(null); }}
          />
        )}
      </aside>
    </div>
  );
}

const POS_OPTIONS = ["noun", "verb", "adjective", "adverb", "phrase", "other"] as const;

/**
 * Same click-a-word-to-add-its-meaning interaction already used for video
 * transcripts and book paragraphs, scoped to one lesson sentence step.
 * Saved highlights live on the step itself (`step.highlights`, inside
 * steps_json) — no extra table. Learners see these as tappable words with a
 * translation popover as they read the sentence mid-lesson.
 */
function SentenceHighlighter({ target, highlights, onChange, sourceLanguage, generateMeaning }: {
  target: string;
  highlights: WordHighlight[];
  onChange: (highlights: WordHighlight[]) => void;
  sourceLanguage: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  generateMeaning: any;
}) {
  const words = tokenizeWords(target);
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
      const res = await generateMeaning({ data: { source_language: sourceLanguage as never, word, context: target } });
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
        <Label className="text-xs">Highlighted words</Label>
        {highlights.length === 0 && <span className="text-[11px] text-muted-foreground">No highlighted words yet</span>}
      </div>
      <p className="text-[11px] text-muted-foreground">Click a word to add its Kurdish meaning. Shift-click another word to select a phrase.</p>
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
              Selected: <span className="font-medium text-foreground" dir="ltr">{form.word}</span>
            </div>
            <Button type="button" size="sm" variant="secondary" onClick={onGenerate} disabled={generating}>
              {generating ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1.5" />}
              {generating ? "Generating…" : "Generate"}
            </Button>
          </div>
          <div>
            <Label className="text-xs">Part of speech</Label>
            <Select value={form.part_of_speech} onValueChange={(v) => setForm({ ...form, part_of_speech: v })}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                {POS_OPTIONS.map((p) => (
                  <SelectItem key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Meaning (English)</Label>
            <Input className="h-8" dir="ltr" value={form.meaning_en} onChange={(e) => setForm({ ...form, meaning_en: e.target.value })} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Meaning (Kurdish) · Sorani</Label>
              <Input className="h-8" dir="rtl" value={form.meaning_ku_sorani} onChange={(e) => setForm({ ...form, meaning_ku_sorani: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Meaning (Kurdish) · Badini</Label>
              <Input className="h-8" dir="rtl" value={form.meaning_ku_badini} onChange={(e) => setForm({ ...form, meaning_ku_badini: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            {form.mode === "edit" && (
              <Button type="button" size="sm" variant="destructive" onClick={deleteForm}>Remove</Button>
            )}
            <Button type="button" size="sm" variant="outline" onClick={() => setForm(null)}>Cancel</Button>
            <Button type="button" size="sm" onClick={saveForm}>Save</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function StepInspector(props: {
  step: LessonStep;
  index: number;
  total: number;
  courseId?: string;
  lang: string;
  busy: string | null;
  setBusy: (v: string | null) => void;
  exercises: WizardExercise[];
  onOpenExercise: (exerciseId: string) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  searchPhotos: any; importPhoto: any; genImage: any; genAudio: any; translate: any; generateMeaning: any;
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

  if (step.type === "exercise") {
    const ex = props.exercises.find((e) => e.id === step.exerciseId);
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Exercise (inline) · step {props.index + 1}</p>
          <div className="flex gap-1">
            <Button size="icon" variant="ghost" onClick={() => props.onMove(-1)} disabled={props.index === 0}><ArrowLeft className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" onClick={() => props.onMove(1)} disabled={props.index === props.total - 1}><ArrowRight className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" onClick={props.onDelete} title="Remove from this position — the exercise itself stays, moved to the end"><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Learners hit this exercise right here in the walkthrough, between the steps around it, instead of waiting for the very end.
        </p>
        <div className="rounded-md border p-3 bg-muted/30">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">{ex ? ex.type.replace("_", " ") : "missing"}</p>
          <p className="text-sm" dir="ltr">{ex?.prompt || <span className="text-muted-foreground">No prompt yet</span>}</p>
        </div>
        <Button size="sm" variant="outline" className="w-full" disabled={!ex} onClick={() => props.onOpenExercise(step.exerciseId)}>
          <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Edit exercise content
        </Button>
        <p className="text-xs text-muted-foreground">Use the arrows above to move this exercise earlier or later in the flow.</p>
      </div>
    );
  }

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

          {step.type === "sentence" && (
            <SentenceHighlighter
              target={step.target}
              highlights={step.highlights ?? []}
              onChange={(highlights) => onChange({ highlights })}
              sourceLanguage={props.lang}
              generateMeaning={props.generateMeaning}
            />
          )}
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

function ExerciseInspector({ value, onChange, onDelete, isInline, onToggleInline }: {
  value: WizardExercise;
  onChange: (v: WizardExercise) => void;
  onDelete: () => void;
  isInline: boolean;
  onToggleInline: () => void;
}) {
  const preview = useMemo(() => {
    const tokens = tokenizeWords(value.correct);
    const shuffled = [...tokens];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.correct, value.type]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Exercise</p>
        <Button size="icon" variant="ghost" onClick={onDelete}><Trash2 className="h-4 w-4 text-destructive" /></Button>
      </div>

      <div className="rounded-md border p-2.5 flex items-center justify-between gap-2 bg-muted/30">
        <p className="text-xs text-muted-foreground">
          {isInline ? "Placed inline, right in the lesson flow." : "Runs at the end, after all the steps (default)."}
        </p>
        <Button size="sm" variant="outline" className="shrink-0" onClick={onToggleInline} disabled={!value.id}>
          {isInline ? <>Move to end</> : <>Insert into flow</>}
        </Button>
      </div>

      <div>
        <Label>Type</Label>
        <Select
          value={value.type}
          onValueChange={(v) => {
            const nextType = v as WizardExercise["type"];
            const promptWasDefault = !value.prompt.trim() || value.prompt === DEFAULT_REORDER_PROMPT;
            onChange({
              ...value,
              type: nextType,
              prompt: nextType === "reorder" && promptWasDefault ? DEFAULT_REORDER_PROMPT : value.prompt,
            });
          }}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {EXERCISE_TYPE_OPTIONS.map((t) => <SelectItem key={t} value={t}>{t.replace("_", " ")}</SelectItem>)}
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
      {value.type === "reorder" ? (
        <div className="space-y-2">
          <Label>Sentence to rebuild</Label>
          <Textarea rows={2} dir="ltr" value={value.correct} onChange={(e) => onChange({ ...value, correct: e.target.value })} placeholder="e.g. I would like a cup of coffee." />
          <p className="text-[11px] text-muted-foreground">Learners see this sentence's own words shuffled and tap them back into this exact order.</p>
          {preview.length > 1 && (
            <div dir="ltr" className="flex flex-wrap gap-1.5 rounded-md border border-dashed p-2 bg-muted/30">
              {preview.map((w, i) => (
                <span key={i} className="rounded-md border bg-background px-2 py-0.5 text-xs">{w}</span>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div><Label>Correct answer</Label><Input dir="ltr" value={value.correct} onChange={(e) => onChange({ ...value, correct: e.target.value })} /></div>
      )}
      <div><Label>Hint (Sorani)</Label><Input dir="rtl" value={value.hint_sorani ?? ""} onChange={(e) => onChange({ ...value, hint_sorani: e.target.value })} /></div>
      <div><Label>Hint (Badini)</Label><Input dir="rtl" value={value.hint_badini ?? ""} onChange={(e) => onChange({ ...value, hint_badini: e.target.value })} /></div>
    </div>
  );
}
