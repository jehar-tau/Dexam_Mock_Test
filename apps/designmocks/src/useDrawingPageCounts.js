import { useCallback, useEffect, useRef, useState } from "react";
import { drawingInventory } from "./drawing-upload.js";

// Read only the current student's receipts. A confirmed upload or removal wins
// over a slower catalogue read that started before it.
export function useDrawingPageCounts(attempt, rpc) {
  const [counts, setCounts] = useState({});
  const revisions = useRef({});
  const report = useCallback((questionId, count) => {
    revisions.current[questionId] = (revisions.current[questionId] || 0) + 1;
    setCounts(current => current[questionId] === count ? current : { ...current, [questionId]: count });
  }, []);
  const id = attempt?.id;
  const keys = attempt?.status === "active"
    ? attempt.questions.filter(q => q.kind === "drawing").map(q => q.id).join(",") : "";
  useEffect(() => {
    if (!keys || !id) return;
    const controller = new AbortController();
    let loading = false;
    async function refresh() {
      if (loading || document.hidden) return;
      loading = true;
      const ids = keys.split(",");
      for (let offset = 0; offset < ids.length && !controller.signal.aborted; offset += 4) {
        await Promise.all(ids.slice(offset, offset + 4).map(async questionId => {
          const revision = revisions.current[questionId];
          let count = null;
          try {
            const items = await rpc("my_drawing_uploads", { p_attempt_id: id, p_question_id: questionId }, controller.signal);
            count = drawingInventory({ items }).length;
          } catch { /* The numeric total stays unavailable until a fresh receipt is confirmed. */ }
          if (!controller.signal.aborted && revision === revisions.current[questionId]) {
            setCounts(current => current[questionId] === count ? current : { ...current, [questionId]: count });
          }
        }));
      }
      loading = false;
    }
    void refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    return () => {
      controller.abort();
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
    };
  }, [id, keys, rpc]);
  return { counts, report };
}
