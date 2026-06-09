import { useState, useEffect, useRef } from "react";

/**
 * „Огледало" — проверка на стрес + дневник, инспирирано од HBSC (2021/22).
 * Чува податоци локално (localStorage) за да го следи личниот напредок низ време.
 * Извор на референтните вредности: WHO/HBSC International Report 2021/22.
 */

// --- HBSC симптом-чеклист (8 ставки) ---
const SYMPTOMS = [
  { id: "head", label: "Главоболка" },
  { id: "stomach", label: "Болки во стомак" },
  { id: "back", label: "Болки во грб" },
  { id: "low", label: "Потиштеност" },
  { id: "irritable", label: "Раздразливост или лошо расположение" },
  { id: "nervous", label: "Нервоза" },
  { id: "sleep", label: "Тешкотии со заспивање" },
  { id: "dizzy", label: "Вртоглавица" },
];

const SCALE = [
  { score: 4, label: "Речиси секој ден" },
  { score: 3, label: "Повеќе од еднаш неделно" },
  { score: 2, label: "Околу еднаш неделно" },
  { score: 1, label: "Околу еднаш месечно" },
  { score: 0, label: "Ретко или никогаш" },
];

const FREQUENT_THRESHOLD = 3;

const HBSC_REFERENCE = {
  male: { 11: 26, 13: 31, 15: 36 },
  female: { 11: 39, 13: 50, 15: 61 },
  other: { 11: 33, 13: 40, 15: 48 },
};

const AGES = [11, 13, 15];
const GENDERS = [
  { id: "female", label: "Девојче" },
  { id: "male", label: "Момче" },
  { id: "other", label: "Друго / не сакам да кажам" },
];

const BANDS = {
  calm: {
    key: "calm",
    title: "Се чувствуваш прилично добро",
    color: "#2FB6A3",
    aura: ["#7be6d3", "#9be8c9"],
    body: "Сега покажуваш малку чести симптоми на стрес. Тоа е добар знак — секојдневните навики што ти помагаат вреди да ги одржуваш.",
  },
  some: {
    key: "some",
    title: "Имаш некои знаци на стрес",
    color: "#7B6CF6",
    aura: ["#a99bff", "#c3b8ff"],
    body: "Неколку симптоми ти се појавуваат почесто. Тоа е вообичаено во твоите години и не значи дека нешто не е во ред — но вреди да обрнеш внимание на што ти помага да се смириш.",
  },
  high: {
    key: "high",
    title: "Носиш доста стрес во моментов",
    color: "#FF8A6B",
    aura: ["#ff9e7d", "#ffc1a3"],
    body: "Повеќе симптоми ти се појавуваат речиси секојдневно. Не мораш да го носиш тоа сам/а — разговор со личност на која ѝ веруваш навистина помага.",
  },
};

function bandFor(frequentCount) {
  if (frequentCount <= 1) return BANDS.calm;
  if (frequentCount <= 3) return BANDS.some;
  return BANDS.high;
}

const TIPS = {
  calm: [
    "Задржи ги навиките што те смируваат — сон, движење, време со луѓе што ти годат.",
    "Забележувај што те полни со енергија и враќај се на тоа во полоши денови.",
    "Биди тука и за врсник — поддршката функционира во двете насоки.",
  ],
  some: [
    "Проба со 4-7-8 дишење: вдиши 4с, задржи 7с, издиши 8с — повтори 4 пати.",
    "Намали екрани барем еден час пред спиење за полесно заспивање.",
    "Запиши што те мачи во дневникот — ставањето мисли на хартија ја намалува тежината.",
    "Кажи му на некој на кого му веруваш како се чувствуваш.",
  ],
  high: [
    "Разговарај со родител, наставник, училишен психолог или доктор — тоа не е слабост, туку грижа за себе.",
    "Раздели го денот на мали чекори; не мора сè одеднаш.",
    "Краток излез, движење или прошетка ја спушта напнатоста во телото.",
    "Чувај го сонот — заспивање и будење во слично време секој ден.",
  ],
};

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
    /* приватен режим или недостапен localStorage — апликацијата работи и без чување */
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

function computeResult(answers, age, gender) {
  const total = SYMPTOMS.reduce((s, x) => s + (answers[x.id] ?? 0), 0);
  const frequent = SYMPTOMS.filter((x) => (answers[x.id] ?? 0) >= FREQUENT_THRESHOLD);
  const band = bandFor(frequent.length);
  const peerPct = age && gender ? HBSC_REFERENCE[gender][age] : null;
  return { total, frequentCount: frequent.length, band, peerPct };
}

export default function App() {
  const [stage, setStage] = useState("intro"); // intro | quiz | result | history
  const [age, setAge] = useState(null);
  const [gender, setGender] = useState(null);
  const [answers, setAnswers] = useState({});
  const [step, setStep] = useState(0);

  const [checks, setChecks] = useState(() => loadJSON(CHECKS_KEY, []));
  const [journal, setJournal] = useState(() => loadJSON(JOURNAL_KEY, []));
  const [lastResult, setLastResult] = useState(null);
  const [prevCheck, setPrevCheck] = useState(null);

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
    const result = computeResult(answers, age, gender);
    const previous = checks.length ? checks[checks.length - 1] : null;
    const entry = {
      id: Date.now(),
      date: new Date().toISOString(),
      frequentCount: result.frequentCount,
      total: result.total,
      bandKey: result.band.key,
      age,
      gender,
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
    setAge(null);
    setGender(null);
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
            age={age}
            gender={gender}
            setAge={setAge}
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
            allAnswered={SYMPTOMS.every((s) => answers[s.id] !== undefined)}
            onFinish={finishQuiz}
          />
        )}

        {stage === "result" && (
          <Result
            result={lastResult}
            prevCheck={prevCheck}
            age={age}
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
    </div>
  );
}

function Intro({ age, gender, setAge, setGender, onStart, historyCount, journalCount, onHistory }) {
  const ready = age && gender;
  return (
    <section className="og-card og-intro">
      <h1 className="og-title">
        Како ти е <em>навистина</em> овие денови?
      </h1>
      <p className="og-lead">
        Осум кратки прашања за тоа како се чувствувало твоето тело и расположение во последно време.
        На крај ќе видиш како стоиш во споредба со твои врсници од истражувањето HBSC — и како се
        менуваш од ден на ден.
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
          {AGES.map((a) => (
            <button key={a} className={`og-chip ${age === a ? "on" : ""}`} onClick={() => setAge(a)}>
              {a}{a === 15 ? "+" : ""}
            </button>
          ))}
        </div>
      </div>

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

function Quiz({ step, setStep, answers, setAnswers, allAnswered, onFinish }) {
  const sym = SYMPTOMS[step];
  const current = answers[sym.id];
  const isLast = step === SYMPTOMS.length - 1;

  function pick(score) {
    setAnswers((prev) => ({ ...prev, [sym.id]: score }));
    setTimeout(() => {
      if (!isLast) setStep(step + 1);
    }, 220);
  }

  return (
    <section className="og-card og-quiz">
      <div className="og-progress">
        <div className="og-track">
          <div className="og-fill" style={{ width: `${((step + 1) / SYMPTOMS.length) * 100}%` }} />
        </div>
        <span className="og-count">{step + 1} / {SYMPTOMS.length}</span>
      </div>

      <p className="og-qlead">Колку често во последно време чувствуваш...</p>
      <h2 className="og-question">{sym.label}</h2>

      <div className="og-scale">
        {SCALE.map((opt) => (
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
            Види резултат
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

function DeltaCard({ result, prevCheck }) {
  if (!prevCheck) {
    return (
      <div className="og-delta neutral">
        Ова е твојата прва проверка. Од следниот пат ќе гледаш како се менуваш од ден на ден.
      </div>
    );
  }
  const diff = result.frequentCount - prevCheck.frequentCount; // пониско = подобро
  const when = fmtDate(prevCheck.date);
  if (diff < 0) {
    return (
      <div className="og-delta better">
        🌤️ Еј, супер — денес носиш помалку отколку на {when}. Што и да правиш, продолжи така.
      </div>
    );
  }
  if (diff > 0) {
    return (
      <div className="og-delta worse">
        Денес ти е малку потешко отколку на {when}. Потешки денови се случуваат — биди нежен/на со
        себе. Запиши подолу што се случи, или кажи му на некој на кого му веруваш.
      </div>
    );
  }
  return (
    <div className="og-delta neutral">
      Слично како на {when}. Стабилно е сосема во ред.
    </div>
  );
}

function Result({ result, prevCheck, age, gender, onAddJournal, onReset, onHistory }) {
  const { frequentCount, band, peerPct } = result;
  const pct = Math.round((frequentCount / SYMPTOMS.length) * 100);
  const genderLabel = GENDERS.find((g) => g.id === gender)?.label.toLowerCase();
  const youAbove = peerPct !== null && pct > peerPct;

  return (
    <section className="og-card og-result">
      <Gauge value={frequentCount} max={SYMPTOMS.length} color={band.color} aura={band.aura} />

      <h2 className="og-rtitle" style={{ color: band.color }}>{band.title}</h2>
      <p className="og-rbody">{band.body}</p>
      <p className="og-rmeta">
        {frequentCount} од {SYMPTOMS.length} симптоми ти се појавуваат почесто од еднаш неделно.
      </p>

      <DeltaCard result={result} prevCheck={prevCheck} />

      {peerPct !== null && (
        <div className="og-compare">
          <h3 className="og-csub">Како стоиш во споредба со врсници</h3>
          <p className="og-cnote">
            Кај HBSC, околу <strong>{peerPct}%</strong> од младите на {age} год. ({genderLabel})
            пријавуваат повеќе чести симптоми на стрес.
          </p>
          <CompareBar label="HBSC просек (твоја група)" pct={peerPct} color="#A99BFF" />
          <CompareBar label="Твој резултат" pct={pct} color={band.color} emphasis />
          <p className="og-cverdict">
            {youAbove
              ? "Во моментов носиш повеќе од просечниот стрес за твојата група — добро е што го забележа."
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
        placeholder="Пиши слободно — само за тебе е..."
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
          <p className="og-cnote">Колку чести симптоми носиш по проверка. <strong>Пониско = подобро.</strong></p>
          <Sparkline data={recent} />
          <div className="og-checklist">
            {checks.slice().reverse().map((c) => (
              <div className="og-checkrow" key={c.id}>
                <span className={`og-checkdot band-${c.bandKey}`} />
                <span className="og-checkdate">{fmtDateTime(c.date)}</span>
                <span className="og-checkval">{c.frequentCount}/{SYMPTOMS.length} чести</span>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="og-jsection">
        <h3 className="og-csub">Дневник</h3>
        <JournalComposer
          title=""
          placeholder="Нов запис — како помина денот?"
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

function JournalComposer({ title, placeholder, onSave }) {
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
      {title && <h3 className="og-csub">{title}</h3>}
      <textarea
        className="og-textarea"
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
  const max = SYMPTOMS.length;
  const w = 100, h = 40, pad = 4;
  if (data.length < 2) {
    return <p className="og-cnote" style={{ marginTop: -4 }}>Потребни се барем две проверки за линија на трендот.</p>;
  }
  const stepX = (w - pad * 2) / (data.length - 1);
  const pts = data.map((d, i) => {
    const x = pad + i * stepX;
    const y = pad + (d.frequentCount / max) * (h - pad * 2);
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
@media (max-width:480px){
  .og-title{font-size:26px;} .og-question{font-size:23px;}
  .og-card{padding:24px 18px; border-radius:24px;}
  .og-navrow{flex-direction:column-reverse; align-items:stretch;}
  .og-navrow.tight{flex-direction:row; align-items:center;}
  .og-cta.slim{width:100%;}
}
`;
