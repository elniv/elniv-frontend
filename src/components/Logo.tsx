import markUrl from "../assets/brand/elniv-mark.svg";
import { Link } from "../lib/router";

type Motion = "float" | "think" | undefined;

/** The one canonical Elniv mark (src/assets/brand/elniv-mark.svg). */
export function Mark({ size = 32, motion, className = "" }: { size?: number; motion?: Motion; className?: string }) {
  const motionClass = motion === "float" ? "mark--float" : motion === "think" ? "mark--think" : "";
  return <img src={markUrl} width={size} height={size} alt="" className={`mark ${motionClass} ${className}`.trim()} draggable={false} />;
}

export function Brand({ to = "/" }: { to?: string }) {
  return (
    <Link to={to} className="brand" aria-label="Elniv home">
      <Mark size={30} className="brand__mark" />
      <span className="brand__word">Elniv</span>
    </Link>
  );
}
