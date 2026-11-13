import { useCallback, useEffect, useRef, useState } from "react";

export type RecorderStatus = "idle" | "requesting" | "recording" | "recorded";
export type RecorderError = "denied" | "no-device" | "failed" | null;

export const LEVEL_BARS = 32;
export const MAX_RECORDING_SECONDS = 180;

export function isRecordingSupported(): boolean {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";
}

const MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

function pickMimeType(): string | undefined {
  return MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type));
}

export function extensionFor(mime: string): string {
  if (mime.includes("mp4")) return "m4a";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("wav")) return "wav";
  return "webm";
}

export interface Recording {
  blob: Blob;
  url: string;
  seconds: number;
  mimeType: string;
}

export function useVoiceRecorder() {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [error, setError] = useState<RecorderError>(null);
  const [seconds, setSeconds] = useState(0);
  const [levels, setLevels] = useState<number[]>(() => new Array<number>(LEVEL_BARS).fill(0));
  const [recording, setRecording] = useState<Recording | null>(null);

  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const audioContext = useRef<AudioContext | null>(null);
  const frame = useRef<number | null>(null);
  const timer = useRef<number | null>(null);
  const startedAt = useRef(0);
  const discard = useRef(false);
  const urlRef = useRef<string | null>(null);

  const teardown = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    if (timer.current !== null) window.clearInterval(timer.current);
    frame.current = null;
    timer.current = null;
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    void audioContext.current?.close().catch(() => undefined);
    audioContext.current = null;
  }, []);

  const revokeUrl = useCallback(() => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
  }, []);

  const reset = useCallback(() => {
    discard.current = true;
    if (recorder.current && recorder.current.state !== "inactive") recorder.current.stop();
    recorder.current = null;
    teardown();
    revokeUrl();
    setRecording(null);
    setSeconds(0);
    setLevels(new Array<number>(LEVEL_BARS).fill(0));
    setError(null);
    setStatus("idle");
  }, [revokeUrl, teardown]);

  const stop = useCallback(() => {
    if (recorder.current && recorder.current.state === "recording") recorder.current.stop();
  }, []);

  const start = useCallback(async () => {
    if (!isRecordingSupported()) {
      setError("failed");
      return;
    }
    revokeUrl();
    setRecording(null);
    setError(null);
    setSeconds(0);
    setStatus("requesting");
    discard.current = false;

    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      stream.current = media;

      const mimeType = pickMimeType();
      const instance = new MediaRecorder(media, mimeType ? { mimeType } : undefined);
      recorder.current = instance;
      chunks.current = [];

      instance.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.current.push(event.data);
      };
      instance.onstop = () => {
        const elapsed = (performance.now() - startedAt.current) / 1000;
        const type = instance.mimeType || mimeType || "audio/webm";
        teardown();
        if (discard.current) return;
        const blob = new Blob(chunks.current, { type });
        if (blob.size === 0) {
          setError("failed");
          setStatus("idle");
          return;
        }
        const url = URL.createObjectURL(blob);
        urlRef.current = url;
        setSeconds(elapsed);
        setRecording({ blob, url, seconds: elapsed, mimeType: type });
        setStatus("recorded");
      };

      // Real microphone levels for the live meter.
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctx) {
        const context = new Ctx();
        audioContext.current = context;
        // Safari can start contexts suspended even after a user gesture.
        void context.resume().catch(() => undefined);
        const analyser = context.createAnalyser();
        analyser.fftSize = 512;
        context.createMediaStreamSource(media).connect(analyser);
        const data = new Uint8Array(analyser.fftSize);
        let lastPush = 0;
        const tick = (now: number) => {
          if (now - lastPush > 70) {
            lastPush = now;
            analyser.getByteTimeDomainData(data);
            let sum = 0;
            for (const sample of data) {
              const centered = (sample - 128) / 128;
              sum += centered * centered;
            }
            const level = Math.min(1, Math.sqrt(sum / data.length) * 3.2);
            setLevels((current) => [...current.slice(1), level]);
          }
          frame.current = requestAnimationFrame(tick);
        };
        frame.current = requestAnimationFrame(tick);
      }

      startedAt.current = performance.now();
      instance.start(250);
      setStatus("recording");
      timer.current = window.setInterval(() => {
        const elapsed = (performance.now() - startedAt.current) / 1000;
        setSeconds(elapsed);
        if (elapsed >= MAX_RECORDING_SECONDS) stop();
      }, 200);
    } catch (e) {
      teardown();
      const name = e instanceof DOMException ? e.name : "";
      setError(name === "NotAllowedError" || name === "SecurityError" ? "denied" : name === "NotFoundError" || name === "OverconstrainedError" ? "no-device" : "failed");
      setStatus("idle");
    }
  }, [revokeUrl, stop, teardown]);

  useEffect(
    () => () => {
      discard.current = true;
      if (recorder.current && recorder.current.state !== "inactive") recorder.current.stop();
      teardown();
      revokeUrl();
    },
    [revokeUrl, teardown],
  );

  return { status, error, seconds, levels, recording, start, stop, reset };
}
