import React, { useMemo, useState } from "react";

/**
 * Psychosocial OT Quiz App (single-file React component)
 *
 * Features
 * - One question at a time (MCQ)
 * - Immediate feedback (optional)
 * - Score tracking, review mode, restart
 * - Shuffle questions and options (optional)
 * - Import and export question sets as JSON
 *
 * How to use
 * 1) Replace SAMPLE_QUESTIONS with your own questions, or use the Import box.
 * 2) Each question format:
 *    {
 *      id: "unique",
 *      prompt: "Question text",
 *      choices: ["A...", "B...", "C...", "D..."],
 *      answerIndex: 2,
 *      explanation: "Why it is correct (optional)",
 *      source: "Slide 3" // optional
 *    }
 */

const SAMPLE_QUESTIONS = [
  {
    id: "q1",
    prompt:
      "In psychosocial and community-based settings, what is the primary focus of occupational therapy?",
    choices: [
      "Diagnosing mental health conditions and providing psychotherapy",
      "Exploring emotional experiences through counseling conversations",
      "Supporting function, participation, and quality of life through occupation",
      "Treating symptoms using cognitive behavioral techniques",
    ],
    answerIndex: 2,
    explanation:
      "Psychosocial OT focuses on how mental health impacts occupational participation and uses occupation as the therapeutic tool.",
    source: "Intro slides",
  },
  {
    id: "q2",
    prompt:
      "Which statement best describes what psychosocial means in occupational therapy practice?",
    choices: [
      "A focus on mental health diagnoses and symptom severity",
      "The interaction between psychological and social factors and how they influence occupation",
      "The use of psychotherapy techniques during activities",
      "Emotional processing through verbal reflection alone",
    ],
    answerIndex: 1,
    explanation:
      "Psychosocial perspective considers interaction between psychological and social factors, and how thoughts, emotions, and behavior affect occupation.",
    source: "Psychosocial meaning slide",
  },
  {
    id: "q3",
    prompt: "Which statement best captures the distinction: OT in mental health is not counseling?",
    choices: [
      "OT focuses primarily on symptom talk and diagnosis",
      "OT is talk therapy centered on feelings",
      "OT uses occupation as the therapeutic tool and focuses on doing and participation",
      "OT avoids structured activities in favor of open discussion",
    ],
    answerIndex: 2,
    explanation:
      "The slides emphasize that OT is not psychotherapy, it uses occupation to address functional impact and participation.",
    source: "OT is not counseling slide",
  },
];

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function normalizeQuestionSet(qs, { shuffleQuestions, shuffleChoices }) {
  // Returns questions with stable mapping to answer after choice shuffling.
  let out = qs.map((q) => ({ ...q }));

  if (shuffleChoices) {
    out = out.map((q) => {
      const indexed = q.choices.map((text, idx) => ({ text, idx }));
      const shuffled = shuffleArray(indexed);
      const newChoices = shuffled.map((x) => x.text);
      const newAnswerIndex = shuffled.findIndex((x) => x.idx === q.answerIndex);
      return { ...q, choices: newChoices, answerIndex: newAnswerIndex };
    });
  }

  if (shuffleQuestions) out = shuffleArray(out);

  // Ensure IDs
  out = out.map((q, i) => ({
    ...q,
    id: q.id ?? `q_${i + 1}`,
    choices: q.choices ?? [],
    answerIndex: typeof q.answerIndex === "number" ? q.answerIndex : 0,
  }));

  return out;
}

function Badge({ children }) {
  return (
    <span className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700">
      {children}
    </span>
  );
}

function Button({ children, onClick, disabled, variant = "primary" }) {
  const base =
    "inline-flex items-center justify-center rounded-2xl px-4 py-2 text-sm font-semibold shadow-sm transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50";
  const styles =
    variant === "primary"
      ? "bg-neutral-900 text-white hover:bg-neutral-800"
      : variant === "ghost"
        ? "bg-transparent text-neutral-900 hover:bg-neutral-100"
        : "bg-neutral-100 text-neutral-900 hover:bg-neutral-200";
  return (
    <button className={`${base} ${styles}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

function ChoiceButton({ label, text, selected, correct, incorrect, disabled, onClick }) {
  let className =
    "w-full rounded-2xl border px-4 py-3 text-left text-sm transition shadow-sm";

  if (selected) className += " border-neutral-900";
  else className += " border-neutral-200 hover:border-neutral-400";

  if (correct) className += " bg-emerald-50 border-emerald-300";
  if (incorrect) className += " bg-rose-50 border-rose-300";
  if (disabled) className += " opacity-70";

  return (
    <button className={className} onClick={onClick} disabled={disabled}>
      <div className="flex gap-3">
        <div className="mt-0.5 h-6 w-6 shrink-0 rounded-full bg-neutral-900 text-white flex items-center justify-center text-xs font-bold">
          {label}
        </div>
        <div className="leading-6 text-neutral-900">{text}</div>
      </div>
    </button>
  );
}

function parseJSONSafe(text) {
  try {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) return { ok: false, error: "JSON must be an array of questions." };
    for (const q of parsed) {
      if (!q.prompt || !Array.isArray(q.choices) || q.choices.length < 2) {
        return { ok: false, error: "Each question needs prompt and choices (at least 2)." };
      }
      if (typeof q.answerIndex !== "number") {
        return { ok: false, error: "Each question needs answerIndex as a number." };
      }
    }
    return { ok: true, value: parsed };
  } catch (e) {
    return { ok: false, error: "Invalid JSON." };
  }
}

export default function PsychosocialOTQuizApp() {
  const [shuffleQuestions, setShuffleQuestions] = useState(true);
  const [shuffleChoices, setShuffleChoices] = useState(false);
  const [instantFeedback, setInstantFeedback] = useState(true);

  const [rawQuestions, setRawQuestions] = useState(SAMPLE_QUESTIONS);
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState("");

  const questions = useMemo(
    () => normalizeQuestionSet(rawQuestions, { shuffleQuestions, shuffleChoices }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rawQuestions, shuffleQuestions, shuffleChoices]
  );

  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [history, setHistory] = useState([]);

  const q = questions[index];
  const total = questions.length;
  const progress = total ? Math.round(((index + 1) / total) * 100) : 0;

  function restart() {
    setIndex(0);
    setSelected(null);
    setSubmitted(false);
    setCorrectCount(0);
    setHistory([]);
  }

  function submit() {
    if (selected === null || submitted) return;
    const isCorrect = selected === q.answerIndex;
    setSubmitted(true);
    if (isCorrect) setCorrectCount((c) => c + 1);
    setHistory((h) => [
      ...h,
      {
        id: q.id,
        prompt: q.prompt,
        choices: q.choices,
        answerIndex: q.answerIndex,
        selected,
        isCorrect,
        explanation: q.explanation,
        source: q.source,
      },
    ]);
  }

  function next() {
    if (!submitted) return;
    const nextIndex = index + 1;
    if (nextIndex >= total) return;
    setIndex(nextIndex);
    setSelected(null);
    setSubmitted(false);
  }

  function prevReview(i) {
    setIndex(clamp(i, 0, total - 1));
    setSelected(null);
    setSubmitted(false);
  }

  function handleSelect(i) {
    if (submitted) return;
    setSelected(i);
    if (instantFeedback) {
      // Submit automatically on select
      setTimeout(() => {
        setSubmitted(true);
        const isCorrect = i === q.answerIndex;
        if (isCorrect) setCorrectCount((c) => c + 1);
        setHistory((h) => {
          // Prevent double-write if user toggles quickly
          const already = h.some((x) => x.id === q.id);
          if (already) return h;
          return [
            ...h,
            {
              id: q.id,
              prompt: q.prompt,
              choices: q.choices,
              answerIndex: q.answerIndex,
              selected: i,
              isCorrect,
              explanation: q.explanation,
              source: q.source,
            },
          ];
        });
      }, 0);
    }
  }

  function applyImport() {
    const res = parseJSONSafe(importText.trim());
    if (!res.ok) {
      setImportError(res.error);
      return;
    }
    setImportError("");
    setRawQuestions(res.value);
    restart();
  }

  function exportJSON() {
    const text = JSON.stringify(rawQuestions, null, 2);
    navigator.clipboard
      .writeText(text)
      .then(() => alert("Copied JSON to clipboard."))
      .catch(() => alert("Could not copy, please copy manually."));
  }

  const finished = total > 0 && index === total - 1 && submitted;

  if (!q) {
    return (
      <div className="min-h-screen bg-white p-6">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-2xl font-bold text-neutral-900">Psychosocial OT Quiz</h1>
          <p className="mt-2 text-neutral-700">No questions loaded.</p>
        </div>
      </div>
    );
  }

  const letters = ["A", "B", "C", "D", "E", "F", "G"];

  return (
    <div className="min-h-screen bg-white p-6">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">Psychosocial OT Quiz</h1>
            <p className="mt-1 text-sm text-neutral-600">
              One question at a time, MCQ. Track your score and review.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 justify-end">
            <Badge>
              Score: {correctCount}/{history.length}
            </Badge>
            <Badge>
              Q {index + 1}/{total}
            </Badge>
          </div>
        </div>

        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-neutral-100">
          <div
            className="h-full bg-neutral-900"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="mt-6 rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-neutral-500">{q.source ? `Source: ${q.source}` : ""}</div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={restart}>
                Restart
              </Button>
              <Button variant="ghost" onClick={exportJSON}>
                Export JSON
              </Button>
            </div>
          </div>

          <div className="mt-4">
            <h2 className="text-lg font-semibold text-neutral-900 leading-7">{q.prompt}</h2>
          </div>

          <div className="mt-5 grid gap-3">
            {q.choices.map((choice, i) => {
              const showCorrect = submitted && i === q.answerIndex;
              const showIncorrect = submitted && selected === i && i !== q.answerIndex;
              return (
                <ChoiceButton
                  key={i}
                  label={letters[i] ?? String(i + 1)}
                  text={choice}
                  selected={selected === i}
                  correct={showCorrect}
                  incorrect={showIncorrect}
                  disabled={submitted}
                  onClick={() => handleSelect(i)}
                />
              );
            })}
          </div>

          {!instantFeedback && (
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <Button onClick={submit} disabled={selected === null || submitted}>
                Submit
              </Button>
              <Button variant="secondary" onClick={next} disabled={!submitted || index + 1 >= total}>
                Next
              </Button>
            </div>
          )}

          {instantFeedback && (
            <div className="mt-6 flex items-center gap-2">
              <Button variant="secondary" onClick={next} disabled={!submitted || index + 1 >= total}>
                Next
              </Button>
            </div>
          )}

          {submitted && (
            <div className="mt-6 rounded-2xl bg-neutral-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-neutral-900">
                  {selected === q.answerIndex ? "Correct" : "Incorrect"}
                </div>
                <div className="text-xs text-neutral-500">
                  Correct answer: {letters[q.answerIndex]}
                </div>
              </div>
              {q.explanation && (
                <p className="mt-2 text-sm text-neutral-700 leading-6">{q.explanation}</p>
              )}
            </div>
          )}

          {finished && (
            <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-4">
              <div className="text-sm font-semibold text-neutral-900">Quiz complete</div>
              <p className="mt-1 text-sm text-neutral-700">
                Final score: {correctCount}/{total}
              </p>
            </div>
          )}
        </div>

        <div className="mt-6 rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h3 className="text-base font-semibold text-neutral-900">Settings</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="flex items-center gap-3 rounded-2xl border border-neutral-200 p-3">
              <input
                type="checkbox"
                checked={shuffleQuestions}
                onChange={(e) => setShuffleQuestions(e.target.checked)}
              />
              <div>
                <div className="text-sm font-medium text-neutral-900">Shuffle questions</div>
                <div className="text-xs text-neutral-600">Randomize question order on load</div>
              </div>
            </label>

            <label className="flex items-center gap-3 rounded-2xl border border-neutral-200 p-3">
              <input
                type="checkbox"
                checked={shuffleChoices}
                onChange={(e) => setShuffleChoices(e.target.checked)}
              />
              <div>
                <div className="text-sm font-medium text-neutral-900">Shuffle choices</div>
                <div className="text-xs text-neutral-600">Randomize A, B, C, D order</div>
              </div>
            </label>

            <label className="flex items-center gap-3 rounded-2xl border border-neutral-200 p-3">
              <input
                type="checkbox"
                checked={instantFeedback}
                onChange={(e) => setInstantFeedback(e.target.checked)}
              />
              <div>
                <div className="text-sm font-medium text-neutral-900">Instant feedback</div>
                <div className="text-xs text-neutral-600">Auto submit when you pick an option</div>
              </div>
            </label>

            <div className="rounded-2xl border border-neutral-200 p-3">
              <div className="text-sm font-medium text-neutral-900">Review</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {questions.map((qq, i) => {
                  const h = history.find((x) => x.id === qq.id);
                  const status = h ? (h.isCorrect ? "✓" : "✗") : "•";
                  return (
                    <button
                      key={qq.id}
                      onClick={() => prevReview(i)}
                      className="h-9 w-9 rounded-2xl border border-neutral-200 text-xs font-semibold hover:bg-neutral-50"
                      title={qq.prompt}
                    >
                      {status}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-neutral-600">
                Click a box to jump to that question.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h3 className="text-base font-semibold text-neutral-900">Import questions (JSON)</h3>
          <p className="mt-1 text-sm text-neutral-600">
            Paste an array of questions. This will replace the current set.
          </p>

          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder='[
  {
    "id": "q1",
    "prompt": "...",
    "choices": ["...", "...", "...", "..."],
    "answerIndex": 2,
    "explanation": "...",
    "source": "Slide 5"
  }
]'
            className="mt-4 w-full rounded-2xl border border-neutral-200 p-3 text-sm text-neutral-900 outline-none focus:border-neutral-400"
            rows={10}
          />

          {importError && (
            <div className="mt-3 rounded-2xl bg-rose-50 p-3 text-sm text-rose-700">
              {importError}
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button onClick={applyImport} disabled={!importText.trim()}>
              Import
            </Button>
            <Button variant="secondary" onClick={() => { setImportText(""); setImportError(""); }}>
              Clear
            </Button>
          </div>
        </div>

        <div className="mt-10 text-xs text-neutral-500">
          Tip: If you want me to generate a full question bank from your slides, tell me how many questions you want and whether you prefer easy, mixed, or hard.
        </div>
      </div>
    </div>
  );
}
