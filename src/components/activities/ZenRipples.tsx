import { useState, useRef, useEffect } from "react";
import { Icon } from "../Icon";

interface Ripple {
  id: string;
  x: number;
  y: number;
}

export function ZenRipples() {
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const [rippleCount, setRippleCount] = useState(0);
  const poolRef = useRef<HTMLDivElement>(null);
  const timeoutsRef = useRef<Set<number>>(new Set());

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!poolRef.current) return;
    const rect = poolRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const newRipple: Ripple = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      x,
      y,
    };

    // Keep max 16 active ripples to ensure smooth 60fps performance
    setRipples((prev) => [...prev.slice(-15), newRipple]);
    setRippleCount((c) => c + 1);

    // Auto-remove ripple after animation ends (2.8s)
    const timeoutId = window.setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== newRipple.id));
      timeoutsRef.current.delete(timeoutId);
    }, 2800);

    timeoutsRef.current.add(timeoutId);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    timeoutsRef.current.forEach((t) => window.clearTimeout(t));
    timeoutsRef.current.clear();
    setRipples([]);
  };

  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach((t) => window.clearTimeout(t));
      timeoutsRef.current.clear();
    };
  }, []);

  return (
    <div className="ripples-container">
      <div className="ripples-header">
        <h2 className="ripples-title">Zen Water Ripples</h2>
        <p className="ripples-subtitle">
          Tap anywhere. Let your thoughts settle like the water.
        </p>
      </div>

      <div
        ref={poolRef}
        className="ripples-pool"
        onPointerDown={handlePointerDown}
        role="button"
        tabIndex={0}
        aria-label="Interactive water pool. Tap anywhere to create calming ripples."
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            if (poolRef.current) {
              const rect = poolRef.current.getBoundingClientRect();
              handlePointerDown({
                clientX: rect.left + rect.width / 2,
                clientY: rect.top + rect.height / 2,
                currentTarget: poolRef.current,
              } as unknown as React.PointerEvent<HTMLDivElement>);
            }
          }
        }}
      >
        <div className="ripples-ambient-light" />

        {ripples.length === 0 && (
          <div className="ripples-hint">
            <Icon name="waves" size={24} style={{ opacity: 0.6, marginBottom: 8 }} />
            <span>Tap the water surface</span>
          </div>
        )}

        {ripples.map((r) => (
          <div
            key={r.id}
            className="ripple-origin"
            style={{ left: `${r.x}px`, top: `${r.y}px` }}
          >
            <div className="ripple-ring ripple-ring--1" />
            <div className="ripple-ring ripple-ring--2" />
            <div className="ripple-ring ripple-ring--3" />
            <div className="ripple-core" />
          </div>
        ))}

        <div className="ripples-hud">
          <span className="ripples-count">
            {rippleCount > 0 ? `${rippleCount} ${rippleCount === 1 ? "ripple" : "ripples"}` : "Still water"}
          </span>
          {ripples.length > 0 && (
            <button
              type="button"
              className="btn btn--ghost btn--sm ripples-reset-btn"
              onClick={handleClear}
              aria-label="Let water become still"
            >
              Let Settle
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
