import { useEffect, useRef, useState } from "react";
import { Icon } from "../Icon";

type Phase = "idle" | "inhale" | "hold" | "exhale";

const PHASE_DURATIONS: Record<Exclude<Phase, "idle">, number> = {
  inhale: 4000,
  hold: 3000,
  exhale: 4500,
};

const PHASE_CUES: Record<Phase, { title: string; hint: string }> = {
  idle: {
    title: "Find a comfortable posture",
    hint: "Press start when you're ready to begin your breathing rhythm.",
  },
  inhale: {
    title: "Breathe In",
    hint: "Slowly expand your belly and chest through your nose (4s)",
  },
  hold: {
    title: "Hold",
    hint: "Rest softly in the stillness without strain (3s)",
  },
  exhale: {
    title: "Breathe Out",
    hint: "Release the air slowly and smoothly through your mouth (4.5s)",
  },
};

export function GentleBreathing() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [running, setRunning] = useState(false);
  const [completedCycles, setCompletedCycles] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  const phaseTimerRef = useRef<number | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);

  // Clear timers helper
  const clearAllTimers = () => {
    if (phaseTimerRef.current !== null) {
      window.clearTimeout(phaseTimerRef.current);
      phaseTimerRef.current = null;
    }
    if (countdownIntervalRef.current !== null) {
      window.clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  };

  const startPhase = (nextPhase: Exclude<Phase, "idle">) => {
    setPhase(nextPhase);
    const durationMs = PHASE_DURATIONS[nextPhase];
    const durationSec = Math.round(durationMs / 1000);
    setSecondsLeft(durationSec);

    clearAllTimers();

    // 1-second countdown display updater
    let currentSec = durationSec;
    countdownIntervalRef.current = window.setInterval(() => {
      currentSec -= 1;
      if (currentSec >= 1) {
        setSecondsLeft(currentSec);
      }
    }, 1000);

    // Transition to next phase after duration
    phaseTimerRef.current = window.setTimeout(() => {
      if (nextPhase === "inhale") {
        startPhase("hold");
      } else if (nextPhase === "hold") {
        startPhase("exhale");
      } else if (nextPhase === "exhale") {
        setCompletedCycles((c) => c + 1);
        startPhase("inhale");
      }
    }, durationMs);
  };

  const handleToggle = () => {
    if (running) {
      // Pause
      setRunning(false);
      clearAllTimers();
    } else {
      // Start or Resume
      setRunning(true);
      if (phase === "idle") {
        startPhase("inhale");
      } else {
        // Resume current phase
        startPhase(phase as Exclude<Phase, "idle">);
      }
    }
  };

  const handleStop = () => {
    setRunning(false);
    clearAllTimers();
    setPhase("idle");
    setSecondsLeft(null);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => clearAllTimers();
  }, []);

  const orbClass =
    phase === "inhale"
      ? "is-inhale"
      : phase === "hold"
      ? "is-hold"
      : phase === "exhale"
      ? "is-exhale"
      : "is-idle";

  return (
    <div className="breathing-box">
      <h2 className="breathing-title">Gentle Breathing</h2>
      <p className="breathing-desc">
        A calming 4-3-4.5 breathing cadence to regulate your nervous system.
      </p>

      <div className="breathing-stage" aria-live="polite">
        <div className="breathing-orb-backdrop" />
        <div className="breathing-orb-ring" />
        <div className={`breathing-orb ${orbClass}`}>
          <Icon name="wind" size={32} />
        </div>
      </div>

      <div className="breathing-cue" aria-live="assertive">
        <span className="breathing-cue__phase">{PHASE_CUES[phase].title}</span>
        <span className="breathing-cue__timer">
          {running && secondsLeft !== null ? `${secondsLeft}s` : PHASE_CUES[phase].hint}
        </span>
      </div>

      <div className="breathing-controls">
        <button
          type="button"
          className="btn btn--primary"
          onClick={handleToggle}
          aria-label={running ? "Pause breathing exercise" : "Start breathing exercise"}
        >
          <Icon name={running ? "pause" : "play"} size={18} />
          <span>{running ? "Pause" : phase === "idle" ? "Start Breathing" : "Resume"}</span>
        </button>

        {phase !== "idle" && (
          <button
            type="button"
            className="btn btn--ghost"
            onClick={handleStop}
            aria-label="Stop breathing exercise and reset"
          >
            <Icon name="stop" size={18} />
            <span>Reset</span>
          </button>
        )}
      </div>

      {completedCycles > 0 && (
        <div className="breathing-cycles" role="status">
          {completedCycles} full {completedCycles === 1 ? "cycle" : "cycles"} completed
        </div>
      )}
    </div>
  );
}
