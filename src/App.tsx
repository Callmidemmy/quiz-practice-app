import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  CheckCircle2,
  Download,
  Layers,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Shuffle,
  Timer,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";

/**
 * StackBlitz-ready Quizlet-style app
 * No shadcn/ui imports, no @ alias imports.
 * Works in src/App.tsx in a React + TS project.
 */

type CardT = {
  id: string;
  term: string;
  definition: string;
  due: number;
  ef: number;
  reps: number;
  interval: number; // days
  lapses: number;
  lastReviewed: number | null;
};

type DeckT = {
  id: string;
  name: string;
  description: string;
  cards: CardT[];
};

type AppState = {
  decks: DeckT[];
  selectedDeckId: string | null;
};

const LS_KEY = "quiz_practice_stackblitz_v1";

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}
function nowMs() {
  return Date.now();
}
function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}
function shuffleArray<T>(arr: T[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function formatDue(ms: number) {
  const d = new Date(ms);
  return d.toLocaleString();
}

function defaultData(): AppState {
  const sampleCards: Omit<CardT, "id">[] = [
    {
      term: "NIST",
      definition: "A US standards body, often referenced for security frameworks.",
      due: nowMs(),
      ef: 2.3,
      reps: 0,
      interval: 0,
      lapses: 0,
      lastReviewed: null,
    },
    {
      term: "COBIT",
      definition: "A framework for governance and management of enterprise IT.",
      due: nowMs(),
      ef: 2.3,
      reps: 0,
      interval: 0,
      lapses: 0,
      lastReviewed: null,
    },
    {
      term: "ITGC",
      definition: "IT general controls that support reliable system operation.",
      due: nowMs(),
      ef: 2.3,
      reps: 0,
      interval: 0,
      lapses: 0,
      lastReviewed: null,
    },
  ];

  const deck: DeckT = {
    id: uid(),
    name: "Sample Deck",
    description: "A few example cards. Create your own deck and start practicing.",
    cards: sampleCards.map((c) => ({ ...c, id: uid() })),
  };

  return { decks: [deck], selectedDeckId: deck.id };
}

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return defaultData();
    const parsed = JSON.parse(raw) as AppState;
    if (!parsed?.decks?.length) return defaultData();
    const first = parsed.decks[0]?.id ?? null;
    return { ...parsed, selectedDeckId: parsed.selectedDeckId ?? first };
  } catch {
    return defaultData();
  }
}
function saveState(state: AppState) {
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}

function safeJsonParse(text: string): { ok: true; value: any } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Invalid JSON" };
  }
}

// Simplified spaced repetition scheduling
// grade: 0 Again, 1 Hard, 2 Good, 3 Easy
function scheduleNext(card: CardT, grade: 0 | 1 | 2 | 3): CardT {
  const c: CardT = { ...card };
  const ef = typeof c.ef === "number" ? c.ef : 2.3;
  const reps = typeof c.reps === "number" ? c.reps : 0;
  const interval = typeof c.interval === "number" ? c.interval : 0;

  let newEf = ef;

  if (grade === 0) {
    c.reps = 0;
    c.interval = 0;
    c.due = nowMs();
    c.lapses = (c.lapses || 0) + 1;
    newEf = clamp(ef - 0.2, 1.3, 3.0);
  } else {
    const newReps = reps + 1;
    c.reps = newReps;

    if (grade === 1) newEf = clamp(ef - 0.05, 1.3, 3.0);
    if (grade === 2) newEf = clamp(ef + 0.02, 1.3, 3.0);
    if (grade === 3) newEf = clamp(ef + 0.08, 1.3, 3.0);

    let newInterval: number;
    if (newReps === 1) newInterval = 1;
    else if (newReps === 2) newInterval = grade === 1 ? 2 : 3;
    else {
      const mult = grade === 1 ? 1.15 : grade === 2 ? 1.35 : 1.7;
      newInterval = Math.max(1, Math.round(interval * newEf * mult));
    }

    c.interval = newInterval;
    c.due = nowMs() + newInterval * 24 * 60 * 60 * 1000;
  }

  c.ef = newEf;
  c.lastReviewed = nowMs();
  return c;
}

function pickN<T extends { id: string }>(arr: T[], n: number, excludeIds: Set<string>) {
  const pool = arr.filter((x) => !excludeIds.has(x.id));
  return shuffleArray(pool).slice(0, n);
}

/* ---------- Tiny UI helpers (no libraries) ---------- */

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function Card(props: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cx("card", props.className)}
      style={{
        border: "1px solid rgba(0,0,0,0.12)",
        borderRadius: 16,
        background: "white",
        boxShadow: "0 1px 8px rgba(0,0,0,0.05)",
      }}
    >
      {props.children}
    </div>
  );
}

function Button(props: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger";
  className?: string;
  type?: "button" | "submit";
}) {
  const variant = props.variant ?? "primary";
  const base: React.CSSProperties = {
    borderRadius: 12,
    padding: "10px 12px",
    border: "1px solid rgba(0,0,0,0.12)",
    cursor: props.disabled ? "not-allowed" : "pointer",
    opacity: props.disabled ? 0.6 : 1,
    fontWeight: 600,
    display: "inline-flex",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
    userSelect: "none",
    background: "white",
  };

  const styles: Record<string, React.CSSProperties> = {
    primary: { ...base, background: "#111827", color: "white", border: "1px solid #111827" },
    secondary: { ...base, background: "white", color: "#111827" },
    danger: { ...base, background: "#b91c1c", color: "white", border: "1px solid #b91c1c" },
  };

  return (
    <button
      type={props.type ?? "button"}
      onClick={props.disabled ? undefined : props.onClick}
      style={styles[variant]}
      className={props.className}
    >
      {props.children}
    </button>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={{
        width: "100%",
        borderRadius: 12,
        border: "1px solid rgba(0,0,0,0.12)",
        padding: "10px 12px",
        outline: "none",
      }}
    />
  );
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      style={{
        width: "100%",
        borderRadius: 12,
        border: "1px solid rgba(0,0,0,0.12)",
        padding: "10px 12px",
        outline: "none",
        minHeight: 90,
        resize: "vertical",
      }}
    />
  );
}

function Badge(props: { children: React.ReactNode; tone?: "neutral" | "good" }) {
  const tone = props.tone ?? "neutral";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 12,
        border: "1px solid rgba(0,0,0,0.12)",
        background: tone === "good" ? "rgba(34,197,94,0.12)" : "rgba(0,0,0,0.04)",
      }}
    >
      {props.children}
    </span>
  );
}

function ProgressBar(props: { value: number }) {
  const v = clamp(props.value, 0, 100);
  return (
    <div style={{ width: "100%", height: 10, borderRadius: 999, background: "rgba(0,0,0,0.08)" }}>
      <div
        style={{
          width: `${v}%`,
          height: 10,
          borderRadius: 999,
          background: "#111827",
          transition: "width 200ms ease",
        }}
      />
    </div>
  );
}

function Modal(props: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  footer: React.ReactNode;
  onClose: () => void;
}) {
  if (!props.open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        zIndex: 50,
      }}
      onMouseDown={props.onClose}
    >
      <div
        style={{
          width: "min(720px, 100%)",
          background: "white",
          borderRadius: 16,
          border: "1px solid rgba(0,0,0,0.12)",
          boxShadow: "0 10px 40px rgba(0,0,0,0.25)",
          padding: 16,
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 10 }}>{props.title}</div>
        <div style={{ display: "grid", gap: 10 }}>{props.children}</div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
          {props.footer}
        </div>
      </div>
    </div>
  );
}

/* ---------------------- App ---------------------- */

type Mode = "flashcards" | "learn" | "test" | "manage";

type LearnSession = {
  startedAt: number;
  queue: CardT[];
  idx: number;
  flipped: boolean;
  graded: number;
  total: number;
} | null;

type TestConfig = {
  count: number;
  direction: "term_to_definition" | "definition_to_term";
  includeNotDue: boolean;
};

type TestQuestion = {
  id: string;
  cardId: string;
  prompt: string;
  correct: string;
  options: string[];
  picked: string | null;
  isCorrect: boolean | null;
};

type TestSession = {
  idx: number;
  questions: TestQuestion[];
  startedAt: number;
  finished: boolean;
} | null;

export default function App() {
  const [state, setState] = useState<AppState>(() => loadState());

  useEffect(() => {
    saveState(state);
  }, [state]);

  const decks = state.decks;

  const selectedDeck = useMemo(() => {
    const d = decks.find((x) => x.id === state.selectedDeckId) ?? decks[0] ?? null;
    return d;
  }, [decks, state.selectedDeckId]);

  // Search within selected deck
  const [globalQuery, setGlobalQuery] = useState("");
  const filteredCards = useMemo(() => {
    if (!selectedDeck) return [];
    const q = globalQuery.trim().toLowerCase();
    if (!q) return selectedDeck.cards;
    return selectedDeck.cards.filter(
      (c) => c.term.toLowerCase().includes(q) || c.definition.toLowerCase().includes(q)
    );
  }, [selectedDeck, globalQuery]);

  function updateDeck(deckId: string, updater: (d: DeckT) => DeckT) {
    setState((s) => ({
      ...s,
      decks: s.decks.map((d) => (d.id === deckId ? updater(d) : d)),
    }));
  }

  function addDeck() {
    const id = uid();
    const deck: DeckT = { id, name: "New Deck", description: "", cards: [] };
    setState((s) => ({ ...s, decks: [deck, ...s.decks], selectedDeckId: id }));
  }

  function deleteDeck(deckId: string) {
    setState((s) => {
      const nextDecks = s.decks.filter((d) => d.id !== deckId);
      if (!nextDecks.length) return defaultData();
      return { ...s, decks: nextDecks, selectedDeckId: nextDecks[0].id };
    });
  }

  function addCard(deckId: string, term: string, definition: string) {
    updateDeck(deckId, (d) => ({
      ...d,
      cards: [
        {
          id: uid(),
          term,
          definition,
          due: nowMs(),
          ef: 2.3,
          reps: 0,
          interval: 0,
          lapses: 0,
          lastReviewed: null,
        },
        ...d.cards,
      ],
    }));
  }

  function updateCard(deckId: string, cardId: string, patch: Partial<CardT>) {
    updateDeck(deckId, (d) => ({
      ...d,
      cards: d.cards.map((c) => (c.id === cardId ? { ...c, ...patch } : c)),
    }));
  }

  function deleteCard(deckId: string, cardId: string) {
    updateDeck(deckId, (d) => ({ ...d, cards: d.cards.filter((c) => c.id !== cardId) }));
  }

  function resetProgress(deckId: string) {
    updateDeck(deckId, (d) => ({
      ...d,
      cards: d.cards.map((c) => ({
        ...c,
        due: nowMs(),
        ef: 2.3,
        reps: 0,
        interval: 0,
        lapses: 0,
        lastReviewed: null,
      })),
    }));
  }

  // Import / export
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function exportJson() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "quiz_practice_export.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function triggerImport() {
    fileInputRef.current?.click();
  }

  async function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const parsed = safeJsonParse(text);
    if (!parsed.ok) {
      alert(parsed.error);
      e.target.value = "";
      return;
    }
    const incoming = parsed.value;

    // Accept either full app state or array of decks
    if (incoming?.decks?.length) {
      const first = incoming.decks[0]?.id ?? null;
      setState({ decks: incoming.decks, selectedDeckId: incoming.selectedDeckId ?? first });
    } else if (Array.isArray(incoming)) {
      const decks: DeckT[] = incoming.map((d: any) => ({
        id: d.id || uid(),
        name: d.name || "Imported Deck",
        description: d.description || "",
        cards: (d.cards || []).map((c: any) => ({
          id: c.id || uid(),
          term: c.term || "",
          definition: c.definition || "",
          due: typeof c.due === "number" ? c.due : nowMs(),
          ef: typeof c.ef === "number" ? c.ef : 2.3,
          reps: typeof c.reps === "number" ? c.reps : 0,
          interval: typeof c.interval === "number" ? c.interval : 0,
          lapses: typeof c.lapses === "number" ? c.lapses : 0,
          lastReviewed: typeof c.lastReviewed === "number" ? c.lastReviewed : null,
        })),
      }));
      setState({ decks, selectedDeckId: decks[0]?.id ?? null });
    } else {
      alert("Unsupported JSON format. Export from this app, then import that file.");
    }

    e.target.value = "";
  }

  // Tabs
  const [mode, setMode] = useState<Mode>("flashcards");

  // Flashcards
  const [fcIndex, setFcIndex] = useState(0);
  const [fcFlipped, setFcFlipped] = useState(false);
  const [fcShuffle, setFcShuffle] = useState(false);

  const fcCards = useMemo(() => {
    const base = filteredCards;
    return fcShuffle ? shuffleArray(base) : base;
  }, [filteredCards, fcShuffle]);

  useEffect(() => {
    setFcIndex(0);
    setFcFlipped(false);
  }, [state.selectedDeckId, globalQuery, fcShuffle]);

  const currentFc = fcCards[clamp(fcIndex, 0, Math.max(0, fcCards.length - 1))];

  // Learn
  const [learnSession, setLearnSession] = useState<LearnSession>(null);

  function startLearn() {
    if (!selectedDeck) return;
    const now = nowMs();
    const due = selectedDeck.cards.filter((c) => (c.due ?? 0) <= now);
    const notDue = selectedDeck.cards.filter((c) => (c.due ?? 0) > now);
    const queue = [...shuffleArray(due), ...shuffleArray(notDue)].slice(0, 50);
    setLearnSession({
      startedAt: now,
      queue,
      idx: 0,
      flipped: false,
      graded: 0,
      total: queue.length,
    });
  }

  function gradeLearn(grade: 0 | 1 | 2 | 3) {
    if (!selectedDeck || !learnSession) return;
    const card = learnSession.queue[learnSession.idx];
    if (!card) return;

    const updated = scheduleNext(card, grade);
    updateCard(selectedDeck.id, card.id, updated);

    setLearnSession((ls) => {
      if (!ls) return ls;
      return { ...ls, idx: ls.idx + 1, flipped: false, graded: ls.graded + 1 };
    });
  }

  function resetLearn() {
    setLearnSession(null);
  }

  // Test
  const [testConfig, setTestConfig] = useState<TestConfig>({
    count: 10,
    direction: "term_to_definition",
    includeNotDue: true,
  });

  const [testSession, setTestSession] = useState<TestSession>(null);

  function buildTest() {
    if (!selectedDeck) return;

    const now = nowMs();
    const pool = testConfig.includeNotDue
      ? selectedDeck.cards
      : selectedDeck.cards.filter((c) => (c.due ?? 0) <= now);

    const count = clamp(Number(testConfig.count) || 10, 1, 50);
    const base = shuffleArray(pool).slice(0, Math.min(count, pool.length));
    const allCards = selectedDeck.cards;

    const questions: TestQuestion[] = base.map((c) => {
      const correct = testConfig.direction === "term_to_definition" ? c.definition : c.term;
      const prompt = testConfig.direction === "term_to_definition" ? c.term : c.definition;
      const distractFrom = pickN(allCards, 3, new Set([c.id]));
      const distractors = distractFrom.map((d) =>
        testConfig.direction === "term_to_definition" ? d.definition : d.term
      );
      const options = shuffleArray([correct, ...distractors]);
      return {
        id: uid(),
        cardId: c.id,
        prompt,
        correct,
        options,
        picked: null,
        isCorrect: null,
      };
    });

    setTestSession({ idx: 0, questions, startedAt: nowMs(), finished: false });
  }

  function pickOption(opt: string) {
    setTestSession((ts) => {
      if (!ts) return ts;
      const q = ts.questions[ts.idx];
      if (!q || q.picked != null) return ts;

      const isCorrect = opt === q.correct;
      const nextQuestions = ts.questions.map((qq, i) =>
        i === ts.idx ? { ...qq, picked: opt, isCorrect } : qq
      );
      return { ...ts, questions: nextQuestions };
    });
  }

  function nextQuestion() {
    setTestSession((ts) => {
      if (!ts) return ts;
      const nextIdx = ts.idx + 1;
      const finished = nextIdx >= ts.questions.length;
      return { ...ts, idx: finished ? ts.idx : nextIdx, finished };
    });
  }

  function prevQuestion() {
    setTestSession((ts) => {
      if (!ts) return ts;
      return { ...ts, idx: Math.max(0, ts.idx - 1) };
    });
  }

  function endTest() {
    setTestSession(null);
  }

  const testScore = useMemo(() => {
    if (!testSession) return { correct: 0, total: 0 };
    const total = testSession.questions.length;
    const correct = testSession.questions.filter((q) => q.isCorrect === true).length;
    return { correct, total };
  }, [testSession]);

  // Stats
  const stats = useMemo(() => {
    if (!selectedDeck) return { total: 0, due: 0, mastered: 0 };
    const total = selectedDeck.cards.length;
    const due = selectedDeck.cards.filter((c) => (c.due ?? 0) <= nowMs()).length;
    const mastered = selectedDeck.cards.filter((c) => (c.reps ?? 0) >= 5 && (c.interval ?? 0) >= 14).length;
    return { total, due, mastered };
  }, [selectedDeck, state]);

  // Deck edit modal
  const [deckEditOpen, setDeckEditOpen] = useState(false);
  const [deckDraft, setDeckDraft] = useState({ name: "", description: "" });

  useEffect(() => {
    if (selectedDeck) setDeckDraft({ name: selectedDeck.name, description: selectedDeck.description || "" });
  }, [selectedDeck?.id]);

  function saveDeckMeta() {
    if (!selectedDeck) return;
    updateDeck(selectedDeck.id, (d) => ({
      ...d,
      name: deckDraft.name.trim() || "Untitled Deck",
      description: deckDraft.description,
    }));
    setDeckEditOpen(false);
  }

  // Card modal
  const [cardModalOpen, setCardModalOpen] = useState(false);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [cardDraft, setCardDraft] = useState({ term: "", definition: "" });

  function openNewCard() {
    setEditingCardId(null);
    setCardDraft({ term: "", definition: "" });
    setCardModalOpen(true);
  }

  function openEditCard(card: CardT) {
    setEditingCardId(card.id);
    setCardDraft({ term: card.term, definition: card.definition });
    setCardModalOpen(true);
  }

  function saveCard() {
    if (!selectedDeck) return;
    const term = cardDraft.term.trim();
    const definition = cardDraft.definition.trim();
    if (!term && !definition) return;

    if (editingCardId) updateCard(selectedDeck.id, editingCardId, { term, definition });
    else addCard(selectedDeck.id, term, definition);

    setCardModalOpen(false);
  }

  // Layout helpers
  const page: React.CSSProperties = {
    minHeight: "100vh",
    background: "#f6f7fb",
    color: "#111827",
  };

  const container: React.CSSProperties = {
    maxWidth: 1120,
    margin: "0 auto",
    padding: 16,
  };

  const topRow: React.CSSProperties = {
    display: "flex",
    flexWrap: "wrap",
    gap: 12,
    alignItems: "center",
    justifyContent: "space-between",
  };

  const grid: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 16,
    marginTop: 16,
  };

  const isWide = typeof window !== "undefined" ? window.innerWidth >= 900 : false;
  if (isWide) {
    (grid as any).gridTemplateColumns = "340px 1fr";
    (grid as any).alignItems = "start";
  }

  return (
    <div style={page}>
      <div style={container}>
        <div style={topRow}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 16,
                background: "rgba(0,0,0,0.06)",
                display: "grid",
                placeItems: "center",
              }}
            >
              <Layers size={18} />
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 900 }}>Quiz Practice</div>
              <div style={{ fontSize: 13, color: "rgba(0,0,0,0.6)" }}>
                Flashcards, learn, and tests, built like a lightweight Quizlet.
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input ref={fileInputRef} type="file" accept="application/json" style={{ display: "none" }} onChange={onImportFile} />
            <Button variant="secondary" onClick={triggerImport}>
              <Upload size={16} /> Import
            </Button>
            <Button variant="secondary" onClick={exportJson}>
              <Download size={16} /> Export
            </Button>
            <Button onClick={addDeck}>
              <Plus size={16} /> New deck
            </Button>
          </div>
        </div>

        <div style={grid}>
          {/* Sidebar */}
          <Card>
            <div style={{ padding: 14 }}>
              <div style={{ fontWeight: 900, marginBottom: 10 }}>Decks</div>

              <div style={{ position: "relative", marginBottom: 10 }}>
                <div style={{ position: "absolute", left: 10, top: 11, opacity: 0.6 }}>
                  <Search size={16} />
                </div>
                <Input
                  value={globalQuery}
                  onChange={(e) => setGlobalQuery(e.target.value)}
                  placeholder="Search cards"
                  style={{ paddingLeft: 36 } as any}
                />
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                {decks.map((d) => {
                  const active = d.id === selectedDeck?.id;
                  const due = d.cards.filter((c) => (c.due ?? 0) <= nowMs()).length;
                  return (
                    <button
                      key={d.id}
                      onClick={() => setState((s) => ({ ...s, selectedDeckId: d.id }))}
                      style={{
                        borderRadius: 16,
                        border: "1px solid rgba(0,0,0,0.12)",
                        padding: 12,
                        background: active ? "rgba(0,0,0,0.05)" : "white",
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 800, lineHeight: 1.2, wordBreak: "break-word" }}>{d.name}</div>
                          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>{d.cards.length} cards</div>
                        </div>
                        <Badge tone={due ? "good" : "neutral"}>{due} due</Badge>
                      </div>
                    </button>
                  );
                })}
              </div>

              {selectedDeck && (
                <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                  <Button variant="secondary" onClick={() => setDeckEditOpen(true)} className="w-full" >
                    <Pencil size={16} /> Edit
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => {
                      const ok = confirm(`Delete deck: ${selectedDeck.name}?`);
                      if (ok) deleteDeck(selectedDeck.id);
                    }}
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              )}
            </div>
          </Card>

          {/* Main */}
          <div style={{ display: "grid", gap: 16 }}>
            {!selectedDeck ? (
              <Card>
                <div style={{ padding: 18, opacity: 0.75 }}>Create a deck to get started.</div>
              </Card>
            ) : (
              <>
                <Card>
                  <div style={{ padding: 18 }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "space-between" }}>
                      <div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                          <div style={{ fontSize: 18, fontWeight: 900 }}>{selectedDeck.name}</div>
                          <Badge>
                            <BookOpen size={14} /> {stats.total} cards
                          </Badge>
                          <Badge tone={stats.due ? "good" : "neutral"}>
                            <Timer size={14} /> {stats.due} due
                          </Badge>
                          <Badge>{stats.mastered} mastered</Badge>
                        </div>
                        <div style={{ marginTop: 6, fontSize: 13, opacity: 0.7, maxWidth: 780 }}>
                          {selectedDeck.description || "Add a description to remind yourself what this deck covers."}
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <Button variant="secondary" onClick={openNewCard}>
                          <Plus size={16} /> Add card
                        </Button>
                        <Button variant="secondary" onClick={() => resetProgress(selectedDeck.id)}>
                          <RotateCcw size={16} /> Reset progress
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Tabs */}
                <Card>
                  <div style={{ padding: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {(["flashcards", "learn", "test", "manage"] as Mode[]).map((m) => (
                      <button
                        key={m}
                        onClick={() => setMode(m)}
                        style={{
                          borderRadius: 999,
                          padding: "8px 12px",
                          border: "1px solid rgba(0,0,0,0.12)",
                          background: mode === m ? "#111827" : "white",
                          color: mode === m ? "white" : "#111827",
                          cursor: "pointer",
                          fontWeight: 800,
                          textTransform: "capitalize",
                        }}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </Card>

                {/* Flashcards */}
                {mode === "flashcards" && (
                  <Card>
                    <div style={{ padding: 18, display: "grid", gap: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, opacity: 0.8 }}>
                            <input
                              type="checkbox"
                              checked={fcShuffle}
                              onChange={(e) => setFcShuffle(e.target.checked)}
                            />
                            Shuffle
                          </label>
                          <Button variant="secondary" onClick={() => setFcShuffle((v) => !v)}>
                            <Shuffle size={16} /> Shuffle now
                          </Button>
                        </div>
                        <div style={{ fontSize: 13, opacity: 0.7 }}>
                          {fcCards.length ? `${fcIndex + 1} of ${fcCards.length}` : "No cards"}
                        </div>
                      </div>

                      {fcCards.length === 0 ? (
                        <div style={{ opacity: 0.75 }}>No cards match your search.</div>
                      ) : (
                        <>
                          <button
                            onClick={() => setFcFlipped((v) => !v)}
                            style={{ border: "none", background: "transparent", padding: 0, cursor: "pointer" }}
                            aria-label="Flip card"
                          >
                            <AnimatePresence mode="wait">
                              <motion.div
                                key={fcFlipped ? "back" : "front"}
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -6 }}
                                transition={{ duration: 0.18 }}
                              >
                                <div
                                  style={{
                                    borderRadius: 16,
                                    border: "1px solid rgba(0,0,0,0.12)",
                                    background: "white",
                                    padding: 28,
                                    minHeight: 220,
                                    display: "grid",
                                    placeItems: "center",
                                    textAlign: "center",
                                  }}
                                >
                                  <div>
                                    <div style={{ fontSize: 12, letterSpacing: 1, opacity: 0.65, textTransform: "uppercase" }}>
                                      {fcFlipped ? "Definition" : "Term"}
                                    </div>
                                    <div style={{ fontSize: 22, fontWeight: 900, marginTop: 10, lineHeight: 1.3 }}>
                                      {fcFlipped ? currentFc.definition : currentFc.term}
                                    </div>
                                    <div style={{ fontSize: 12, opacity: 0.6, marginTop: 18 }}>Click to flip</div>
                                  </div>
                                </div>
                              </motion.div>
                            </AnimatePresence>
                          </button>

                          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                            <Button
                              variant="secondary"
                              disabled={fcIndex <= 0}
                              onClick={() => {
                                setFcIndex((i) => Math.max(0, i - 1));
                                setFcFlipped(false);
                              }}
                            >
                              Prev
                            </Button>
                            <Button variant="secondary" onClick={() => setFcFlipped((v) => !v)}>
                              Flip
                            </Button>
                            <Button
                              disabled={fcIndex >= fcCards.length - 1}
                              onClick={() => {
                                setFcIndex((i) => Math.min(fcCards.length - 1, i + 1));
                                setFcFlipped(false);
                              }}
                            >
                              Next
                            </Button>
                          </div>

                          <div style={{ fontSize: 12, opacity: 0.7 }}>
                            Due: {formatDue(currentFc.due)}
                          </div>
                        </>
                      )}
                    </div>
                  </Card>
                )}

                {/* Learn */}
                {mode === "learn" && (
                  <Card>
                    <div style={{ padding: 18, display: "grid", gap: 12 }}>
                      {!learnSession ? (
                        <>
                          <div style={{ fontSize: 13, opacity: 0.7 }}>
                            Learn uses a simple spaced practice queue. Reveal the answer, then grade yourself.
                          </div>
                          <div>
                            <Button onClick={startLearn}>
                              <BookOpen size={16} /> Start session
                            </Button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                            <div style={{ fontSize: 13, opacity: 0.7 }}>
                              {Math.min(learnSession.idx + 1, learnSession.total)} of {learnSession.total}
                            </div>
                            <Button variant="secondary" onClick={resetLearn}>
                              End session
                            </Button>
                          </div>

                          <ProgressBar value={learnSession.total ? (learnSession.graded / learnSession.total) * 100 : 0} />

                          {learnSession.idx >= learnSession.total ? (
                            <div style={{ borderRadius: 16, border: "1px solid rgba(0,0,0,0.12)", padding: 16, background: "white" }}>
                              <div style={{ fontSize: 18, fontWeight: 900 }}>Session complete</div>
                              <div style={{ fontSize: 13, opacity: 0.7, marginTop: 6 }}>
                                Reviewed {learnSession.graded} cards.
                              </div>
                              <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
                                <Button onClick={startLearn}>Start another</Button>
                                <Button variant="secondary" onClick={resetLearn}>Close</Button>
                              </div>
                            </div>
                          ) : (
                            (() => {
                              const card = learnSession.queue[learnSession.idx];
                              return (
                                <div style={{ borderRadius: 16, border: "1px solid rgba(0,0,0,0.12)", padding: 16, background: "white" }}>
                                  <div style={{ fontSize: 12, letterSpacing: 1, opacity: 0.65, textTransform: "uppercase" }}>
                                    Prompt
                                  </div>
                                  <div style={{ fontSize: 22, fontWeight: 900, marginTop: 10 }}>{card.term}</div>

                                  {!learnSession.flipped ? (
                                    <div style={{ marginTop: 14 }}>
                                      <Button variant="secondary" onClick={() => setLearnSession((ls) => (ls ? { ...ls, flipped: true } : ls))}>
                                        Reveal answer
                                      </Button>
                                    </div>
                                  ) : (
                                    <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                                      <div style={{ fontSize: 12, letterSpacing: 1, opacity: 0.65, textTransform: "uppercase" }}>
                                        Answer
                                      </div>
                                      <div style={{ fontSize: 15, lineHeight: 1.55 }}>{card.definition}</div>

                                      <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
                                        <Button variant="danger" onClick={() => gradeLearn(0)}>Again</Button>
                                        <Button variant="secondary" onClick={() => gradeLearn(1)}>Hard</Button>
                                        <Button variant="secondary" onClick={() => gradeLearn(2)}>Good</Button>
                                        <Button onClick={() => gradeLearn(3)}>Easy</Button>
                                      </div>

                                      <div style={{ fontSize: 12, opacity: 0.7 }}>
                                        Due: {formatDue(card.due)}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })()
                          )}
                        </>
                      )}
                    </div>
                  </Card>
                )}

                {/* Test */}
                {mode === "test" && (
                  <Card>
                    <div style={{ padding: 18, display: "grid", gap: 12 }}>
                      {!testSession ? (
                        <>
                          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr", alignItems: "end" }}>
                            <div>
                              <div style={{ fontSize: 12, opacity: 0.75, fontWeight: 800 }}>Questions</div>
                              <Input
                                type="number"
                                min={1}
                                max={50}
                                value={testConfig.count}
                                onChange={(e) => setTestConfig((c) => ({ ...c, count: Number(e.target.value) }))}
                              />
                            </div>

                            <div>
                              <div style={{ fontSize: 12, opacity: 0.75, fontWeight: 800 }}>Direction</div>
                              <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
                                <Button
                                  variant={testConfig.direction === "term_to_definition" ? "primary" : "secondary"}
                                  onClick={() => setTestConfig((c) => ({ ...c, direction: "term_to_definition" }))}
                                >
                                  Term to definition
                                </Button>
                                <Button
                                  variant={testConfig.direction === "definition_to_term" ? "primary" : "secondary"}
                                  onClick={() => setTestConfig((c) => ({ ...c, direction: "definition_to_term" }))}
                                >
                                  Definition to term
                                </Button>
                              </div>
                            </div>

                            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, opacity: 0.8 }}>
                              <input
                                type="checkbox"
                                checked={testConfig.includeNotDue}
                                onChange={(e) => setTestConfig((c) => ({ ...c, includeNotDue: e.target.checked }))}
                              />
                              Include not due
                            </label>
                          </div>

                          <div>
                            <Button onClick={buildTest}>
                              <Timer size={16} /> Start test
                            </Button>
                          </div>

                          <div style={{ fontSize: 13, opacity: 0.7 }}>
                            Tests generate multiple choice questions from your cards.
                          </div>
                        </>
                      ) : (
                        <>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                            <div style={{ fontSize: 13, opacity: 0.7 }}>
                              Question {testSession.idx + 1} of {testSession.questions.length}
                            </div>
                            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                              <Badge>Score: {testScore.correct}/{testScore.total}</Badge>
                              <Button variant="secondary" onClick={endTest}>End</Button>
                            </div>
                          </div>

                          {(() => {
                            const q = testSession.questions[testSession.idx];
                            if (!q) return null;
                            const answered = q.picked != null;

                            return (
                              <div style={{ borderRadius: 16, border: "1px solid rgba(0,0,0,0.12)", padding: 16, background: "white" }}>
                                <div style={{ fontSize: 12, letterSpacing: 1, opacity: 0.65, textTransform: "uppercase" }}>
                                  Prompt
                                </div>
                                <div style={{ fontSize: 18, fontWeight: 900, marginTop: 10, lineHeight: 1.35 }}>
                                  {q.prompt}
                                </div>

                                <div style={{ display: "grid", gap: 8, marginTop: 14 }}>
                                  {q.options.map((opt) => {
                                    const isPicked = opt === q.picked;
                                    const isCorrect = opt === q.correct;

                                    return (
                                      <button
                                        key={opt}
                                        onClick={() => pickOption(opt)}
                                        disabled={answered}
                                        style={{
                                          borderRadius: 16,
                                          border: "1px solid rgba(0,0,0,0.12)",
                                          padding: 12,
                                          background: isPicked ? "rgba(0,0,0,0.06)" : "white",
                                          textAlign: "left",
                                          cursor: answered ? "not-allowed" : "pointer",
                                        }}
                                      >
                                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                                          <div style={{ lineHeight: 1.45 }}>{opt}</div>
                                          {answered && isCorrect ? <CheckCircle2 size={20} /> : null}
                                          {answered && isPicked && !isCorrect ? <XCircle size={20} /> : null}
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>

                                {answered && (
                                  <div style={{ marginTop: 12, fontSize: 13 }}>
                                    {q.isCorrect ? (
                                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                        <CheckCircle2 size={16} /> Correct
                                      </div>
                                    ) : (
                                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                                        <XCircle size={16} /> Correct answer: <b>{q.correct}</b>
                                      </div>
                                    )}
                                  </div>
                                )}

                                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 14 }}>
                                  <Button variant="secondary" onClick={prevQuestion} disabled={testSession.idx === 0}>
                                    Prev
                                  </Button>
                                  <Button
                                    onClick={() => {
                                      if (!answered) return;
                                      if (testSession.idx === testSession.questions.length - 1) {
                                        setTestSession((ts) => (ts ? { ...ts, finished: true } : ts));
                                      } else nextQuestion();
                                    }}
                                    disabled={!answered}
                                  >
                                    {testSession.idx === testSession.questions.length - 1 ? "Finish" : "Next"}
                                  </Button>
                                </div>
                              </div>
                            );
                          })()}

                          {testSession.finished && (
                            <div style={{ borderRadius: 16, border: "1px solid rgba(0,0,0,0.12)", padding: 16, background: "white" }}>
                              <div style={{ fontSize: 18, fontWeight: 900 }}>Test complete</div>
                              <div style={{ fontSize: 13, opacity: 0.7, marginTop: 6 }}>
                                Score: {testScore.correct} of {testScore.total}
                              </div>
                              <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
                                <Button onClick={buildTest}>Retake</Button>
                                <Button variant="secondary" onClick={endTest}>Close</Button>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </Card>
                )}

                {/* Manage */}
                {mode === "manage" && (
                  <Card>
                    <div style={{ padding: 18, display: "grid", gap: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                        <div style={{ fontSize: 13, opacity: 0.7 }}>
                          Manage cards, edit content, and review scheduling data.
                        </div>
                        <Button variant="secondary" onClick={openNewCard}>
                          <Plus size={16} /> Add card
                        </Button>
                      </div>

                      {filteredCards.length === 0 ? (
                        <div style={{ opacity: 0.75 }}>No cards found.</div>
                      ) : (
                        <div style={{ display: "grid", gap: 10 }}>
                          {filteredCards.map((c) => (
                            <div
                              key={c.id}
                              style={{
                                borderRadius: 16,
                                border: "1px solid rgba(0,0,0,0.12)",
                                padding: 14,
                                background: "white",
                                display: "flex",
                                flexWrap: "wrap",
                                gap: 12,
                                alignItems: "flex-start",
                                justifyContent: "space-between",
                              }}
                            >
                              <div style={{ minWidth: 240, flex: 1 }}>
                                <div style={{ fontWeight: 900, wordBreak: "break-word" }}>{c.term}</div>
                                <div style={{ marginTop: 6, fontSize: 13, opacity: 0.75, wordBreak: "break-word" }}>
                                  {c.definition}
                                </div>
                                <div style={{ marginTop: 10, fontSize: 12, opacity: 0.65, display: "flex", gap: 10, flexWrap: "wrap" }}>
                                  <span>Due: {formatDue(c.due)}</span>
                                  <span>Reps: {c.reps}</span>
                                  <span>Interval: {c.interval}d</span>
                                  <span>EF: {c.ef.toFixed(2)}</span>
                                </div>
                              </div>

                              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                                <Button variant="secondary" onClick={() => openEditCard(c)}>
                                  <Pencil size={16} /> Edit
                                </Button>
                                <Button
                                  variant="danger"
                                  onClick={() => {
                                    const ok = confirm("Delete this card?");
                                    if (ok) deleteCard(selectedDeck.id, c.id);
                                  }}
                                >
                                  <Trash2 size={16} /> Delete
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </Card>
                )}

                <div style={{ fontSize: 12, opacity: 0.65, paddingBottom: 20 }}>
                  Tip: Export regularly so you can back up your decks.
                </div>
              </>
            )}
          </div>
        </div>

        {/* Deck edit modal */}
        <Modal
          open={deckEditOpen}
          title="Edit deck"
          onClose={() => setDeckEditOpen(false)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setDeckEditOpen(false)}>Cancel</Button>
              <Button onClick={saveDeckMeta}>Save</Button>
            </>
          }
        >
          <div>
            <div style={{ fontSize: 12, opacity: 0.75, fontWeight: 800, marginBottom: 6 }}>Name</div>
            <Input value={deckDraft.name} onChange={(e) => setDeckDraft((d) => ({ ...d, name: e.target.value }))} />
          </div>
          <div>
            <div style={{ fontSize: 12, opacity: 0.75, fontWeight: 800, marginBottom: 6 }}>Description</div>
            <Textarea
              value={deckDraft.description}
              onChange={(e) => setDeckDraft((d) => ({ ...d, description: e.target.value }))}
              placeholder="Optional"
            />
          </div>
        </Modal>

        {/* Card modal */}
        <Modal
          open={cardModalOpen}
          title={editingCardId ? "Edit card" : "Add card"}
          onClose={() => setCardModalOpen(false)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setCardModalOpen(false)}>Cancel</Button>
              <Button onClick={saveCard}>{editingCardId ? "Save" : "Add"}</Button>
            </>
          }
        >
          <div>
            <div style={{ fontSize: 12, opacity: 0.75, fontWeight: 800, marginBottom: 6 }}>Term</div>
            <Input value={cardDraft.term} onChange={(e) => setCardDraft((c) => ({ ...c, term: e.target.value }))} />
          </div>
          <div>
            <div style={{ fontSize: 12, opacity: 0.75, fontWeight: 800, marginBottom: 6 }}>Definition</div>
            <Textarea value={cardDraft.definition} onChange={(e) => setCardDraft((c) => ({ ...c, definition: e.target.value }))} />
          </div>
        </Modal>
      </div>
    </div>
  );
}
