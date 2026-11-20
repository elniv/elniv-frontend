import { useEffect, useState } from "react";
import { Icon } from "../components/Icon";
import { usePageMeta } from "../lib/hooks";
import { navigate, useLocation } from "../lib/router";
import { GentleBreathing } from "../components/activities/GentleBreathing";
import { ZenRipples } from "../components/activities/ZenRipples";
import { MindfulJournal } from "../components/activities/MindfulJournal";

export type ActivityId = "breathing" | "ripples" | "journal";

interface ActivityCardDef {
  id: ActivityId;
  title: string;
  tag: string;
  duration: string;
  description: string;
  icon: "wind" | "waves" | "book";
}

const ACTIVITIES: ActivityCardDef[] = [
  {
    id: "breathing",
    title: "Gentle Breathing",
    tag: "4-3-4.5 Rhythm",
    duration: "2–5 mins",
    description: "An expanding and contracting orb that guides your inhalation, hold, and exhalation to ease tension.",
    icon: "wind",
  },
  {
    id: "ripples",
    title: "Zen Water Ripples",
    tag: "Visual Meditation",
    duration: "1–3 mins",
    description: "Tap anywhere on the serene pool to create expanding ripples, letting your thoughts settle like still water.",
    icon: "waves",
  },
  {
    id: "journal",
    title: "Mindful Journal",
    tag: "Gentle Reflection",
    duration: "3–5 mins",
    description: "A distraction-free writing sanctuary with rotating gentle prompts to help untangle your thoughts.",
    icon: "book",
  },
];

export function ActivitiesPage() {
  usePageMeta("Activities & Reset");
  const { search } = useLocation();
  const toolParam = search.get("tool");

  const [selectedActivity, setSelectedActivity] = useState<ActivityId | null>(() => {
    if (toolParam === "breathing" || toolParam === "ripples" || toolParam === "journal") {
      return toolParam;
    }
    return null;
  });

  useEffect(() => {
    if (toolParam === "breathing" || toolParam === "ripples" || toolParam === "journal") {
      setSelectedActivity(toolParam);
    }
  }, [toolParam]);

  const handleBack = () => {
    setSelectedActivity(null);
    if (search.get("tool")) {
      navigate("/activities", { replace: true });
    }
  };

  const activeDef = ACTIVITIES.find((a) => a.id === selectedActivity);

  return (
    <div className="activities-page">
      {selectedActivity === null ? (
        <>
          <header className="activities-header">
            <h1 className="activities-greeting">A quiet space to reset.</h1>
            <p className="activities-subtitle">
              Choose an unhurried visual meditation, breathing rhythm, or mindful reflection to steady your mind.
            </p>
          </header>

          <div className="activities-grid" role="list">
            {ACTIVITIES.map((act) => (
              <div
                key={act.id}
                role="listitem"
                tabIndex={0}
                className="activity-card"
                onClick={() => setSelectedActivity(act.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedActivity(act.id);
                  }
                }}
              >
                <div>
                  <div className="activity-card__top">
                    <div className="activity-card__icon-wrap">
                      <Icon name={act.icon} size={24} />
                    </div>
                    <span className="activity-card__tag">{act.tag}</span>
                  </div>

                  <div className="activity-card__body" style={{ marginTop: 16 }}>
                    <h2>{act.title}</h2>
                    <p>{act.description}</p>
                  </div>
                </div>

                <div className="activity-card__footer">
                  <span>{act.duration}</span>
                  <span className="activity-card__action">
                    Begin <Icon name="arrow" size={16} />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="activity-session">
          <div className="activity-nav-bar">
            <button
              type="button"
              className="activity-back-link"
              onClick={handleBack}
              aria-label="Return to all activities"
            >
              <span aria-hidden="true">&larr;</span> Back to activities
            </button>
            {activeDef && (
              <span className="activity-card__tag" style={{ marginLeft: "auto" }}>
                {activeDef.tag}
              </span>
            )}
          </div>

          {selectedActivity === "breathing" && <GentleBreathing />}
          {selectedActivity === "ripples" && <ZenRipples />}
          {selectedActivity === "journal" && <MindfulJournal />}
        </div>
      )}
    </div>
  );
}
