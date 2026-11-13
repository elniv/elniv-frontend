import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent, MouseEvent } from "react";
import { Icon } from "./Icon";
import { formatDuration } from "../lib/format";

/** Plays a recorded clip with real progress. `seconds` is the known recording length
 *  (MediaRecorder WebM files often report an unknown duration). */
export function AudioPlayer({ src, seconds }: { src: string; seconds: number }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);

  useEffect(() => {
    setPlaying(false);
    setTime(0);
  }, [src]);

  const total = Math.max(seconds, 0.1);
  const seek = (to: number) => {
    const el = audio.current;
    if (!el) return;
    const clamped = Math.min(Math.max(to, 0), total);
    el.currentTime = clamped;
    setTime(clamped);
  };

  const toggle = () => {
    const el = audio.current;
    if (!el) return;
    if (el.paused) void el.play().catch(() => setPlaying(false));
    else el.pause();
  };

  const onBarClick = (event: MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    seek(((event.clientX - rect.left) / rect.width) * total);
  };

  const onBarKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowRight") seek(time + 5);
    else if (event.key === "ArrowLeft") seek(time - 5);
    else return;
    event.preventDefault();
  };

  return (
    <div className="player">
      <audio
        ref={audio}
        src={src}
        preload="auto"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setTime(0);
        }}
        onTimeUpdate={(event) => setTime(Math.min(event.currentTarget.currentTime, total))}
      />
      <button type="button" className="icon-btn icon-btn--sm" onClick={toggle} aria-label={playing ? "Pause recording" : "Play recording"}>
        <Icon name={playing ? "pause" : "play"} size={18} />
      </button>
      <div
        className="progress"
        role="slider"
        tabIndex={0}
        aria-label="Playback position"
        aria-valuemin={0}
        aria-valuemax={Math.round(total)}
        aria-valuenow={Math.round(time)}
        aria-valuetext={`${formatDuration(time)} of ${formatDuration(total)}`}
        onClick={onBarClick}
        onKeyDown={onBarKey}
      >
        <div style={{ width: `${Math.min(100, (time / total) * 100)}%` }} />
      </div>
      <span className="small faint" style={{ fontVariantNumeric: "tabular-nums" }}>
        {formatDuration(time)} / {formatDuration(total)}
      </span>
    </div>
  );
}
