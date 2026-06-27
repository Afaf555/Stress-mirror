import { useState, useEffect, useRef } from "react";

/**
 * „Огледало" - проверка на стрес + дневник, инспирирано од HBSC (2021/22).
 * Чува податоци локално (localStorage) за да го следи личниот напредок низ време.
 * Извор на референтните вредности: WHO/HBSC International Report 2021/22.
 */

const QUESTIONS = [
  { id: "anxiety",     label: "Се чувствуваш вознемирен/а или загрижен/а",                 scale: "intensity" },
  { id: "rumination",  label: "Тешко ти е да ги исклучиш мислите и да се смириш",           scale: "intensity" },
  { id: "sadness",     label: "Се чувствуваш тажно или без надеж",                          scale: "intensity" },
  { id: "focus",       label: "Тешко ти е да се концентрираш",                              scale: "intensity" },
  { id: "overwhelm",   label: "Се чувствуваш преоптоварен/а со обврски",                    scale: "intensity" },
  { id: "body",        label: "Стресот го чувствуваш во телото (глава, стомак, напнатост)", scale: "intensity" },
  { id: "sleep",       label: "Колку добро спиеш во последно време",                        scale: "sleep"     },
  { id: "support",     label: "Се чувствуваш поддржано од луѓето околу тебе",               scale: "support"   },
  { id: "lookforward", label: "Имаш нешто на кое со нетрпение чекаш",                       scale: "support"   },
];

const SCALES = {
  intensity: [
    { score: 4, label: "Да" },
    { score: 3, label: "Често" },
    { score: 2, label: "Понекогаш" },
    { score: 1, label: "Ретко" },
    { score: 0, label: "Не" },
  ],
  sleep: [
    { score: 4, label: "Многу лошо" },
    { score: 3, label: "Лошо" },
    { score: 2, label: "Средно" },
    { score: 1, label: "Добро" },
    { score: 0, label: "Одлично" },
  ],
  support: [
    { score: 3, label: "Не" },
    { score: 2, label: "Не баш" },
    { score: 1, label: "Понекогаш" },
    { score: 0, label: "Да" },
  ],
};

// Max score: 6×4 (intensity) + 1×4 (sleep) + 2×3 (support) = 34
const MAX_SCORE = 34;

const AGE_GROUPS = [
  { id: "u16",   label: "под 16" },
  { id: "16-25", label: "16–25"  },
  { id: "26-40", label: "26–40"  },
  { id: "40+",   label: "40+"    },
];

const TEEN_AGES = [11, 13, 15];

const GENDERS = [
  { id: "female", label: "Девојче / Жена"           },
  { id: "male",   label: "Момче / Маж"              },
  { id: "other",  label: "Друго / не сакам да кажам" },
];

const HBSC_REFERENCE = {
  male:   { 11: 26, 13: 31, 15: 36 },
  female: { 11: 39, 13: 50, 15: 61 },
  other:  { 11: 33, 13: 40, 15: 48 },
};

const BANDS = {
  calm: {
    key: "calm",
    title: "Се чувствуваш прилично добро",
    color: "#2FB6A3",
    aura: ["#7be6d3", "#9be8c9"],
    body: "Во моментов покажуваш малку знаци на стрес или анксиозност. Тоа е добар знак — навиките што те смируваат вреди да ги одржуваш.",
  },
  some: {
    key: "some",
    title: "Имаш некои знаци на стрес",
    color: "#7B6CF6",
    aura: ["#a99bff", "#c3b8ff"],
    body: "Чувствуваш одреден притисок — емоционален или ментален. Тоа е сосема вообичаено и не значи дека нешто не е во ред. Но вреди да застанеш и да провериш што ти треба.",
  },
  high: {
    key: "high",
    title: "Носиш доста стрес во моментов",
    color: "#FF8A6B",
    aura: ["#ff9e7d", "#ffc1a3"],
    body: "Многу работи те притискаат сега. Не мораш да го носиш тоа сам/а — разговор со личност на која и веруваш навистина помага. Малите чекори исто така бројат.",
  },
};

function bandFor(stressScore) {
  if (stressScore <= 8)  return BANDS.calm;
  if (stressScore <= 18) return BANDS.some;
  return BANDS.high;
}

const TIPS = {
  calm: [
    "Задржи ги навиките што те смируваат — сон, движење, квалитетно време.",
    "Забележувај што те полни со енергија и враќај се на тоа во полоши денови.",
    "Биди тука и за некој близок — поддршката функционира во двете насоки.",
  ],
  some: [
    "Проба со 4-7-8 дишење (копчето долу-десно) — 4 рунди за помалку од 2 минути.",
    "Запиши во дневникот што те мачи — ставањето мисли на хартија ја намалува тежината.",
    "Намали екрани барем еден час пред спиење за полесно заспивање.",
    "Кажи му на некој на кого му веруваш како се чувствуваш.",
  ],
  high: [
    "Разговарај со родител, наставник, психолог или доктор — тоа не е слабост, туку грижа за себе.",
    "Проба со вежбата за дишење сега (копчето долу-десно) — помага да се смириш за момент.",
    "Раздели го денот на мали чекори; не мора сè одеднаш.",
    "Краток излез или прошетка ја спушта напнатоста во телото.",
    "Чувај го сонот — заспивање во слично време секој ден навистина помага.",
  ],
};

const MOOD_OPTIONS = [
  { value: 0, emoji: "😔", label: "Тажно" },
  { value: 1, emoji: "😟", label: "Вознемирено" },
  { value: 2, emoji: "😐", label: "Неутрално" },
  { value: 3, emoji: "🙂", label: "Добро" },
  { value: 4, emoji: "😊", label: "Одлично" },
];

const ENERGY_OPTIONS = [
  { value: 0, label: "Исцрпено" },
  { value: 1, label: "Уморно" },
  { value: 2, label: "Средно" },
  { value: 3, label: "Добро" },
  { value: 4, label: "Полно" },
];

const BREATHE_PHASES = [
  { label: "Вдиши",  duration: 4000, scale: 1.6, count: "up"   },
  { label: "Задржи", duration: 7000, scale: 1.6, count: "down" },
  { label: "Издиши", duration: 8000, scale: 1.0, count: "down" },
];
const BREATHE_ROUNDS = 4;

// --- локално чување податоци ---
const CHECKS_KEY = "ogledalo:checks:v1";
const JOURNAL_KEY = "ogledalo:journal:v1";

function loadJSON(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function saveJSON(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* приватен режим или недостапен localStorage - апликацијата работи и без чување */
  }
}

function fmtDate(d) {
  const x = new Date(d);
  const p = (n) => String(n).padStart(2, "0");
  return `${p(x.getDate())}.${p(x.getMonth() + 1)}.${x.getFullYear()}`;
}
function fmtDateTime(d) {
  const x = new Date(d);
  const p = (n) => String(n).padStart(2, "0");
  return `${fmtDate(d)} · ${p(x.getHours())}:${p(x.getMinutes())}`;
}

function computeResult(answers, ageGroup, gender, exactAge) {
  const stressScore = QUESTIONS.reduce((s, q) => s + (answers[q.id] ?? 0), 0);
  const band = bandFor(stressScore);
  const pct = Math.round((stressScore / MAX_SCORE) * 100);
  let peerPct = null;
  if (ageGroup === "u16" && gender && exactAge) {
    peerPct = HBSC_REFERENCE[gender]?.[exactAge] ?? null;
  }
  return { stressScore, pct, band, peerPct };
}

export default function App() {
  const [stage, setStage] = useState("intro"); // intro | quiz | mood | result | history
  const [ageGroup, setAgeGroup] = useState(null);
  const [exactAge, setExactAge] = useState(null);
  const [gender, setGender] = useState(null);
  const [mood, setMood] = useState(null);
  const [energy, setEnergy] = useState(null);
  const [answers, setAnswers] = useState({});
  const [step, setStep] = useState(0);

  const [checks, setChecks] = useState(() => loadJSON(CHECKS_KEY, []));
  const [journal, setJournal] = useState(() => loadJSON(JOURNAL_KEY, []));
  const [lastResult, setLastResult] = useState(null);
  const [prevCheck, setPrevCheck] = useState(null);
  const [showBreathe, setShowBreathe] = useState(false);
  const [showJournal, setShowJournal] = useState(false);

  const topRef = useRef(null);

  const reduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (topRef.current) topRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [stage, step]);

  function persistChecks(next) {
    setChecks(next);
    saveJSON(CHECKS_KEY, next);
  }
  function persistJournal(next) {
    setJournal(next);
    saveJSON(JOURNAL_KEY, next);
  }

  function finishQuiz() {
    const result = computeResult(answers, ageGroup, gender, exactAge);
    const previous = checks.length ? checks[checks.length - 1] : null;
    const entry = {
      id: Date.now(),
      date: new Date().toISOString(),
      stressScore: result.stressScore,
      bandKey: result.band.key,
      ageGroup,
      gender,
      mood,
      energy,
    };
    persistChecks([...checks, entry]);
    setPrevCheck(previous);
    setLastResult(result);
    setStage("result");
  }

  function addJournal(text) {
    if (!text.trim()) return;
    const entry = {
      id: Date.now(),
      date: new Date().toISOString(),
      text: text.trim(),
    };
    persistJournal([entry, ...journal]);
  }
  function deleteJournal(id) {
    persistJournal(journal.filter((j) => j.id !== id));
  }
  function clearAll() {
    persistChecks([]);
    persistJournal([]);
  }

  function startNew() {
    setAnswers({});
    setStep(0);
    setAgeGroup(null);
    setExactAge(null);
    setGender(null);
    setMood(null);
    setEnergy(null);
    setStage("intro");
  }

  return (
    <div className="og-root" ref={topRef}>
      <style>{css}</style>
      <div className={`og-aura ${reduceMotion ? "still" : ""}`} aria-hidden="true">
        <span className="blob b1" />
        <span className="blob b2" />
        <span className="blob b3" />
      </div>

      <main className="og-shell">
        <header className="og-head">
          <div className="og-mark">
            <span className="og-dot" />
            Огледало
          </div>
          <p className="og-sub">проверка на стрес · дневник · инспирирано од HBSC</p>
        </header>

        {stage === "intro" && (
          <Intro
            ageGroup={ageGroup}
            exactAge={exactAge}
            gender={gender}
            setAgeGroup={setAgeGroup}
            setExactAge={setExactAge}
            setGender={setGender}
            onStart={() => setStage("quiz")}
            historyCount={checks.length}
            journalCount={journal.length}
            onHistory={() => setStage("history")}
          />
        )}

        {stage === "quiz" && (
          <Quiz
            step={step}
            setStep={setStep}
            answers={answers}
            setAnswers={setAnswers}
            onFinish={() => setStage("mood")}
          />
        )}

        {stage === "mood" && (
          <MoodEnergyPicker
            mood={mood}
            setMood={setMood}
            energy={energy}
            setEnergy={setEnergy}
            onDone={finishQuiz}
            onSkip={() => { setMood(null); setEnergy(null); finishQuiz(); }}
          />
        )}

        {stage === "result" && (
          <Result
            result={lastResult}
            prevCheck={prevCheck}
            ageGroup={ageGroup}
            exactAge={exactAge}
            gender={gender}
            onAddJournal={addJournal}
            onReset={startNew}
            onHistory={() => setStage("history")}
          />
        )}

        {stage === "history" && (
          <History
            checks={checks}
            journal={journal}
            onAddJournal={addJournal}
            onDeleteJournal={deleteJournal}
            onClearAll={clearAll}
            onBack={() => setStage("intro")}
          />
        )}

        <footer className="og-foot">
          Ова е алатка за самосвест, не медицинска дијагноза. Податоците се чуваат само на твојот
          уред и не се испраќаат никаде. Ако често се чувствуваш лошо, разговор со возрасен на кого
          му веруваш, со училишен психолог или доктор може да помогне.
        </footer>
      </main>
      <FloatingButtons
        onBreathe={() => setShowBreathe(true)}
        onJournal={() => setShowJournal(true)}
      />
      {showBreathe && (
        <BreatheOverlay
          onClose={() => setShowBreathe(false)}
          reduceMotion={reduceMotion}
        />
      )}
      {showJournal && (
        <JournalOverlay
          journal={journal}
          onAddJournal={addJournal}
          onDeleteJournal={deleteJournal}
          onClose={() => setShowJournal(false)}
        />
      )}
    </div>
  );
}

function Intro({ ageGroup, exactAge, gender, setAgeGroup, setExactAge, setGender, onStart, historyCount, journalCount, onHistory }) {
  const ready = ageGroup && gender;
  return (
    <section className="og-card og-intro">
      <h1 className="og-title">
        Како ти е <em>навистина</em> овие денови?
      </h1>
      <p className="og-lead">
        Девет кратки прашања за тоа како се чувствуваш ментално и емоционално во последно
        време. На крај ќе добиеш порака, споредба со врсници (ако си под 16) и совети прилагодени на тебе.
      </p>
      <p className="og-privacy">Се чува само на твојот уред. Ништо не се испраќа.</p>

      {(historyCount > 0 || journalCount > 0) && (
        <button className="og-recall" onClick={onHistory}>
          <span>
            Имаш {historyCount} {historyCount === 1 ? "проверка" : "проверки"}
            {journalCount > 0 ? ` · ${journalCount} запис${journalCount === 1 ? "" : "и"} во дневник` : ""}
          </span>
          <span className="og-recall-go">Види →</span>
        </button>
      )}

      <div className="og-field">
        <span className="og-flabel">Колку години имаш?</span>
        <div className="og-chips">
          {AGE_GROUPS.map((a) => (
            <button key={a.id} className={`og-chip ${ageGroup === a.id ? "on" : ""}`} onClick={() => { setAgeGroup(a.id); setExactAge(null); }}>
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {ageGroup === "u16" && (
        <div className="og-field">
          <span className="og-flabel">Поточно (за споредба со врсници):</span>
          <div className="og-chips">
            {TEEN_AGES.map((a) => (
              <button key={a} className={`og-chip ${exactAge === a ? "on" : ""}`} onClick={() => setExactAge(a)}>
                {a}{a === 15 ? "+" : ""}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="og-field">
        <span className="og-flabel">Се идентификуваш како...</span>
        <div className="og-chips">
          {GENDERS.map((g) => (
            <button
              key={g.id}
              className={`og-chip wide ${gender === g.id ? "on" : ""}`}
              onClick={() => setGender(g.id)}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      <button className="og-cta" disabled={!ready} onClick={onStart}>
        {ready ? "Почни" : "Избери возраст и опција за да продолжиш"}
      </button>
    </section>
  );
}

function Quiz({ step, setStep, answers, setAnswers, onFinish }) {
  const q = QUESTIONS[step];
  const scale = SCALES[q.scale];
  const current = answers[q.id];
  const isLast = step === QUESTIONS.length - 1;
  const allAnswered = QUESTIONS.every((x) => answers[x.id] !== undefined);
  const timerRef = useRef(null);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  function pick(score) {
    setAnswers((prev) => ({ ...prev, [q.id]: score }));
    if (!isLast) {
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setStep(step + 1), 220);
    }
  }

  return (
    <section className="og-card og-quiz">
      <div className="og-progress">
        <div className="og-track">
          <div className="og-fill" style={{ width: `${((step + 1) / QUESTIONS.length) * 100}%` }} />
        </div>
        <span className="og-count">{step + 1} / {QUESTIONS.length}</span>
      </div>

      <p className="og-qlead">Колку ти одговара следново...</p>
      <h2 className="og-question">{q.label}</h2>

      <div className="og-scale">
        {scale.map((opt) => (
          <button
            key={opt.score}
            className={`og-opt ${current === opt.score ? "on" : ""}`}
            onClick={() => pick(opt.score)}
          >
            <span className="og-opt-dot" />
            {opt.label}
          </button>
        ))}
      </div>

      <div className="og-navrow">
        <button className="og-ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>
          Назад
        </button>
        {isLast ? (
          <button className="og-cta slim" disabled={!allAnswered} onClick={onFinish}>
            Следно
          </button>
        ) : (
          <button className="og-ghost" disabled={current === undefined} onClick={() => setStep(step + 1)}>
            Следно
          </button>
        )}
      </div>
    </section>
  );
}

function MoodEnergyPicker({ mood, setMood, energy, setEnergy, onDone, onSkip }) {
  const ready = mood !== null && energy !== null;
  return (
    <section className="og-card og-mood">
      <h2 className="og-title" style={{ fontSize: 24 }}>Уште две прашања...</h2>
      <p className="og-lead">Необврзувачки — ако сакаш да го прескокнеш, тоа е сосема во ред.</p>

      <div className="og-field">
        <span className="og-flabel">Расположение во моментов</span>
        <div className="og-mood-row">
          {MOOD_OPTIONS.map((o) => (
            <button
              key={o.value}
              className={`og-mood-btn ${mood === o.value ? "on" : ""}`}
              onClick={() => setMood(o.value)}
              aria-label={o.label}
            >
              <span className="og-mood-emoji">{o.emoji}</span>
              <span className="og-mood-label">{o.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="og-field">
        <span className="og-flabel">Ниво на енергија</span>
        <div className="og-chips">
          {ENERGY_OPTIONS.map((o) => (
            <button
              key={o.value}
              className={`og-chip ${energy === o.value ? "on" : ""}`}
              onClick={() => setEnergy(o.value)}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="og-navrow">
        <button className="og-ghost" onClick={onSkip}>Прескокни</button>
        <button className="og-cta slim" disabled={!ready} onClick={onDone}>
          Види резултат
        </button>
      </div>
    </section>
  );
}

function DeltaCard({ result, prevCheck }) {
  if (!prevCheck) {
    return (
      <div className="og-delta neutral">
        Ова е твојата прва проверка. Од следниот пат ќе гледаш како се менуваш низ времето.
      </div>
    );
  }
  const diff = result.stressScore - (prevCheck.stressScore ?? (prevCheck.frequentCount ?? 0) * 3);
  const when = fmtDate(prevCheck.date);
  if (diff < 0) {
    return (
      <div className="og-delta better">
        🌤️ Денес носиш помалку стрес отколку на {when}. Добро е — продолжи така.
      </div>
    );
  }
  if (diff > 0) {
    return (
      <div className="og-delta worse">
        Денес ти е малку потешко отколку на {when}. Потешки денови се случуваат — биди нежен/на со себе.
      </div>
    );
  }
  return (
    <div className="og-delta neutral">
      Слично како на {when}. Стабилно е сосема во ред.
    </div>
  );
}

function Result({ result, prevCheck, ageGroup, exactAge, gender, onAddJournal, onReset, onHistory }) {
  const { stressScore, pct, band, peerPct } = result;
  const genderLabel = GENDERS.find((g) => g.id === gender)?.label.toLowerCase();
  const youAbove = peerPct !== null && pct > peerPct;

  return (
    <section className="og-card og-result">
      <Gauge value={stressScore} max={MAX_SCORE} color={band.color} aura={band.aura} />

      <h2 className="og-rtitle" style={{ color: band.color }}>{band.title}</h2>
      <p className="og-rbody">{band.body}</p>
      <p className="og-rmeta">
        Твојот резултат: <strong style={{ color: band.color }}>{pct}%</strong> од максималниот стрес-показател.
      </p>

      <DeltaCard result={result} prevCheck={prevCheck} />

      {peerPct !== null && (
        <div className="og-compare">
          <h3 className="og-csub">Споредба со врсници (HBSC)</h3>
          <p className="og-cnote">
            Кај HBSC, околу <strong>{peerPct}%</strong> од младите на {exactAge} год. ({genderLabel})
            пријавуваат висок стрес.
          </p>
          <CompareBar label="HBSC просек (твоја група)" pct={peerPct} color="#A99BFF" />
          <CompareBar label="Твој резултат" pct={pct} color={band.color} emphasis />
          <p className="og-cverdict">
            {youAbove
              ? "Во моментов носиш повеќе стрес од просекот за твојата група — добро е што го забележа."
              : "Во моментов си околу или под просекот за твојата група."}
          </p>
        </div>
      )}

      <div className="og-tips">
        <h3 className="og-csub">Што може да помогне</h3>
        <ul>
          {TIPS[band.key].map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      </div>

      <JournalComposer
        title="Сакаш да запишеш како се чувствуваш?"
        placeholder="Пиши слободно  само за тебе е..."
        onSave={onAddJournal}
      />

      <div className="og-navrow">
        <button className="og-ghost" onClick={onHistory}>Дневник и напредок</button>
        <button className="og-cta slim" onClick={onReset}>Нова проверка</button>
      </div>
    </section>
  );
}

function History({ checks, journal, onAddJournal, onDeleteJournal, onClearAll, onBack }) {
  const [confirming, setConfirming] = useState(false);
  const recent = checks.slice(-12);

  return (
    <section className="og-card og-history">
      <div className="og-navrow tight">
        <button className="og-ghost" onClick={onBack}>← Назад</button>
        <h2 className="og-htitle">Дневник и напредок</h2>
      </div>

      <h3 className="og-csub">Твојот тренд</h3>
      {checks.length === 0 ? (
        <p className="og-empty">Сè уште нема проверки. Направи една за да почнеш да го следиш напредокот.</p>
      ) : (
        <>
          <p className="og-cnote">Твојот стрес-показател по проверка. <strong>Пониско = подобро.</strong></p>
          <Sparkline data={recent} />
          <div className="og-checklist">
            {checks.slice().reverse().map((c) => {
              const score = c.stressScore ?? (c.frequentCount ?? 0) * 3;
              const pct = Math.round((score / MAX_SCORE) * 100);
              return (
                <div className="og-checkrow" key={c.id}>
                  <span className={`og-checkdot band-${c.bandKey}`} />
                  <span className="og-checkdate">{fmtDateTime(c.date)}</span>
                  <span className="og-checkval">
                    {pct}%
                    {c.mood != null && (
                      <span className="og-check-mood" title={MOOD_OPTIONS[c.mood]?.label}>
                        {" "}{MOOD_OPTIONS[c.mood]?.emoji}
                      </span>
                    )}
                    {c.energy != null && (
                      <span className="og-check-energy" title={ENERGY_OPTIONS[c.energy]?.label}>
                        ⚡{ENERGY_OPTIONS[c.energy]?.label}
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}

      <div className="og-jsection">
        <h3 className="og-csub">Дневник</h3>
        <JournalComposer
          title=""
          placeholder="Нов запис - како помина денот?"
          onSave={onAddJournal}
        />
        {journal.length === 0 ? (
          <p className="og-empty">Нема записи сè уште. Пиши кога ти треба простор за мислите.</p>
        ) : (
          <div className="og-jlist">
            {journal.map((j) => (
              <div className="og-jentry" key={j.id}>
                <div className="og-jtop">
                  <span className="og-jdate">{fmtDateTime(j.date)}</span>
                  <button className="og-jdel" onClick={() => onDeleteJournal(j.id)} aria-label="Избриши запис">✕</button>
                </div>
                <p className="og-jtext">{j.text}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {(checks.length > 0 || journal.length > 0) && (
        <div className="og-danger">
          {confirming ? (
            <div className="og-confirm">
              <span>Да ги избришам сите проверки и записи? Ова не може да се врати.</span>
              <div className="og-confirm-btns">
                <button className="og-ghost" onClick={() => setConfirming(false)}>Откажи</button>
                <button className="og-del-btn" onClick={() => { onClearAll(); setConfirming(false); }}>
                  Избриши сè
                </button>
              </div>
            </div>
          ) : (
            <button className="og-ghost danger" onClick={() => setConfirming(true)}>
              Избриши ги сите податоци
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function JournalComposer({ title, placeholder, onSave, dark }) {
  const [text, setText] = useState("");
  const [saved, setSaved] = useState(false);

  function save() {
    if (!text.trim()) return;
    onSave(text);
    setText("");
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  return (
    <div className="og-composer">
      {title && <h3 className="og-csub" style={dark ? { color: "#fff" } : {}}>{title}</h3>}
      <textarea
        className={`og-textarea${dark ? " dark" : ""}`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        rows={3}
      />
      <div className="og-composer-row">
        {saved && <span className="og-saved">Зачувано ✓</span>}
        <button className="og-cta slim" disabled={!text.trim()} onClick={save}>
          Зачувај запис
        </button>
      </div>
    </div>
  );
}

function Sparkline({ data }) {
  const w = 100, h = 40, pad = 4;
  if (data.length < 2) {
    return <p className="og-cnote" style={{ marginTop: -4 }}>Потребни се барем две проверки за линија на трендот.</p>;
  }
  const stepX = (w - pad * 2) / (data.length - 1);
  const pts = data.map((d, i) => {
    const score = d.stressScore ?? (d.frequentCount ?? 0) * 3;
    const x = pad + i * stepX;
    const y = pad + (score / MAX_SCORE) * (h - pad * 2);
    return [x, y];
  });
  const line = pts.map((p) => p.join(",")).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="og-spark" preserveAspectRatio="none">
      <polyline points={line} className="og-spark-line" />
      {pts.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r="1.8" className={`og-spark-dot band-${data[i].bandKey}`} />
      ))}
    </svg>
  );
}

function Gauge({ value, max, color, aura }) {
  const r = 78;
  const c = 2 * Math.PI * r;
  const dash = c * (value / max);
  return (
    <div className="og-gauge">
      <div
        className="og-gauge-aura"
        style={{ background: `radial-gradient(circle, ${aura[0]} 0%, ${aura[1]}00 70%)` }}
      />
      <svg viewBox="0 0 200 200" className="og-gauge-svg">
        <circle cx="100" cy="100" r={r} className="og-gauge-bg" />
        <circle
          cx="100" cy="100" r={r} className="og-gauge-fg"
          stroke={color} strokeDasharray={`${dash} ${c}`} strokeLinecap="round"
          transform="rotate(-90 100 100)"
        />
      </svg>
      <div className="og-gauge-center">
        <span className="og-gauge-num" style={{ color }}>{value}</span>
        <span className="og-gauge-den">/ {max} чести</span>
      </div>
    </div>
  );
}

function CompareBar({ label, pct, color, emphasis }) {
  return (
    <div className={`og-bar ${emphasis ? "em" : ""}`}>
      <div className="og-bar-top">
        <span>{label}</span>
        <span className="og-bar-val">{pct}%</span>
      </div>
      <div className="og-bar-track">
        <div className="og-bar-fill" style={{ width: `${Math.min(pct, 100)}%`, background: color }} />
      </div>
    </div>
  );
}

function BreatheOverlay({ onClose, reduceMotion }) {
  const [round, setRound] = useState(1);
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [done, setDone] = useState(false);
  const [tick, setTick] = useState(0);
  const [active, setActive] = useState(false);
  const phase = BREATHE_PHASES[phaseIdx];

  // delay first animation so the browser paints scale(1) before growing
  useEffect(() => {
    const id = setTimeout(() => setActive(true), 50);
    return () => clearTimeout(id);
  }, []);

  // phase timer
  useEffect(() => {
    if (done) return;
    const timer = setTimeout(() => {
      const nextPhase = (phaseIdx + 1) % BREATHE_PHASES.length;
      if (nextPhase === 0) {
        if (round >= BREATHE_ROUNDS) { setDone(true); return; }
        setRound((r) => r + 1);
      }
      setPhaseIdx(nextPhase);
    }, phase.duration);
    return () => clearTimeout(timer);
  }, [phaseIdx, round, done, phase.duration]);

  // per-second tick, resets on each phase change
  useEffect(() => {
    setTick(0);
    if (done) return;
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [phaseIdx, done]);

  const totalSecs = phase.duration / 1000;
  const displayCount = phase.count === "up"
    ? Math.min(tick + 1, totalSecs)
    : Math.max(totalSecs - tick, 1);

  const circleStyle = reduceMotion
    ? {}
    : active
      ? { transform: `scale(${phase.scale})`, transition: `transform ${phase.duration}ms ease-in-out` }
      : { transform: "scale(1)", transition: "none" };

  return (
    <div className="og-overlay" role="dialog" aria-modal="true" aria-label="Вежба за дишење">
      <button className="og-overlay-close" onClick={onClose} aria-label="Затвори">✕</button>
      {done ? (
        <div className="og-breathe-done">
          <p className="og-breathe-msg">Убаво направено 🌿</p>
          <p className="og-breathe-sub">4 рунди завршени. Земи момент да почувствуваш разлика.</p>
          <button className="og-cta slim" onClick={onClose} style={{ marginTop: 24 }}>Затвори</button>
        </div>
      ) : (
        <>
          <p className="og-breathe-round">Рунда {round} / {BREATHE_ROUNDS}</p>
          <div className="og-breathe-ring">
            <div className="og-breathe-circle" style={circleStyle} />
          </div>
          <p className="og-breathe-phase">{phase.label}</p>
          <p className="og-breathe-count">{displayCount}с</p>
          {reduceMotion && <p className="og-breathe-sub">Вдиши 4с · Задржи 7с · Издиши 8с</p>}
        </>
      )}
    </div>
  );
}

function JournalOverlay({ journal, onAddJournal, onDeleteJournal, onClose }) {
  return (
    <div className="og-overlay og-journal-overlay" role="dialog" aria-modal="true" aria-label="Дневник">
      <button className="og-overlay-close" onClick={onClose} aria-label="Затвори">✕</button>
      <div className="og-journal-inner">
        <h2 className="og-htitle" style={{ color: "#fff", marginBottom: 20 }}>Дневник</h2>
        <JournalComposer title="" placeholder="Нов запис — пиши слободно..." onSave={onAddJournal} dark />
        {journal.length === 0 ? (
          <p className="og-empty" style={{ color: "rgba(255,255,255,.5)", marginTop: 16 }}>
            Нема записи сè уште.
          </p>
        ) : (
          <div className="og-jlist" style={{ marginTop: 16 }}>
            {journal.map((j) => (
              <div className="og-jentry og-jentry-dark" key={j.id}>
                <div className="og-jtop">
                  <span className="og-jdate">{fmtDateTime(j.date)}</span>
                  <button className="og-jdel" onClick={() => onDeleteJournal(j.id)} aria-label="Избриши запис">✕</button>
                </div>
                <p className="og-jtext">{j.text}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FloatingButtons({ onBreathe, onJournal }) {
  return (
    <div className="og-fab-group" aria-label="Брзи алатки">
      <button className="og-fab" onClick={onBreathe} aria-label="Вежба за дишење" title="Вежба за дишење">
        <span className="og-fab-icon">🫁</span>
      </button>
      <button className="og-fab" onClick={onJournal} aria-label="Дневник" title="Дневник">
        <span className="og-fab-icon">✏️</span>
      </button>
    </div>
  );
}

const css = `
@import url('https://fonts.googleapis.com/css2?family=Quicksand:wght@500;600;700&family=Inter:wght@400;500;600&display=swap');

.og-root{
  --bg:#F4F2FB; --ink:#2B2840; --muted:#6E6A89;
  --violet:#7B6CF6; --violet-soft:#A99BFF; --teal:#2FB6A3; --peach:#FF8A6B;
  --card:rgba(255,255,255,0.72); --line:rgba(43,40,64,0.10);
  position:relative; min-height:100vh; width:100%;
  background:var(--bg); color:var(--ink);
  font-family:'Inter',system-ui,sans-serif;
  overflow-x:hidden; display:flex; justify-content:center;
}
.og-root *{box-sizing:border-box;}

.og-aura{position:fixed; inset:0; z-index:0; filter:blur(60px); opacity:.7;}
.og-aura .blob{position:absolute; border-radius:50%;}
.b1{width:46vw; height:46vw; left:-8vw; top:-6vw; background:var(--violet-soft); animation:drift1 18s ease-in-out infinite;}
.b2{width:40vw; height:40vw; right:-10vw; top:10vh; background:#9be8d8; animation:drift2 22s ease-in-out infinite;}
.b3{width:38vw; height:38vw; left:20vw; bottom:-12vw; background:#ffc1a3; animation:drift3 26s ease-in-out infinite;}
@keyframes drift1{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(4vw,3vh) scale(1.12)}}
@keyframes drift2{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(-3vw,4vh) scale(1.08)}}
@keyframes drift3{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(2vw,-3vh) scale(1.1)}}
.og-aura.still .blob{animation:none;}
@media (prefers-reduced-motion: reduce){.og-aura .blob{animation:none;}}

.og-shell{position:relative; z-index:1; width:100%; max-width:620px; padding:32px 20px 48px;}
.og-head{text-align:center; margin-bottom:22px;}
.og-mark{font-family:'Quicksand',sans-serif; font-weight:700; font-size:26px; letter-spacing:.3px; display:inline-flex; align-items:center; gap:9px;}
.og-dot{width:13px; height:13px; border-radius:50%; background:linear-gradient(135deg,var(--violet),var(--teal)); display:inline-block; box-shadow:0 0 0 5px rgba(123,108,246,.14);}
.og-sub{margin:6px 0 0; color:var(--muted); font-size:13px; letter-spacing:.4px;}

.og-card{background:var(--card); backdrop-filter:blur(14px); border:1px solid rgba(255,255,255,.6); border-radius:28px; padding:30px 26px; box-shadow:0 18px 50px -22px rgba(43,40,64,.45); animation:rise .5s cubic-bezier(.2,.8,.2,1);}
@keyframes rise{from{opacity:0; transform:translateY(14px)}to{opacity:1; transform:none}}

.og-title{font-family:'Quicksand',sans-serif; font-weight:700; font-size:30px; line-height:1.18; margin:0 0 14px;}
.og-title em{font-style:normal; color:var(--violet);}
.og-lead{color:var(--muted); font-size:16px; line-height:1.55; margin:0 0 12px;}
.og-privacy{font-size:13px; color:var(--teal); font-weight:600; margin:0 0 18px;}

.og-recall{width:100%; display:flex; align-items:center; justify-content:space-between; gap:10px; text-align:left; background:rgba(123,108,246,.10); border:1px solid rgba(123,108,246,.18); color:var(--ink); border-radius:16px; padding:13px 16px; cursor:pointer; font-size:14px; font-weight:600; margin-bottom:22px; transition:.16s;}
.og-recall:hover{background:rgba(123,108,246,.16);}
.og-recall-go{color:var(--violet); font-family:'Quicksand',sans-serif; white-space:nowrap;}

.og-field{margin-bottom:20px;}
.og-flabel{display:block; font-family:'Quicksand',sans-serif; font-weight:600; font-size:15px; margin-bottom:10px;}
.og-chips{display:flex; flex-wrap:wrap; gap:10px;}
.og-chip{font-family:'Quicksand',sans-serif; font-weight:600; font-size:16px; border:1.5px solid var(--line); background:rgba(255,255,255,.55); color:var(--ink); border-radius:16px; padding:12px 18px; cursor:pointer; transition:.18s; min-width:60px;}
.og-chip.wide{flex:1; min-width:130px;}
.og-chip:hover{border-color:var(--violet-soft);}
.og-chip.on{background:var(--violet); color:#fff; border-color:var(--violet); box-shadow:0 8px 20px -8px var(--violet);}

.og-cta{width:100%; margin-top:8px; font-family:'Quicksand',sans-serif; font-weight:700; font-size:17px; color:#fff; border:none; cursor:pointer; background:linear-gradient(135deg,var(--violet),#9b6cf6); border-radius:18px; padding:16px; transition:.2s; box-shadow:0 12px 28px -12px var(--violet);}
.og-cta.slim{padding:13px 22px; width:auto; font-size:15px;}
.og-cta:hover:not(:disabled){transform:translateY(-2px);}
.og-cta:disabled{background:#d9d5ec; color:#9a96b3; cursor:not-allowed; box-shadow:none;}

.og-progress{display:flex; align-items:center; gap:12px; margin-bottom:24px;}
.og-track{flex:1; height:8px; background:rgba(43,40,64,.08); border-radius:99px; overflow:hidden;}
.og-fill{height:100%; background:linear-gradient(90deg,var(--violet),var(--teal)); border-radius:99px; transition:width .35s cubic-bezier(.2,.8,.2,1);}
.og-count{font-family:'Quicksand',sans-serif; font-weight:600; font-size:13px; color:var(--muted);}
.og-qlead{color:var(--muted); font-size:14px; margin:0 0 6px;}
.og-question{font-family:'Quicksand',sans-serif; font-weight:700; font-size:26px; margin:0 0 22px;}
.og-scale{display:flex; flex-direction:column; gap:10px;}
.og-opt{display:flex; align-items:center; gap:13px; text-align:left; font-family:'Inter',sans-serif; font-weight:500; font-size:15.5px; color:var(--ink); border:1.5px solid var(--line); background:rgba(255,255,255,.55); border-radius:15px; padding:14px 16px; cursor:pointer; transition:.16s;}
.og-opt:hover{border-color:var(--violet-soft); transform:translateX(3px);}
.og-opt-dot{width:16px; height:16px; border-radius:50%; border:2px solid var(--line); flex-shrink:0; transition:.16s;}
.og-opt.on{border-color:var(--violet); background:rgba(123,108,246,.10);}
.og-opt.on .og-opt-dot{background:var(--violet); border-color:var(--violet); box-shadow:0 0 0 4px rgba(123,108,246,.18);}

.og-navrow{display:flex; justify-content:space-between; align-items:center; gap:12px; margin-top:24px;}
.og-navrow.tight{margin-top:0; margin-bottom:18px; justify-content:flex-start; gap:14px;}
.og-ghost{font-family:'Quicksand',sans-serif; font-weight:600; font-size:15px; background:none; border:1.5px solid var(--line); color:var(--ink); border-radius:14px; padding:11px 18px; cursor:pointer; transition:.16s;}
.og-ghost:hover:not(:disabled){border-color:var(--violet-soft);}
.og-ghost:disabled{opacity:.35; cursor:not-allowed;}
.og-ghost.danger{color:#d4654a; border-color:rgba(212,101,74,.35);}
.og-ghost.danger:hover{border-color:#d4654a;}

.og-result{text-align:center;}
.og-gauge{position:relative; width:200px; height:200px; margin:4px auto 8px;}
.og-gauge-aura{position:absolute; inset:-14px; border-radius:50%; opacity:.5; filter:blur(14px);}
.og-gauge-svg{position:relative; width:200px; height:200px;}
.og-gauge-bg{fill:none; stroke:rgba(43,40,64,.08); stroke-width:14;}
.og-gauge-fg{fill:none; stroke-width:14; transition:stroke-dasharray 1s cubic-bezier(.2,.8,.2,1);}
.og-gauge-center{position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center;}
.og-gauge-num{font-family:'Quicksand',sans-serif; font-weight:700; font-size:54px; line-height:1;}
.og-gauge-den{font-size:13px; color:var(--muted); margin-top:2px;}
.og-rtitle{font-family:'Quicksand',sans-serif; font-weight:700; font-size:25px; margin:10px 0 8px;}
.og-rbody{color:var(--ink); font-size:16px; line-height:1.55; margin:0 0 8px;}
.og-rmeta{color:var(--muted); font-size:13.5px; margin:0 0 4px;}

.og-delta{text-align:left; font-size:14.5px; line-height:1.5; padding:14px 16px; border-radius:16px; margin-top:16px;}
.og-delta.better{background:rgba(47,182,163,.12); color:#1c7a6d;}
.og-delta.worse{background:rgba(255,138,107,.13); color:#b85537;}
.og-delta.neutral{background:rgba(123,108,246,.10); color:#5a4fb0;}

.og-compare{text-align:left; margin-top:22px; padding-top:22px; border-top:1px solid var(--line);}
.og-csub{font-family:'Quicksand',sans-serif; font-weight:700; font-size:18px; margin:0 0 10px;}
.og-cnote{color:var(--muted); font-size:14.5px; line-height:1.5; margin:0 0 16px;}
.og-cnote strong{color:var(--violet);}
.og-bar{margin-bottom:14px;}
.og-bar-top{display:flex; justify-content:space-between; font-size:13.5px; font-weight:600; margin-bottom:6px;}
.og-bar.em .og-bar-top{font-family:'Quicksand',sans-serif; font-size:15px;}
.og-bar-val{font-family:'Quicksand',sans-serif;}
.og-bar-track{height:14px; background:rgba(43,40,64,.07); border-radius:99px; overflow:hidden;}
.og-bar-fill{height:100%; border-radius:99px; transition:width 1s cubic-bezier(.2,.8,.2,1);}
.og-cverdict{font-size:14px; color:var(--ink); line-height:1.5; margin:14px 0 0; background:rgba(123,108,246,.08); padding:12px 14px; border-radius:14px;}

.og-tips{text-align:left; margin-top:22px; padding-top:22px; border-top:1px solid var(--line);}
.og-tips ul{margin:0; padding:0; list-style:none; display:flex; flex-direction:column; gap:11px;}
.og-tips li{position:relative; padding-left:26px; font-size:15px; line-height:1.5; color:var(--ink);}
.og-tips li::before{content:""; position:absolute; left:4px; top:7px; width:9px; height:9px; border-radius:50%; background:linear-gradient(135deg,var(--violet),var(--teal));}

.og-composer{text-align:left; margin-top:22px; padding-top:22px; border-top:1px solid var(--line);}
.og-textarea{width:100%; resize:vertical; font-family:'Inter',sans-serif; font-size:15px; line-height:1.5; color:var(--ink); border:1.5px solid var(--line); background:rgba(255,255,255,.65); border-radius:16px; padding:13px 15px; transition:.16s;}
.og-textarea:focus{outline:none; border-color:var(--violet);}
.og-composer-row{display:flex; align-items:center; justify-content:flex-end; gap:12px; margin-top:10px;}
.og-saved{font-size:13px; font-weight:600; color:var(--teal);}

.og-history{}
.og-htitle{font-family:'Quicksand',sans-serif; font-weight:700; font-size:22px; margin:0;}
.og-empty{color:var(--muted); font-size:14.5px; line-height:1.5; margin:4px 0 0;}
.og-spark{width:100%; height:70px; margin:6px 0 16px;}
.og-spark-line{fill:none; stroke:var(--violet); stroke-width:1.6; vector-effect:non-scaling-stroke;}
.og-spark-dot{stroke:#fff; stroke-width:.6;}
.band-calm{fill:var(--teal); background:var(--teal);}
.band-some{fill:var(--violet); background:var(--violet);}
.band-high{fill:var(--peach); background:var(--peach);}
.og-checklist{display:flex; flex-direction:column; gap:8px; margin-top:4px;}
.og-checkrow{display:flex; align-items:center; gap:11px; font-size:14px; padding:9px 12px; background:rgba(255,255,255,.5); border-radius:12px;}
.og-checkdot{width:11px; height:11px; border-radius:50%; flex-shrink:0;}
.og-checkdate{color:var(--ink); font-weight:500;}
.og-checkval{margin-left:auto; color:var(--muted); font-family:'Quicksand',sans-serif; font-weight:600; font-size:13px;}
.og-check-mood{font-size:15px;}
.og-check-energy{font-size:12px; color:var(--muted); margin-left:4px; font-family:'Quicksand',sans-serif; font-weight:600;}

.og-jsection{margin-top:26px; padding-top:24px; border-top:1px solid var(--line);}
.og-jlist{display:flex; flex-direction:column; gap:12px; margin-top:18px;}
.og-jentry{background:rgba(255,255,255,.55); border:1px solid var(--line); border-radius:16px; padding:14px 16px;}
.og-jtop{display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;}
.og-jdate{font-family:'Quicksand',sans-serif; font-weight:600; font-size:13px; color:var(--muted);}
.og-jdel{background:none; border:none; color:var(--muted); cursor:pointer; font-size:14px; padding:2px 6px; border-radius:8px; transition:.15s;}
.og-jdel:hover{color:#d4654a; background:rgba(212,101,74,.1);}
.og-jtext{margin:0; font-size:15px; line-height:1.55; color:var(--ink); white-space:pre-wrap;}

.og-danger{margin-top:26px; padding-top:22px; border-top:1px solid var(--line); text-align:center;}
.og-confirm{text-align:left; font-size:14px; color:var(--ink); background:rgba(212,101,74,.08); padding:14px 16px; border-radius:16px;}
.og-confirm-btns{display:flex; gap:10px; justify-content:flex-end; margin-top:12px;}
.og-del-btn{font-family:'Quicksand',sans-serif; font-weight:600; font-size:14px; background:#d4654a; color:#fff; border:none; border-radius:13px; padding:10px 18px; cursor:pointer;}

.og-foot{margin-top:22px; text-align:center; font-size:12.5px; color:var(--muted); line-height:1.6; padding:0 8px;}
*:focus-visible{outline:3px solid rgba(123,108,246,.5); outline-offset:2px; border-radius:8px;}

.og-mood-row{display:flex; gap:8px; flex-wrap:wrap;}
.og-mood-btn{display:flex; flex-direction:column; align-items:center; gap:4px; background:rgba(255,255,255,.55); border:1.5px solid var(--line); border-radius:16px; padding:12px 10px; cursor:pointer; transition:.16s; flex:1; min-width:52px;}
.og-mood-btn:hover{border-color:var(--violet-soft);}
.og-mood-btn.on{border-color:var(--violet); background:rgba(123,108,246,.10);}
.og-mood-emoji{font-size:26px; line-height:1;}
.og-mood-label{font-size:11px; font-weight:600; color:var(--muted); font-family:'Quicksand',sans-serif; text-align:center;}

.og-overlay{position:fixed; inset:0; z-index:100; background:rgba(20,18,40,.88); backdrop-filter:blur(8px); display:flex; flex-direction:column; align-items:center; justify-content:center; padding:32px;}
.og-overlay-close{position:absolute; top:20px; right:20px; background:rgba(255,255,255,.12); border:none; color:#fff; font-size:18px; width:38px; height:38px; border-radius:50%; cursor:pointer; transition:.15s; display:flex; align-items:center; justify-content:center;}
.og-overlay-close:hover{background:rgba(255,255,255,.22);}
.og-breathe-round{color:rgba(255,255,255,.5); font-size:13px; font-family:'Quicksand',sans-serif; margin:0 0 32px;}
.og-breathe-ring{width:180px; height:180px; border-radius:50%; border:2px solid rgba(255,255,255,.15); display:flex; align-items:center; justify-content:center; margin-bottom:32px;}
.og-breathe-circle{width:100px; height:100px; border-radius:50%; background:radial-gradient(circle, #a99bff 0%, #7b6cf6 60%, #5b4dd6 100%); box-shadow:0 0 40px rgba(123,108,246,.5);}
.og-breathe-phase{color:#fff; font-family:'Quicksand',sans-serif; font-weight:700; font-size:28px; margin:0 0 8px;}
.og-breathe-count{color:rgba(255,255,255,.45); font-size:14px; margin:0;}
.og-breathe-done{text-align:center; color:#fff;}
.og-breathe-msg{font-family:'Quicksand',sans-serif; font-weight:700; font-size:28px; margin:0 0 12px;}
.og-breathe-sub{color:rgba(255,255,255,.6); font-size:15px; line-height:1.5; margin:8px 0 0;}

@media (max-width:480px){
  .og-title{font-size:26px;} .og-question{font-size:23px;}
  .og-card{padding:24px 18px; border-radius:24px;}
  .og-navrow{flex-direction:column-reverse; align-items:stretch;}
  .og-navrow.tight{flex-direction:row; align-items:center;}
  .og-cta.slim{width:100%;}
}

.og-journal-overlay{overflow-y:auto; justify-content:flex-start; padding-top:60px;}
.og-journal-inner{width:100%; max-width:560px;}
.og-jentry-dark{background:rgba(255,255,255,.08); border-color:rgba(255,255,255,.12);}
.og-jentry-dark .og-jdate{color:rgba(255,255,255,.45);}
.og-jentry-dark .og-jtext{color:rgba(255,255,255,.9);}
.og-jentry-dark .og-jdel{color:rgba(255,255,255,.4);}
.og-jentry-dark .og-jdel:hover{color:#ff8a6b; background:rgba(255,138,107,.15);}
.og-textarea.dark{background:rgba(255,255,255,.1); border-color:rgba(255,255,255,.2); color:#fff;}
.og-textarea.dark::placeholder{color:rgba(255,255,255,.35);}
.og-textarea.dark:focus{border-color:var(--violet-soft);}
.og-fab-group{position:fixed; bottom:24px; right:20px; z-index:50; display:flex; flex-direction:column; gap:12px; align-items:center;}
.og-fab{width:52px; height:52px; border-radius:50%; border:none; background:rgba(255,255,255,.9); box-shadow:0 4px 16px rgba(43,40,64,.25); cursor:pointer; display:flex; align-items:center; justify-content:center; transition:.16s; backdrop-filter:blur(8px);}
.og-fab:hover{box-shadow:0 6px 20px rgba(43,40,64,.3);}
@media (prefers-reduced-motion: no-preference){.og-fab:hover{transform:scale(1.08);}}
.og-fab-icon{font-size:22px; line-height:1;}
`;
