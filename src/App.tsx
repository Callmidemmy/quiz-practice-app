import React, { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

type QuestionBase = {
  id: string;
  prompt: string;
  explanation?: string;
  tags?: string[];
};

type McqOption = { id: string; text: string };

type McqQuestion = QuestionBase & {
  type: "mcq";
  options: McqOption[];
  answerId: string;
};

type MatchPair = { left: string; right: string };

type MatchQuestion = QuestionBase & {
  type: "match";
  pairs: MatchPair[];
};

type Question = McqQuestion | MatchQuestion;

type AppConfig = {
  title: string;
  instructions?: string;
  questions: Question[];
};

type Attempt = {
  questionId: string;
  type: Question["type"];
  isCorrect: boolean;
  chosenAnswerId?: string;
  chosenPairs?: Array<{ left: string; right: string }>;
  timestamp: number;
};

type SessionState = {
  config: AppConfig;
  settings: {
    shuffle: boolean;
    showExplanations: boolean;
  };
  progress: {
    currentIndex: number;
    order: string[];
    answersById: Record<string, Attempt>;
    startedAt: number;
    completedAt?: number;
  };
};

const STORAGE_KEY = "quizzer_vite_react_ts_v1";

const sampleConfig: AppConfig = {
  title: "Demo Quiz",
  instructions: "Paste your JSON in Settings. Then study in Quiz mode.",
  questions: [
    {
      id: "q1",
      type: "mcq",
      prompt: "Which vitamin deficiency causes scurvy?",
      options: [
        { id: "a", text: "Vitamin A" },
        { id: "b", text: "Vitamin C" },
        { id: "c", text: "Vitamin D" },
        { id: "d", text: "Vitamin K" },
      ],
      answerId: "b",
      explanation: "Scurvy is due to vitamin C deficiency.",
      tags: ["nutrition"],
    },
    {
      id: "q2",
      type: "match",
      prompt: "Match the organism to the disease",
      pairs: [
        { left: "Streptococcus pyogenes", right: "Impetigo" },
        { left: "Corynebacterium diphtheriae", right: "Diphtheria" },
        { left: "Vibrio cholerae", right: "Cholera" },
      ],
      explanation: "Classic organism-disease pairs.",
      tags: ["microbiology"],
    },
  ],
};

function safeJsonParse<T>(text: string): { ok: true; value: T } | { ok: false; error: string } {
  try {
    const parsed = JSON.parse(text) as T;
    return { ok: true, value: parsed };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Invalid JSON" };
  }
}

function assertConfigShape(config: any): { ok: true; value: AppConfig } | { ok: false; error: string } {
  if (!config || typeof config !== "object") return { ok: false, error: "Config must be an object." };
  if (typeof config.title !== "string") return { ok: false, error: "Config.title must be a string." };
  if (!Array.isArray(config.questions)) return { ok: false, error: "Config.questions must be an array." };

  const ids = new Set<string>();
  for (const q of config.questions) {
    if (!q || typeof q !== "object") return { ok: false, error: "Each question must be an object." };
    if (typeof q.id !== "string" || !q.id.trim()) return { ok: false, error: "Each question must have a non-empty string id." };
    if (ids.has(q.id)) return { ok: false, error: `Duplicate question id: ${q.id}` };
    ids.add(q.id);

    if (typeof q.prompt !== "string" || !q.prompt.trim()) return { ok: false, error: `Question ${q.id} must have a non-empty prompt.` };
    if (q.type !== "mcq" && q.type !== "match") return { ok: false, error: `Question ${q.id} has invalid type. Use "mcq" or "match".` };

    if (q.type === "mcq") {
      if (!Array.isArray(q.options) || q.options.length < 2) return { ok: false, error: `MCQ ${q.id} must have at least 2 options.` };
      const optIds = new Set<string>();
      for (const o of q.options) {
        if (!o || typeof o !== "object") return { ok: false, error: `MCQ ${q.id} options must be objects.` };
        if (typeof o.id !== "string" || !o.id.trim()) return { ok: false, error: `MCQ ${q.id} option id must be a string.` };
        if (optIds.has(o.id)) return { ok: false, error: `MCQ ${q.id} has duplicate option id: ${o.id}` };
        optIds.add(o.id);
        if (typeof o.text !== "string") return { ok: false, error: `MCQ ${q.id} option ${o.id} must have text.` };
      }
      if (typeof q.answerId !== "string" || !optIds.has(q.answerId)) {
        return { ok: false, error: `MCQ ${q.id} answerId must match one of the option ids.` };
      }
    }

    if (q.type === "match") {
      if (!Array.isArray(q.pairs) || q.pairs.length < 2) return { ok: false, error: `Match ${q.id} must have at least 2 pairs.` };
      for (const p of q.pairs) {
        if (!p || typeof p !== "object") return { ok: false, error: `Match ${q.id} pairs must be objects.` };
        if (typeof p.left !== "string" || typeof p.right !== "string") return { ok: false, error: `Match ${q.id} pairs must have left and right strings.` };
      }
    }
  }

  return { ok: true, value: config as AppConfig };
}

function shuffleArray<T>(arr: T[], seed?: number): T[] {
  const a = [...arr];
  let s = typeof seed === "number" ? seed : Date.now();
  const rand = () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildDefaultSession(config: AppConfig): SessionState {
  const order = config.questions.map((q) => q.id);
  return {
    config,
    settings: { shuffle: true, showExplanations: true },
    progress: {
      currentIndex: 0,
      order,
      answersById: {},
      startedAt: Date.now(),
    },
  };
}

function loadSession(): SessionState {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return buildDefaultSession(sampleConfig);

  const parsed = safeJsonParse<SessionState>(raw);
  if (!parsed.ok) return buildDefaultSession(sampleConfig);

  const cfgCheck = assertConfigShape(parsed.value.config);
  if (!cfgCheck.ok) return buildDefaultSession(sampleConfig);

  const cfg = cfgCheck.value;
  const order = Array.isArray(parsed.value.progress?.order) ? parsed.value.progress.order : cfg.questions.map((q) => q.id);
  const cleanOrder = order.filter((id) => cfg.questions.some((q) => q.id === id));
  const missing = cfg.questions.map((q) => q.id).filter((id) => !cleanOrder.includes(id));
  const finalOrder = [...cleanOrder, ...missing];

  return {
    config: cfg,
    settings: {
      shuffle: !!parsed.value.settings?.shuffle,
      showExplanations: parsed.value.settings?.showExplanations ?? true,
    },
    progress: {
      currentIndex: Math.min(Math.max(parsed.value.progress?.currentIndex ?? 0, 0), finalOrder.length - 1),
      order: finalOrder,
      answersById: parsed.value.progress?.answersById ?? {},
      startedAt: parsed.value.progress?.startedAt ?? Date.now(),
      completedAt: parsed.value.progress?.completedAt,
    },
  };
}

function saveSession(session: SessionState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

function percent(n: number, d: number) {
  if (d <= 0) return 0;
  return Math.round((n / d) * 100);
}

function nowMs() {
  return Date.now();
}

export default function App() {
  const [session, setSession] = useState<SessionState>(() => loadSession());
  const [tab, setTab] = useState<"quiz" | "review" | "settings">("quiz");

  const [settingsDraft, setSettingsDraft] = useState<string>(() => JSON.stringify(session.config, null, 2));
  const [settingsError, setSettingsError] = useState<string>("");
  const [toast, setToast] = useState<string>("");

  const toastTimer = useRef<number | null>(null);

  useEffect(() => {
    saveSession(session);
  }, [session]);

  const questionsById = useMemo(() => {
    const m = new Map<string, Question>();
    for (const q of session.config.questions) m.set(q.id, q);
    return m;
  }, [session.config.questions]);

  const orderedQuestions = useMemo(() => {
    return session.progress.order.map((id) => questionsById.get(id)).filter(Boolean) as Question[];
  }, [session.progress.order, questionsById]);

  const total = orderedQuestions.length;

  const current = orderedQuestions[session.progress.currentIndex];

  const answeredCount = useMemo(() => Object.keys(session.progress.answersById).length, [session.progress.answersById]);
  const correctCount = useMemo(() => {
    return Object.values(session.progress.answersById).filter((a) => a.isCorrect).length;
  }, [session.progress.answersById]);

  const incorrectIds = useMemo(() => {
    return Object.values(session.progress.answersById).filter((a) => !a.isCorrect).map((a) => a.questionId);
  }, [session.progress.answersById]);

  const completionPct = percent(answeredCount, total);

  function showToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 1800);
  }

  function resetSession(keepConfig: boolean) {
    setSession((prev) => {
      const cfg = keepConfig ? prev.config : sampleConfig;
      const fresh = buildDefaultSession(cfg);
      const order = fresh.progress.order;
      const finalOrder = prev.settings.shuffle ? shuffleArray(order) : order;
      return {
        ...fresh,
        settings: {
          shuffle: prev.settings.shuffle,
          showExplanations: prev.settings.showExplanations,
        },
        progress: {
          ...fresh.progress,
          order: finalOrder,
        },
      };
    });
    setTab("quiz");
    showToast("Session reset");
  }

  function startNewSessionShuffleMaybe() {
    setSession((prev) => {
      const baseOrder = prev.config.questions.map((q) => q.id);
      const order = prev.settings.shuffle ? shuffleArray(baseOrder) : baseOrder;
      return {
        ...prev,
        progress: {
          currentIndex: 0,
          order,
          answersById: {},
          startedAt: nowMs(),
          completedAt: undefined,
        },
      };
    });
  }

  function goPrev() {
    setSession((prev) => ({
      ...prev,
      progress: {
        ...prev.progress,
        currentIndex: Math.max(0, prev.progress.currentIndex - 1),
      },
    }));
  }

  function goNext() {
    setSession((prev) => {
      const nextIndex = Math.min(prev.progress.currentIndex + 1, prev.progress.order.length - 1);
      const completedAt = nextIndex === prev.progress.order.length - 1 && Object.keys(prev.progress.answersById).length === prev.progress.order.length
        ? nowMs()
        : prev.progress.completedAt;
      return {
        ...prev,
        progress: {
          ...prev.progress,
          currentIndex: nextIndex,
          completedAt,
        },
      };
    });
  }

  function jumpTo(index: number) {
    setSession((prev) => ({
      ...prev,
      progress: {
        ...prev.progress,
        currentIndex: Math.min(Math.max(index, 0), prev.progress.order.length - 1),
      },
    }));
  }

  function markMcq(question: McqQuestion, chosen: string) {
    const isCorrect = chosen === question.answerId;
    const attempt: Attempt = {
      questionId: question.id,
      type: "mcq",
      isCorrect,
      chosenAnswerId: chosen,
      timestamp: nowMs(),
    };
    setSession((prev) => ({
      ...prev,
      progress: {
        ...prev.progress,
        answersById: { ...prev.progress.answersById, [question.id]: attempt },
      },
    }));
  }

  function markMatch(question: MatchQuestion, chosenPairs: Array<{ left: string; right: string }>) {
    const correctPairs = question.pairs;
    const normalize = (pairs: Array<{ left: string; right: string }>) =>
      [...pairs].map((p) => `${p.left}=>${p.right}`).sort().join("|");
    const isCorrect = normalize(chosenPairs) === normalize(correctPairs);

    const attempt: Attempt = {
      questionId: question.id,
      type: "match",
      isCorrect,
      chosenPairs,
      timestamp: nowMs(),
    };

    setSession((prev) => ({
      ...prev,
      progress: {
        ...prev.progress,
        answersById: { ...prev.progress.answersById, [question.id]: attempt },
      },
    }));
  }

  function copyToClipboard(text: string) {
    navigator.clipboard
      .writeText(text)
      .then(() => showToast("Copied"))
      .catch(() => showToast("Copy failed"));
  }

  function applySettingsJson() {
    setSettingsError("");
    const parsed = safeJsonParse<any>(settingsDraft);
    if (!parsed.ok) {
      setSettingsError(parsed.error);
      return;
    }
    const checked = assertConfigShape(parsed.value);
    if (!checked.ok) {
      setSettingsError(checked.error);
      return;
    }

    const cfg = checked.value;

    setSession((prev) => {
      const baseOrder = cfg.questions.map((q) => q.id);
      const order = prev.settings.shuffle ? shuffleArray(baseOrder) : baseOrder;
      return {
        ...prev,
        config: cfg,
        progress: {
          currentIndex: 0,
          order,
          answersById: {},
          startedAt: nowMs(),
          completedAt: undefined,
        },
      };
    });

    showToast("Config applied");
    setTab("quiz");
  }

  useEffect(() => {
    setSettingsDraft(JSON.stringify(session.config, null, 2));
  }, [session.config]);

  const header = (
    <div className="topbar">
      <div className="topbar-left">
        <div className="title">{session.config.title}</div>
        {session.config.instructions ? <div className="subtitle">{session.config.instructions}</div> : null}
      </div>

      <div className="topbar-right">
        <button className={`tab ${tab === "quiz" ? "active" : ""}`} onClick={() => setTab("quiz")}>
          Quiz
        </button>
        <button className={`tab ${tab === "review" ? "active" : ""}`} onClick={() => setTab("review")}>
          Review
        </button>
        <button className={`tab ${tab === "settings" ? "active" : ""}`} onClick={() => setTab("settings")}>
          Settings
        </button>
      </div>
    </div>
  );

  const progressBar = (
    <div className="progress-wrap">
      <div className="progress-meta">
        <div>
          Progress: <b>{answeredCount}</b>/{total} ({completionPct}%)
        </div>
        <div>
          Score: <b>{correctCount}</b> correct, <b>{answeredCount - correctCount}</b> incorrect
        </div>
      </div>
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${completionPct}%` }} />
      </div>
    </div>
  );

  const footerActions = (
    <div className="footer">
      <div className="footer-left">
        <label className="toggle">
          <input
            type="checkbox"
            checked={session.settings.shuffle}
            onChange={(e) => {
              const v = e.target.checked;
              setSession((prev) => ({ ...prev, settings: { ...prev.settings, shuffle: v } }));
            }}
          />
          Shuffle on new session
        </label>

        <label className="toggle">
          <input
            type="checkbox"
            checked={session.settings.showExplanations}
            onChange={(e) => {
              const v = e.target.checked;
              setSession((prev) => ({ ...prev, settings: { ...prev.settings, showExplanations: v } }));
            }}
          />
          Show explanations
        </label>
      </div>

      <div className="footer-right">
        <button className="btn ghost" onClick={() => startNewSessionShuffleMaybe()}>
          New session
        </button>
        <button className="btn ghost" onClick={() => resetSession(true)}>
          Reset answers
        </button>
      </div>
    </div>
  );

  return (
    <div className="app">
      {header}
      {toast ? <div className="toast">{toast}</div> : null}

      {tab === "quiz" ? (
        <div className="panel">
          {progressBar}

          {!current ? (
            <div className="card">
              <h2>No questions found</h2>
              <p>Go to Settings and paste your JSON.</p>
            </div>
          ) : (
            <QuizCard
              key={current.id}
              index={session.progress.currentIndex}
              total={total}
              question={current}
              attempt={session.progress.answersById[current.id]}
              onPrev={goPrev}
              onNext={goNext}
              onJump={jumpTo}
              onAnswerMcq={markMcq}
              onAnswerMatch={markMatch}
              showExplanation={session.settings.showExplanations}
              allAttempts={session.progress.answersById}
              orderedQuestions={orderedQuestions}
            />
          )}

          {footerActions}
        </div>
      ) : null}

      {tab === "review" ? (
        <div className="panel">
          {progressBar}

          <div className="card">
            <h2>Review incorrect</h2>
            <p>
              You have <b>{incorrectIds.length}</b> incorrect question(s).
            </p>
            {incorrectIds.length === 0 ? (
              <div className="muted">Nothing to review yet.</div>
            ) : (
              <div className="review-list">
                {incorrectIds.map((id) => {
                  const q = questionsById.get(id);
                  if (!q) return null;
                  const idx = session.progress.order.indexOf(id);
                  return (
                    <button
                      key={id}
                      className="review-item"
                      onClick={() => {
                        setTab("quiz");
                        jumpTo(idx);
                      }}
                    >
                      <div className="review-type">{q.type.toUpperCase()}</div>
                      <div className="review-prompt">{q.prompt}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {footerActions}
        </div>
      ) : null}

      {tab === "settings" ? (
        <div className="panel">
          <div className="card">
            <h2>Paste JSON config</h2>
            <p className="muted">
              Paste an AppConfig object. It must include: title, questions. Each question must have id, type, prompt, and the
              required fields per type.
            </p>

            <div className="settings-actions">
              <button className="btn ghost" onClick={() => setSettingsDraft(JSON.stringify(sampleConfig, null, 2))}>
                Load demo
              </button>
              <button className="btn ghost" onClick={() => copyToClipboard(settingsDraft)}>
                Copy current JSON
              </button>
              <button className="btn ghost" onClick={() => {
                localStorage.removeItem(STORAGE_KEY);
                setSession(buildDefaultSession(sampleConfig));
                showToast("Local storage cleared");
              }}>
                Clear storage
              </button>
            </div>

            <textarea
              className="textarea"
              value={settingsDraft}
              onChange={(e) => setSettingsDraft(e.target.value)}
              spellCheck={false}
            />

            {settingsError ? <div className="error">{settingsError}</div> : null}

            <div className="settings-actions">
              <button className="btn" onClick={applySettingsJson}>
                Apply
              </button>
            </div>

            <div className="card subtle">
              <h3>Schema reminder</h3>
              <pre className="code">
{`{
  "title": "My Quiz",
  "instructions": "Optional",
  "questions": [
    {
      "id": "q1",
      "type": "mcq",
      "prompt": "Question",
      "options": [{"id":"a","text":"A"},{"id":"b","text":"B"}],
      "answerId": "a",
      "explanation": "Optional"
    },
    {
      "id": "q2",
      "type": "match",
      "prompt": "Match the items",
      "pairs": [{"left":"Term","right":"Definition"}],
      "explanation": "Optional"
    }
  ]
}`}
              </pre>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function QuizCard(props: {
  index: number;
  total: number;
  question: Question;
  attempt?: Attempt;
  onPrev: () => void;
  onNext: () => void;
  onJump: (i: number) => void;
  onAnswerMcq: (q: McqQuestion, chosen: string) => void;
  onAnswerMatch: (q: MatchQuestion, chosenPairs: Array<{ left: string; right: string }>) => void;
  showExplanation: boolean;
  allAttempts: Record<string, Attempt>;
  orderedQuestions: Question[];
}) {
  const {
    index,
    total,
    question,
    attempt,
    onPrev,
    onNext,
    onJump,
    onAnswerMcq,
    onAnswerMatch,
    showExplanation,
    allAttempts,
    orderedQuestions,
  } = props;

  return (
    <div className="card">
      <div className="card-header">
        <div className="pill">
          Question <b>{index + 1}</b> of <b>{total}</b>
        </div>

        <div className="jump">
          <label className="muted">Jump</label>
          <select value={index} onChange={(e) => onJump(Number(e.target.value))}>
            {orderedQuestions.map((q, i) => {
              const a = allAttempts[q.id];
              const status = !a ? " " : a.isCorrect ? "✓" : "✗";
              return (
                <option key={q.id} value={i}>
                  {i + 1}. {q.type.toUpperCase()} {status}
                </option>
              );
            })}
          </select>
        </div>
      </div>

      <h2 className="prompt">{question.prompt}</h2>

      {question.type === "mcq" ? (
        <McqView question={question} attempt={attempt} onChoose={(id) => onAnswerMcq(question, id)} />
      ) : (
        <MatchView question={question} attempt={attempt} onSubmit={(pairs) => onAnswerMatch(question, pairs)} />
      )}

      {attempt ? (
        <div className={`result ${attempt.isCorrect ? "good" : "bad"}`}>
          {attempt.isCorrect ? "Correct" : "Incorrect"}
        </div>
      ) : null}

      {attempt && showExplanation && question.explanation ? (
        <div className="explain">
          <div className="explain-title">Explanation</div>
          <div className="explain-body">{question.explanation}</div>
        </div>
      ) : null}

      <div className="nav">
        <button className="btn ghost" onClick={onPrev} disabled={index === 0}>
          Previous
        </button>
        <button className="btn ghost" onClick={onNext} disabled={index === total - 1}>
          Next
        </button>
      </div>
    </div>
  );
}

function McqView(props: {
  question: McqQuestion;
  attempt?: Attempt;
  onChoose: (id: string) => void;
}) {
  const { question, attempt, onChoose } = props;

  return (
    <div className="choices">
      {question.options.map((o) => {
        const chosen = attempt?.chosenAnswerId === o.id;
        const correct = o.id === question.answerId;
        const showMark = !!attempt;

        const cls = [
          "choice",
          chosen ? "chosen" : "",
          showMark && correct ? "correct" : "",
          showMark && chosen && !correct ? "wrong" : "",
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <button key={o.id} className={cls} onClick={() => onChoose(o.id)} disabled={!!attempt}>
            <div className="choice-left">
              <div className="choice-id">{o.id.toUpperCase()}</div>
              <div className="choice-text">{o.text}</div>
            </div>
            {showMark ? <div className="choice-mark">{correct ? "✓" : chosen ? "✗" : ""}</div> : null}
          </button>
        );
      })}
    </div>
  );
}

function MatchView(props: {
  question: MatchQuestion;
  attempt?: Attempt;
  onSubmit: (pairs: Array<{ left: string; right: string }>) => void;
}) {
  const { question, attempt, onSubmit } = props;

  const leftItems = useMemo(() => question.pairs.map((p) => p.left), [question.pairs]);
  const rightItemsShuffled = useMemo(() => shuffleArray(question.pairs.map((p) => p.right)), [question.pairs]);

  const [selected, setSelected] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const l of leftItems) init[l] = "";
    return init;
  });

  useEffect(() => {
    const init: Record<string, string> = {};
    for (const l of leftItems) init[l] = "";
    setSelected(init);
  }, [question.id, leftItems]);

  const locked = !!attempt;

  const chosenPairs = useMemo(() => {
    return leftItems
      .map((l) => ({ left: l, right: selected[l] }))
      .filter((p) => p.right);
  }, [leftItems, selected]);

  const canSubmit = chosenPairs.length === leftItems.length && !locked;

  const correctMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of question.pairs) m.set(p.left, p.right);
    return m;
  }, [question.pairs]);

  function submit() {
    if (!canSubmit) return;
    onSubmit(chosenPairs);
  }

  return (
    <div className="match">
      <div className="match-grid">
        {leftItems.map((l) => {
          const chosenRight = locked ? attempt?.chosenPairs?.find((p) => p.left === l)?.right ?? "" : selected[l];
          const correctRight = correctMap.get(l) ?? "";
          const isCorrect = locked ? chosenRight === correctRight : false;

          return (
            <div key={l} className="match-row">
              <div className="match-left">{l}</div>
              <select
                className={`match-select ${locked ? (isCorrect ? "ok" : "no") : ""}`}
                value={chosenRight}
                onChange={(e) => {
                  const v = e.target.value;
                  setSelected((prev) => ({ ...prev, [l]: v }));
                }}
                disabled={locked}
              >
                <option value="">Select</option>
                {rightItemsShuffled.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              {locked ? <div className="match-mark">{isCorrect ? "✓" : "✗"}</div> : <div className="match-mark" />}
            </div>
          );
        })}
      </div>

      <div className="match-actions">
        <button className="btn" onClick={submit} disabled={!canSubmit}>
          Submit matches
        </button>
        {!locked ? <div className="muted">Tip: you must match all items before submitting.</div> : null}
      </div>

      {locked ? (
        <div className="match-correct">
          <div className="explain-title">Correct pairs</div>
          <ul className="pairs">
            {question.pairs.map((p) => (
              <li key={`${p.left}=>${p.right}`}>
                <b>{p.left}</b> , {p.right}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}