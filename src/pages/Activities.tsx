import { useState, useEffect, useRef } from "react";
import { Icon } from "../components/Icon";
import { useLocation } from "../lib/router";
import { usePageMeta } from "../lib/hooks";

type ActivityCategory = "all" | "breathing" | "grounding" | "mindful" | "games";
type ActiveTool =
  | null
  | "breathing"
  | "grounding"
  | "notice"
  | "control-release"
  | "journal"
  | "body-scan"
  | "ripples"
  | "clouds"
  | "constellation";

interface ActivityCard {
  id: ActiveTool;
  title: string;
  category: "breathing" | "grounding" | "mindful" | "games";
  duration: string;
  desc: string;
  icon: "wind" | "feather" | "eye" | "spark" | "heart" | "game";
}

const ACTIVITIES: ActivityCard[] = [
  {
    id: "breathing",
    title: "Gentle Breathing",
    category: "breathing",
    duration: "2 min",
    desc: "A soft, rhythmic breath pace to soothe tension and settle your pulse.",
    icon: "wind",
  },
  {
    id: "grounding",
    title: "5-4-3-2-1 Grounding",
    category: "grounding",
    duration: "3 min",
    desc: "Anchor into the present room by gently engaging your five senses.",
    icon: "feather",
  },
  {
    id: "notice",
    title: "Notice Your Surroundings",
    category: "grounding",
    duration: "1 min",
    desc: "A brief visual pause to look away from screens and ground your gaze.",
    icon: "eye",
  },
  {
    id: "control-release",
    title: "Control & Release",
    category: "mindful",
    duration: "3 min",
    desc: "Separate what is in your power right now from what you can let go.",
    icon: "spark",
  },
  {
    id: "body-scan",
    title: "Physical Tension Release",
    category: "mindful",
    duration: "2 min",
    desc: "Gently soften your jaw, drop your shoulders, and ease holding patterns.",
    icon: "heart",
  },
  {
    id: "journal",
    title: "Quiet Reflection Prompt",
    category: "mindful",
    duration: "5 min",
    desc: "Unhurried private journaling with a thoughtful, open question.",
    icon: "spark",
  },
  {
    id: "ripples",
    title: "Zen Water Ripples",
    category: "games",
    duration: "Open",
    desc: "A calm, interactive water surface with expanding harmonic ripples.",
    icon: "game",
  },
  {
    id: "clouds",
    title: "Thought Cloud Release",
    category: "games",
    duration: "Open",
    desc: "Put a nagging thought into a cloud and watch it slowly drift away.",
    icon: "game",
  },
  {
    id: "constellation",
    title: "Constellation Connect",
    category: "games",
    duration: "2 min",
    desc: "Trace gentle glowing stars to bring a tranquil night sky to life.",
    icon: "game",
  },
];

/* ────────────── Web Audio Bell/Chime ────────────── */
function playGentleChime(freq = 440) {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 1.2);
  } catch {
    // audio context muted or unsupported, fail silently
  }
}

/* ────────────── Tool 1: Gentle Breathing ────────────── */
function BreathingTool({ onExit }: { onExit: () => void }) {
  const [phase, setPhase] = useState<"inhale" | "hold" | "exhale" | "rest">("inhale");
  const [running, setRunning] = useState(true);
  const [secondsLeft, setSecondsLeft] = useState(120);
  const [cycles, setCycles] = useState(0);

  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [running]);

  useEffect(() => {
    if (!running) return;
    let t: ReturnType<typeof setTimeout>;

    if (phase === "inhale") {
      playGentleChime(392);
      t = setTimeout(() => setPhase("hold"), 4000);
    } else if (phase === "hold") {
      t = setTimeout(() => setPhase("exhale"), 3000);
    } else if (phase === "exhale") {
      playGentleChime(330);
      t = setTimeout(() => setPhase("rest"), 4500);
    } else {
      setCycles((c) => c + 1);
      t = setTimeout(() => setPhase("inhale"), 2500);
    }
    return () => clearTimeout(t);
  }, [phase, running]);

  const instructions = {
    inhale: "Inhale gently through your nose",
    hold: "Pause softly. No tension",
    exhale: "Exhale smoothly and slowly",
    rest: "Rest in the quiet moment",
  };

  return (
    <div className="activity-view">
      <div className="activity-view__header">
        <button type="button" className="icon-btn icon-btn--sm" onClick={onExit} aria-label="Exit breathing">
          <Icon name="back" size={18} />
        </button>
        <div>
          <h2>Gentle Breathing</h2>
          <span className="hint">Cycles completed: {cycles} · {Math.floor(secondsLeft / 60)}:{(secondsLeft % 60).toString().padStart(2, "0")} remaining</span>
        </div>
      </div>

      <div className="breathing-stage">
        <div className={`breathing-circle breathing-circle--${phase}`} aria-hidden="true">
          <div className="breathing-circle__inner" />
        </div>
        <p className="breathing-guide" aria-live="polite">
          {instructions[phase]}
        </p>
        <span className="breathing-phase-tag">{phase.toUpperCase()}</span>
      </div>

      <div className="activity-view__footer">
        <button
          type="button"
          className="btn btn--sm"
          onClick={() => setRunning(!running)}
        >
          <Icon name={running ? "pause" : "play"} size={16} />
          <span>{running ? "Pause" : "Resume"}</span>
        </button>
        <button type="button" className="btn btn--sm btn--ghost" onClick={onExit}>
          Finish exercise
        </button>
      </div>
    </div>
  );
}

/* ────────────── Tool 2: 5-4-3-2-1 Sensory Grounding ────────────── */
function GroundingTool({ onExit }: { onExit: () => void }) {
  const [stepIdx, setStepIdx] = useState(0);
  const [checkedItems, setCheckedItems] = useState<Record<number, boolean[]>>({
    0: [false, false, false, false, false],
    1: [false, false, false, false],
    2: [false, false, false],
    3: [false, false],
    4: [false],
  });

  const STEPS = [
    {
      num: 5,
      title: "5 things you can SEE",
      prompt: "Look around you. Notice five distinct things in your surroundings — a shape, a shadow, a color, or a small detail.",
      items: ["Item 1", "Item 2", "Item 3", "Item 4", "Item 5"],
    },
    {
      num: 4,
      title: "4 things you can physically FEEL",
      prompt: "Notice four physical points of contact: the weight of your feet on the floor, clothes on your shoulders, or the surface under your hands.",
      items: ["Point 1", "Point 2", "Point 3", "Point 4"],
    },
    {
      num: 3,
      title: "3 things you can HEAR",
      prompt: "Listen for three distinct sounds: distant traffic, a computer fan, a clock, or the rhythm of your own breath.",
      items: ["Sound 1", "Sound 2", "Sound 3"],
    },
    {
      num: 2,
      title: "2 things you can SMELL or air sensations",
      prompt: "Notice two subtle scents in the air, or the cool air entering your nostrils.",
      items: ["Sensation 1", "Sensation 2"],
    },
    {
      num: 1,
      title: "1 truth or taste",
      prompt: "Notice any lingering taste, or acknowledge one gentle truth: You are safe in this moment, and you are taking care of yourself.",
      items: ["Grounding truth"],
    },
  ];

  const current = STEPS[stepIdx];
  const toggleItem = (idx: number) => {
    setCheckedItems((prev) => {
      const arr = [...(prev[stepIdx] ?? [])];
      arr[idx] = !arr[idx];
      return { ...prev, [stepIdx]: arr };
    });
  };

  const isAllChecked = (checkedItems[stepIdx] ?? []).every(Boolean);

  return (
    <div className="activity-view">
      <div className="activity-view__header">
        <button type="button" className="icon-btn icon-btn--sm" onClick={onExit} aria-label="Exit grounding">
          <Icon name="back" size={18} />
        </button>
        <div>
          <h2>5-4-3-2-1 Sensory Grounding</h2>
          <span className="hint">Step {stepIdx + 1} of 5</span>
        </div>
      </div>

      {current && (
        <div className="grounding-stage animate-fade-in" key={stepIdx}>
          <div className="grounding-stage__badge">{current.num}</div>
          <h3>{current.title}</h3>
          <p className="muted">{current.prompt}</p>

          <div className="grounding-checklist">
            {current.items.map((_, i) => {
              const isChecked = checkedItems[stepIdx]?.[i] ?? false;
              return (
                <button
                  key={i}
                  type="button"
                  className={`grounding-check-item ${isChecked ? "is-checked" : ""}`}
                  onClick={() => toggleItem(i)}
                  aria-pressed={isChecked}
                >
                  <span className="grounding-check-box">
                    {isChecked && <Icon name="check" size={14} />}
                  </span>
                  <span>{isChecked ? "Noticed" : `Tap when you notice #${i + 1}`}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="activity-view__footer">
        <button
          type="button"
          className="btn btn--sm"
          disabled={stepIdx === 0}
          onClick={() => setStepIdx((s) => Math.max(0, s - 1))}
        >
          Previous
        </button>
        {stepIdx < STEPS.length - 1 ? (
          <button
            type="button"
            className="btn btn--sm btn--primary"
            onClick={() => {
              playGentleChime(440 + stepIdx * 40);
              setStepIdx((s) => s + 1);
            }}
          >
            <span>Next ({isAllChecked ? "Ready" : "Skip"})</span>
            <Icon name="arrow" size={16} />
          </button>
        ) : (
          <button type="button" className="btn btn--sm btn--primary" onClick={onExit}>
            <span>Complete Grounding</span>
            <Icon name="check" size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

/* ────────────── Tool 3: Notice Your Surroundings ────────────── */
function NoticeTool({ onExit }: { onExit: () => void }) {
  const [index, setIndex] = useState(0);

  const PROMPTS = [
    "Look away from the screen. Find something nearby that has a calming shade of green, brown, or blue.",
    "Look around for an object that has an interesting, gentle texture or gentle curve.",
    "Notice where the light and shadows fall gently in the room.",
    "Look as far as your eyes can comfortably travel. Rest your gaze softly into the distance.",
    "Take one slow, effortless breath. You are right here.",
  ];

  return (
    <div className="activity-view">
      <div className="activity-view__header">
        <button type="button" className="icon-btn icon-btn--sm" onClick={onExit} aria-label="Exit notice">
          <Icon name="back" size={18} />
        </button>
        <div>
          <h2>Notice Your Surroundings</h2>
          <span className="hint">Step {index + 1} of {PROMPTS.length}</span>
        </div>
      </div>

      <div className="notice-stage animate-fade-in" key={index}>
        <div className="notice-stage__icon">
          <Icon name="eye" size={32} />
        </div>
        <p className="notice-stage__text">{PROMPTS[index]}</p>
      </div>

      <div className="activity-view__footer">
        {index < PROMPTS.length - 1 ? (
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => {
              playGentleChime(523.25);
              setIndex((i) => i + 1);
            }}
          >
            <span>Next observation</span>
            <Icon name="arrow" size={16} />
          </button>
        ) : (
          <button type="button" className="btn btn--primary" onClick={onExit}>
            Return to Reset Space
          </button>
        )}
      </div>
    </div>
  );
}

/* ────────────── Tool 4: Control & Release ────────────── */
function ControlReleaseTool({ onExit }: { onExit: () => void }) {
  const [worry, setWorry] = useState("");
  const [inControl, setInControl] = useState<string[]>([
    "My boundaries and saying no when I need to",
    "How gently I speak to myself right now",
    "Taking this small pause today",
  ]);
  const [released, setReleased] = useState<string[]>([
    "Other people's unpredictable moods",
    "Things that already happened yesterday",
    "Things I cannot immediately fix right now",
  ]);

  const addWorry = (to: "control" | "release") => {
    if (!worry.trim()) return;
    if (to === "control") {
      setInControl((prev) => [worry.trim(), ...prev]);
    } else {
      setReleased((prev) => [worry.trim(), ...prev]);
    }
    setWorry("");
    playGentleChime(to === "control" ? 440 : 330);
  };

  return (
    <div className="activity-view">
      <div className="activity-view__header">
        <button type="button" className="icon-btn icon-btn--sm" onClick={onExit} aria-label="Exit control release">
          <Icon name="back" size={18} />
        </button>
        <div>
          <h2>Control & Release</h2>
          <span className="hint">Lighten your mental load by identifying what you can actually hold.</span>
        </div>
      </div>

      <div className="control-stage">
        <div className="control-input-row">
          <input
            className="input"
            value={worry}
            onChange={(e) => setWorry(e.target.value)}
            placeholder="Type a thought, task, or worry that is lingering..."
            onKeyDown={(e) => {
              if (e.key === "Enter") addWorry("release");
            }}
          />
          <div className="row" style={{ gap: 8 }}>
            <button
              type="button"
              className="btn btn--sm btn--primary"
              onClick={() => addWorry("control")}
              disabled={!worry.trim()}
            >
              In My Power
            </button>
            <button
              type="button"
              className="btn btn--sm btn--ghost"
              onClick={() => addWorry("release")}
              disabled={!worry.trim()}
            >
              Let It Go
            </button>
          </div>
        </div>

        <div className="control-columns">
          <div className="control-col control-col--in">
            <h3>Within My Control</h3>
            <p className="faint small">What I can intentionally focus on today</p>
            <ul>
              {inControl.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="control-col control-col--out">
            <h3>Beyond My Control (Releasing)</h3>
            <p className="faint small">Things that are not mine to carry right now</p>
            <ul>
              {released.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="activity-view__footer">
        <button type="button" className="btn btn--ghost" onClick={onExit}>
          Done reflecting
        </button>
      </div>
    </div>
  );
}

/* ────────────── Tool 5: Body Scan Tension Release ────────────── */
function BodyScanTool({ onExit }: { onExit: () => void }) {
  const [step, setStep] = useState(0);

  const STAGES = [
    { area: "Face & Jaw", action: "Unclench your jaw. Drop your tongue from the roof of your mouth. Soften the tiny muscles around your eyes and forehead." },
    { area: "Shoulders & Neck", action: "Let your shoulders gently drop two inches down away from your ears. Release any holding in the back of your neck." },
    { area: "Hands & Arms", action: "Unfurl your fingers. Rest your palms gently in your lap or on your desk without gripping." },
    { area: "Belly & Chest", action: "Soften your stomach muscles. Allow your belly to expand naturally as you breathe without holding it in." },
    { area: "Feet & Ground", action: "Feel the floor supporting your feet. You are held, steady, and unhurried." },
  ];

  const current = STAGES[step];

  return (
    <div className="activity-view">
      <div className="activity-view__header">
        <button type="button" className="icon-btn icon-btn--sm" onClick={onExit} aria-label="Exit tension release">
          <Icon name="back" size={18} />
        </button>
        <div>
          <h2>Physical Tension Release</h2>
          <span className="hint">Area {step + 1} of {STAGES.length}</span>
        </div>
      </div>

      {current && (
        <div className="body-scan-stage animate-fade-in" key={step}>
          <div className="body-scan-tag">{current.area}</div>
          <p className="body-scan-instruction">{current.action}</p>
        </div>
      )}

      <div className="activity-view__footer">
        <button
          type="button"
          className="btn btn--sm"
          disabled={step === 0}
          onClick={() => setStep((s) => s - 1)}
        >
          Previous
        </button>
        {step < STAGES.length - 1 ? (
          <button
            type="button"
            className="btn btn--sm btn--primary"
            onClick={() => {
              playGentleChime(392);
              setStep((s) => s + 1);
            }}
          >
            <span>Next Area</span>
            <Icon name="arrow" size={16} />
          </button>
        ) : (
          <button type="button" className="btn btn--sm btn--primary" onClick={onExit}>
            Finished
          </button>
        )}
      </div>
    </div>
  );
}

/* ────────────── Tool 6: Quiet Reflection Journal ────────────── */
function JournalTool({ onExit }: { onExit: () => void }) {
  const PROMPTS = [
    "What has been occupying the quiet corners of your mind lately?",
    "If you could give yourself permission to stop worrying about one thing today, what would it be?",
    "What is one small comfort you encountered recently that made you feel even slightly at ease?",
    "What is something true about your resilience that you tend to forget when things feel heavy?",
  ];

  const [promptIdx, setPromptIdx] = useState(0);
  const [entry, setEntry] = useState("");
  const [copied, setCopied] = useState(false);

  const copyEntry = async () => {
    if (!entry.trim()) return;
    try {
      await navigator.clipboard.writeText(entry);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="activity-view">
      <div className="activity-view__header">
        <button type="button" className="icon-btn icon-btn--sm" onClick={onExit} aria-label="Exit journal">
          <Icon name="back" size={18} />
        </button>
        <div>
          <h2>Quiet Reflection Journal</h2>
          <span className="hint">Your words remain strictly on your device.</span>
        </div>
      </div>

      <div className="journal-stage">
        <div className="journal-prompt-box">
          <p className="journal-prompt-text">{PROMPTS[promptIdx]}</p>
          <button
            type="button"
            className="btn btn--sm btn--ghost"
            onClick={() => setPromptIdx((p) => (p + 1) % PROMPTS.length)}
          >
            <Icon name="retry" size={15} />
            <span>Different question</span>
          </button>
        </div>

        <textarea
          className="textarea journal-textarea"
          value={entry}
          onChange={(e) => setEntry(e.target.value)}
          placeholder="Take your time. Write freely..."
          rows={6}
        />

        <div className="journal-foot">
          <span className="faint small">{entry.trim().split(/\s+/).filter(Boolean).length} words</span>
          <button
            type="button"
            className="btn btn--sm btn--ghost"
            onClick={() => void copyEntry()}
            disabled={!entry.trim()}
          >
            <Icon name={copied ? "check" : "copy"} size={16} />
            <span>{copied ? "Copied" : "Copy to notes"}</span>
          </button>
        </div>
      </div>

      <div className="activity-view__footer">
        <button type="button" className="btn btn--primary" onClick={onExit}>
          Save moment & Close
        </button>
      </div>
    </div>
  );
}

/* ────────────── Tool 7: Zen Water Ripples (Mini-game) ────────────── */
function RipplesTool({ onExit }: { onExit: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = (canvas.width = canvas.parentElement?.clientWidth ?? 400);
    let height = (canvas.height = canvas.parentElement?.clientHeight ?? 400);

    const onResize = () => {
      if (!canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight;
    };
    window.addEventListener("resize", onResize);

    interface Ripple {
      x: number;
      y: number;
      radius: number;
      maxRadius: number;
      opacity: number;
      speed: number;
      color: string;
    }

    const ripples: Ripple[] = [];
    const colors = ["rgba(134, 189, 176, ", "rgba(185, 172, 236, ", "rgba(111, 176, 184, "];

    const addRipple = (x: number, y: number) => {
      ripples.push({
        x,
        y,
        radius: 2,
        maxRadius: 120 + Math.random() * 60,
        opacity: 0.8,
        speed: 1.5 + Math.random() * 1,
        color: colors[Math.floor(Math.random() * colors.length)] ?? "rgba(134, 189, 176, ",
      });
      playGentleChime(300 + Math.random() * 200);
    };

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      const rect = canvas.getBoundingClientRect();
      const clientX = "touches" in e ? e.touches[0]?.clientX ?? 0 : e.clientX;
      const clientY = "touches" in e ? e.touches[0]?.clientY ?? 0 : e.clientY;
      addRipple(clientX - rect.left, clientY - rect.top);
    };

    canvas.addEventListener("mousedown", handlePointerDown);
    canvas.addEventListener("touchstart", handlePointerDown);

    let animId: number;
    const loop = () => {
      ctx.fillStyle = "rgba(13, 19, 23, 0.18)";
      ctx.fillRect(0, 0, width, height);

      for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i];
        if (!r) continue;
        r.radius += r.speed;
        r.opacity -= 0.009;

        if (r.opacity <= 0 || r.radius >= r.maxRadius) {
          ripples.splice(i, 1);
          continue;
        }

        ctx.beginPath();
        ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
        ctx.strokeStyle = `${r.color}${r.opacity})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(r.x, r.y, Math.max(1, r.radius * 0.6), 0, Math.PI * 2);
        ctx.strokeStyle = `${r.color}${r.opacity * 0.5})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener("resize", onResize);
      canvas.removeEventListener("mousedown", handlePointerDown);
      canvas.removeEventListener("touchstart", handlePointerDown);
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <div className="activity-view">
      <div className="activity-view__header">
        <button type="button" className="icon-btn icon-btn--sm" onClick={onExit} aria-label="Exit ripples">
          <Icon name="back" size={18} />
        </button>
        <div>
          <h2>Zen Water Ripples</h2>
          <span className="hint">Tap anywhere on the surface to send gentle harmonic waves.</span>
        </div>
      </div>

      <div className="ripples-stage">
        <canvas ref={canvasRef} className="ripples-canvas" />
      </div>

      <div className="activity-view__footer">
        <button type="button" className="btn btn--ghost" onClick={onExit}>
          Close pond
        </button>
      </div>
    </div>
  );
}

/* ────────────── Tool 8: Thought Cloud Release (Mini-game) ────────────── */
function CloudReleaseTool({ onExit }: { onExit: () => void }) {
  const [thought, setThought] = useState("");
  const [driftingClouds, setDriftingClouds] = useState<{ id: string; text: string }[]>([]);

  const release = () => {
    if (!thought.trim()) return;
    const newId = `c-${Date.now()}`;
    setDriftingClouds((prev) => [...prev, { id: newId, text: thought.trim() }]);
    setThought("");
    playGentleChime(329.63);

    // remove after drift animation finishes
    setTimeout(() => {
      setDriftingClouds((prev) => prev.filter((c) => c.id !== newId));
    }, 7000);
  };

  return (
    <div className="activity-view">
      <div className="activity-view__header">
        <button type="button" className="icon-btn icon-btn--sm" onClick={onExit} aria-label="Exit cloud release">
          <Icon name="back" size={18} />
        </button>
        <div>
          <h2>Thought Cloud Release</h2>
          <span className="hint">Place a worry into a cloud and watch it dissolve into the evening sky.</span>
        </div>
      </div>

      <div className="cloud-stage">
        <div className="cloud-sky">
          {driftingClouds.map((cloud) => (
            <div key={cloud.id} className="drifting-cloud">
              <span>{cloud.text}</span>
            </div>
          ))}
          {driftingClouds.length === 0 && (
            <p className="faint small cloud-sky-hint">Type a thought below and send it on its way.</p>
          )}
        </div>

        <div className="cloud-input-bar">
          <input
            className="input"
            value={thought}
            onChange={(e) => setThought(e.target.value)}
            placeholder="What thought would you like to let go of?"
            onKeyDown={(e) => {
              if (e.key === "Enter") release();
            }}
          />
          <button type="button" className="btn btn--primary" onClick={release} disabled={!thought.trim()}>
            <span>Release</span>
            <Icon name="wind" size={16} />
          </button>
        </div>
      </div>

      <div className="activity-view__footer">
        <button type="button" className="btn btn--ghost" onClick={onExit}>
          Back to Reset Space
        </button>
      </div>
    </div>
  );
}

/* ────────────── Tool 9: Constellation Connect (Mini-game) ────────────── */
function ConstellationTool({ onExit }: { onExit: () => void }) {
  const [connectedStars, setConnectedStars] = useState<number[]>([]);
  const [complete, setComplete] = useState(false);

  // 7 stars forming the Big Dipper / Ursa
  const STARS = [
    { id: 0, x: 20, y: 35, label: "Dubhe" },
    { id: 1, x: 35, y: 32, label: "Merak" },
    { id: 2, x: 42, y: 55, label: "Phecda" },
    { id: 3, x: 26, y: 58, label: "Megrez" },
    { id: 4, x: 58, y: 65, label: "Alioth" },
    { id: 5, x: 74, y: 72, label: "Mizar" },
    { id: 6, x: 88, y: 82, label: "Alkaid" },
  ];

  const tapStar = (id: number) => {
    if (connectedStars.includes(id)) return;
    const nextIdx = connectedStars.length;
    if (id === nextIdx) {
      playGentleChime(300 + id * 55);
      const next = [...connectedStars, id];
      setConnectedStars(next);
      if (next.length === STARS.length) {
        setComplete(true);
        setTimeout(() => playGentleChime(587.33), 400);
      }
    }
  };

  const reset = () => {
    setConnectedStars([]);
    setComplete(false);
  };

  return (
    <div className="activity-view">
      <div className="activity-view__header">
        <button type="button" className="icon-btn icon-btn--sm" onClick={onExit} aria-label="Exit constellation">
          <Icon name="back" size={18} />
        </button>
        <div>
          <h2>Constellation Connect</h2>
          <span className="hint">Tap each glowing star in sequence to illuminate the night sky.</span>
        </div>
      </div>

      <div className="constellation-stage">
        <svg className="constellation-svg" viewBox="0 0 100 100">
          {/* Render lines between connected stars */}
          {connectedStars.map((sId, i) => {
            if (i === 0) return null;
            const p1 = STARS[connectedStars[i - 1] ?? 0];
            const p2 = STARS[sId];
            if (!p1 || !p2) return null;
            return (
              <line
                key={i}
                x1={p1.x}
                y1={p1.y}
                x2={p2.x}
                y2={p2.y}
                stroke="var(--accent)"
                strokeWidth="1.2"
                strokeDasharray="2 2"
              />
            );
          })}

          {/* Render stars */}
          {STARS.map((star) => {
            const isConnected = connectedStars.includes(star.id);
            const isNext = connectedStars.length === star.id;
            return (
              <g
                key={star.id}
                onClick={() => tapStar(star.id)}
                style={{ cursor: "pointer" }}
              >
                <circle
                  cx={star.x}
                  cy={star.y}
                  r={isConnected ? 3 : isNext ? 3.5 : 2}
                  fill={isConnected ? "var(--accent)" : isNext ? "var(--lav)" : "rgba(255,255,255,0.4)"}
                  className={isNext ? "star-pulse" : ""}
                />
              </g>
            );
          })}
        </svg>

        {complete && (
          <div className="constellation-complete animate-fade-in">
            <p>Constellation illuminated · Peace in stillness</p>
            <button type="button" className="btn btn--sm btn--ghost" onClick={reset}>
              Trace again
            </button>
          </div>
        )}
      </div>

      <div className="activity-view__footer">
        <button type="button" className="btn btn--ghost" onClick={onExit}>
          Close stars
        </button>
      </div>
    </div>
  );
}

/* ────────────── Main Page Component ────────────── */
export function ActivitiesPage() {
  usePageMeta("Activities & Reset · Elniv");
  const { search } = useLocation();
  const initialTool = search.get("tool") as ActiveTool;

  const [activeTool, setActiveTool] = useState<ActiveTool>(initialTool ?? null);
  const [filter, setFilter] = useState<ActivityCategory>("all");

  const filtered = ACTIVITIES.filter((a) => {
    if (filter === "all") return true;
    return a.category === filter;
  });

  if (activeTool === "breathing") return <BreathingTool onExit={() => setActiveTool(null)} />;
  if (activeTool === "grounding") return <GroundingTool onExit={() => setActiveTool(null)} />;
  if (activeTool === "notice") return <NoticeTool onExit={() => setActiveTool(null)} />;
  if (activeTool === "control-release") return <ControlReleaseTool onExit={() => setActiveTool(null)} />;
  if (activeTool === "body-scan") return <BodyScanTool onExit={() => setActiveTool(null)} />;
  if (activeTool === "journal") return <JournalTool onExit={() => setActiveTool(null)} />;
  if (activeTool === "ripples") return <RipplesTool onExit={() => setActiveTool(null)} />;
  if (activeTool === "clouds") return <CloudReleaseTool onExit={() => setActiveTool(null)} />;
  if (activeTool === "constellation") return <ConstellationTool onExit={() => setActiveTool(null)} />;

  return (
    <div className="activities-page">
      <header className="page__head" style={{ marginBottom: 24 }}>
        <p className="eyebrow">Reset Space</p>
        <h1>Activities & Reset</h1>
        <p className="muted" style={{ maxWidth: 580 }}>
          Gentle, low-pressure tools to help you pause, regulate your breath, settle your senses, or redirect your attention.
        </p>
      </header>

      {/* Filter Tabs */}
      <div className="activities-filter" role="tablist" aria-label="Activity categories">
        {(
          [
            { id: "all", label: "All Activities" },
            { id: "breathing", label: "Gentle Breathing" },
            { id: "grounding", label: "Grounding" },
            { id: "mindful", label: "Mindful" },
            { id: "games", label: "Calm Interactions" },
          ] as const
        ).map((cat) => (
          <button
            key={cat.id}
            type="button"
            role="tab"
            aria-selected={filter === cat.id}
            className={`activities-filter__btn ${filter === cat.id ? "is-active" : ""}`}
            onClick={() => setFilter(cat.id)}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Activities Grid */}
      <div className="activities-grid">
        {filtered.map((item) => (
          <button
            key={item.id}
            type="button"
            className="activity-card"
            onClick={() => setActiveTool(item.id)}
          >
            <div className="activity-card__head">
              <span className="activity-card__icon">
                <Icon name={item.icon} size={22} />
              </span>
              <span className="activity-card__badge">{item.duration}</span>
            </div>
            <h2 className="activity-card__title">{item.title}</h2>
            <p className="activity-card__desc">{item.desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
