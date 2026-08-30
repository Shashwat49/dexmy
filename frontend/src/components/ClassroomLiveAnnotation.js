// Live whiteboard transport helpers. Strokes are streamed as point batches while
// the pointer is moving; the completed stroke is still sent as the authoritative
// whiteboard_event for persistence/undo.
export const LIVE_STROKE_INTERVAL_MS = 16;
export const makeLiveStrokeMessage = (stroke, page_number, final = false) => ({
  type: "whiteboard_live",
  payload: { stroke, page_number, final },
});
