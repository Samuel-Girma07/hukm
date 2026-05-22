"use client";

import { useEffect, useState } from "react";

import { Icon } from "./Icon";
import { Spinner } from "./Spinner";

import { useT } from "@/contexts/LanguageContext";
import type {
  FeedbackRating,
  FeedbackStatusResponse,
  FeedbackSubmitResponse,
} from "@/lib/types";

interface FeedbackWidgetProps {
  analysisId: string;
}

type Phase = "idle" | "selected" | "submitting" | "submitted" | "error";

const COMMENT_MAX = 500;

export function FeedbackWidget({
  analysisId,
}: FeedbackWidgetProps): React.ReactElement {
  const t = useT();
  const [phase, setPhase] = useState<Phase>("idle");
  const [rating, setRating] = useState<FeedbackRating | null>(null);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(`/api/feedback/${analysisId}`);
        const data = (await response.json().catch(() => null)) as
          | FeedbackStatusResponse
          | null;
        if (!cancelled && data?.success && data.submitted) {
          setPhase("submitted");
          setRating(data.rating ?? null);
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [analysisId]);

  function pick(value: FeedbackRating): void {
    setRating(value);
    setPhase("selected");
    setError(null);
  }

  async function submit(): Promise<void> {
    if (rating === null) return;
    setPhase("submitting");
    setError(null);
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          analysisId,
          rating,
          comment: comment.trim() || undefined,
        }),
      });
      const data = (await response.json().catch(() => null)) as
        | FeedbackSubmitResponse
        | null;
      if (!response.ok || !data || !data.success) {
        const msg =
          data && !data.success && "error" in data
            ? data.error
            : `HTTP ${response.status}`;
        setError(msg);
        setPhase("error");
        return;
      }
      setPhase("submitted");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPhase("error");
    }
  }

  if (phase === "submitted") {
    return (
      <section className="flex flex-col items-center gap-2 border-y border-[rgb(var(--border-subtle))] py-6">
        <p className="text-[14px] text-on-surface-variant">
          {t("feedback.thanks")}
        </p>
        <Icon
          name={rating === 1 ? "thumb_up" : "thumb_down"}
          size={18}
          filled
          className={
            rating === 1
              ? "text-[rgb(var(--accent-cyan))]"
              : "text-[rgb(var(--accent-red))]"
          }
        />
      </section>
    );
  }

  return (
    <section className="flex flex-col items-center gap-3 border-y border-[rgb(var(--border-subtle))] py-6">
      <p className="text-[14px] text-on-surface-variant">
        {t("feedback.prompt")}
      </p>
      <div className="flex gap-2">
        <IconButton
          active={rating === 1}
          onClick={() => pick(1)}
          ariaLabel={t("feedback.thumbsUp")}
          tone="primary"
          icon="thumb_up"
        />
        <IconButton
          active={rating === -1}
          onClick={() => pick(-1)}
          ariaLabel={t("feedback.thumbsDown")}
          tone="error"
          icon="thumb_down"
        />
      </div>

      {phase === "selected" || phase === "submitting" || phase === "error" ? (
        <div className="flex w-full max-w-lg flex-col gap-2">
          <label
            htmlFor="feedback-comment"
            className="text-[11px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant"
          >
            {t("feedback.commentLabel")}
          </label>
          <textarea
            id="feedback-comment"
            rows={3}
            className="textarea text-[14px]"
            value={comment}
            placeholder={t("feedback.commentPlaceholder")}
            onChange={(event) => setComment(event.currentTarget.value)}
            maxLength={COMMENT_MAX}
            disabled={phase === "submitting"}
          />
          <div className="flex items-center justify-between gap-3">
            <span className="text-[12px] text-on-surface-variant">
              {t("feedback.commentLimit", {
                used: comment.length.toString(),
                max: COMMENT_MAX.toString(),
              })}
            </span>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={phase === "submitting"}
              className="btn-primary"
            >
              {phase === "submitting" ? (
                <>
                  <Spinner className="h-3 w-3" /> {t("feedback.submitting")}
                </>
              ) : (
                t("feedback.submit")
              )}
            </button>
          </div>
          {error ? (
            <p className="text-[12px] text-[rgb(var(--accent-red))]">{error}</p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

interface IconButtonProps {
  active: boolean;
  onClick: () => void;
  ariaLabel: string;
  tone: "primary" | "error";
  icon: string;
}

function IconButton({
  active,
  onClick,
  ariaLabel,
  tone,
  icon,
}: IconButtonProps): React.ReactElement {
  const activeClass =
    tone === "primary"
      ? "border-[rgb(var(--accent-cyan)/0.5)] bg-[rgb(var(--accent-cyan)/0.12)] text-[rgb(var(--accent-cyan))]"
      : "border-[rgb(var(--accent-red)/0.5)] bg-[rgb(var(--accent-red)/0.12)] text-[rgb(var(--accent-red))]";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={ariaLabel}
      className={
        active
          ? `inline-flex h-10 w-10 items-center justify-center rounded-full border transition-colors ${activeClass}`
          : "inline-flex h-10 w-10 items-center justify-center rounded-full border border-[rgb(var(--border-subtle))] bg-[rgb(var(--surface-elevated))] text-on-surface-variant transition-colors hover:bg-[rgb(var(--surface-overlay))] hover:text-on-surface"
      }
    >
      <Icon name={icon} size={18} filled={active} />
    </button>
  );
}
