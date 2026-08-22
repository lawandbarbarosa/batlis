// One-off generator: turns src/data/grade12-curriculum.ts into the SQL seed
// block used by the grade12_units / grade12_exam_tips migration. Not part of
// the app build — run manually with:
//   node --experimental-strip-types scripts/gen-grade12-seed.ts
import { GRADE12_UNITS, GRADE12_EXAM_TIPS } from "../src/data/grade12-curriculum.ts";

// Dollar-quoting sidesteps manual escaping of apostrophes (which this content
// has a lot of — contractions, possessives) inside SQL string literals.
const q = (s: string) => `$q$${s}$q$`;
const jsonb = (v: unknown) => `$q$${JSON.stringify(v)}$q$::jsonb`;

const lines: string[] = [];

lines.push("-- ============ GRADE 12 UNITS: seed data ============");
lines.push(
  "INSERT INTO public.grade12_units (number, title_en, title_sorani, title_badini, theme_en, theme_sorani, theme_badini, grammar_json, vocabulary_json, reading_title, reading_passage, quiz_json, writing_prompt) VALUES",
);
const unitRows = GRADE12_UNITS.map((u) => {
  const grammar = {
    name_en: u.grammar.name_en,
    name_sorani: u.grammar.name_sorani,
    name_badini: u.grammar.name_badini ?? null,
    explanation: u.grammar.explanation,
    examples: u.grammar.examples,
  };
  return (
    "  (" +
    [
      u.number,
      q(u.title_en),
      q(u.title_sorani),
      u.title_badini ? q(u.title_badini) : "NULL",
      q(u.theme_en),
      q(u.theme_sorani),
      u.theme_badini ? q(u.theme_badini) : "NULL",
      jsonb(grammar),
      jsonb(u.vocabulary),
      q(u.reading.title),
      q(u.reading.passage),
      jsonb(u.quiz),
      q(u.writingPrompt),
    ].join(", ") +
    ")"
  );
});
lines.push(unitRows.join(",\n") + ";");

lines.push("");
lines.push("-- ============ GRADE 12 EXAM TIPS: seed data ============");
lines.push("INSERT INTO public.grade12_exam_tips (order_index, tip_en, tip_sorani) VALUES");
const tipRows = GRADE12_EXAM_TIPS.map((tip, i) => `  (${i}, ${q(tip.en)}, ${q(tip.sorani)})`);
lines.push(tipRows.join(",\n") + ";");

console.log(lines.join("\n"));
