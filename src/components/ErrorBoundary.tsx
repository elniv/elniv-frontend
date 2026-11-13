import { Component } from "react";
import type { ReactNode } from "react";
import { Mark } from "./Logo";
import { BRAND } from "../lib/brand";

interface State {
  failed: boolean;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error): void {
    console.error("Unhandled UI error:", error);
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="center-screen" role="alert">
        <div>
          <Mark size={72} motion="float" />
          <h1>Something slipped</h1>
          <p>Elniv ran into an unexpected problem. Reloading usually fixes it. Your conversations are safe.</p>
          <button type="button" className="btn btn--primary" onClick={() => window.location.reload()}>
            Reload
          </button>
          <p className="small faint">
            Still stuck? Write to <a href={`mailto:${BRAND.email}`}>{BRAND.email}</a>.
          </p>
        </div>
      </div>
    );
  }
}
