from pathlib import Path

p = Path('frontend/src/pages/Classroom.jsx')
s = p.read_text()
replacements = [
("const liveRef = useRef(new Map()), committedRef = useRef(new Set()), pendingLiveRef = useRef(null), snapshotTimerRef = useRef(null), disposedRef = useRef(false), imageCacheRef = useRef(new Map()), reliableStrokeTimerRef = useRef(null);",
 "const liveRef = useRef(new Map()), committedRef = useRef(new Set()), pendingLiveRef = useRef(null), snapshotTimerRef = useRef(null), disposedRef = useRef(false), imageCacheRef = useRef(new Map()), reliableStrokeTimerRef = useRef(null), slideControlActiveRef = useRef(false);"),
("const saveSnapshot = useCallback(() => { clearTimeout(snapshotTimerRef.current); snapshotTimerRef.current = setTimeout(async () => { const imageBase64 = canvasRef.current?.toDataURL(\"image/png\"); send({ type: \"save_snapshot\", page_number: slideRef.current, canvas_json: { strokes: currentStrokes().map((s) => ({ ...s })) }, image_base64: imageBase64 }); }, 500); }, [currentStrokes, send]);",
 "const saveSnapshot = useCallback(() => { clearTimeout(snapshotTimerRef.current); snapshotTimerRef.current = setTimeout(async () => { const pageNumber = slideRef.current; const imageBase64 = canvasRef.current?.toDataURL(\"image/png\"); send({ type: \"save_snapshot\", page_number: pageNumber, canvas_json: { strokes: (strokesByPageRef.current.get(pageNumber) || []).map((s) => ({ ...s })) }, image_base64: imageBase64 }); }, 500); }, [send]);\n  const saveSnapshotNow = useCallback((pageNumber) => { clearTimeout(snapshotTimerRef.current); const imageBase64 = canvasRef.current?.toDataURL(\"image/png\"); send({ type: \"save_snapshot\", page_number: pageNumber, canvas_json: { strokes: (strokesByPageRef.current.get(pageNumber) || []).map((s) => ({ ...s })) }, image_base64: imageBase64 }); }, [send]);"),
("const changeSlide = (target) => { if (!isTeacher) return; const next = clamp(target, 1, slidesRef.current.length); if (next === slideRef.current) return; saveSnapshot(); slideRef.current = next; setSlide(next); strokesByPageRef.current.set(next, strokesByPageRef.current.get(next) || []); const payload = { kind: \"page\", page_number: next }; publishControl(payload); send({ type: \"whiteboard_event\", payload }); };",
 "const changeSlide = (target) => { if (!isTeacher) return; const current = slideRef.current; const next = clamp(target, 1, slidesRef.current.length); if (next === current) return; saveSnapshotNow(current); slideControlActiveRef.current = true; slideRef.current = next; setSlide(next); strokesByPageRef.current.set(next, strokesByPageRef.current.get(next) || []); publishControl({ kind: \"page\", page_number: next }); };"),
("const addSlide = () => { if (!isTeacher) return; saveSnapshot(); const next = slidesRef.current.length + 1; strokesByPageRef.current.set(next, []); const updated = [...slidesRef.current, { page_number: next, image_url: null }]; slidesRef.current = updated; setSlides(updated); slideRef.current = next; setSlide(next); const payload = { kind: \"slides\", pages: updated, page_number: next }; publishControl(payload); send({ type: \"whiteboard_event\", payload }); setTimeout(() => send({ type: \"save_snapshot\", page_number: next, canvas_json: { strokes: [] } }), 50); };",
 "const addSlide = () => { if (!isTeacher) return; const current = slideRef.current; saveSnapshotNow(current); const next = slidesRef.current.length + 1; strokesByPageRef.current.set(next, []); const updated = [...slidesRef.current, { page_number: next, image_url: null }]; slidesRef.current = updated; setSlides(updated); slideRef.current = next; setSlide(next); slideControlActiveRef.current = true; publishControl({ kind: \"slides\", pages: updated, page_number: next }); };"),
("if (msg.type === \"whiteboard_state\") {\n          const p = msg.pages?.length ? msg.pages : [{ page_number: msg.page_number || 1, image_url: msg.image_url || null }];",
 "if (msg.type === \"whiteboard_state\") {\n          if (slideControlActiveRef.current) return;\n          const p = msg.pages?.length ? msg.pages : [{ page_number: msg.page_number || 1, image_url: msg.image_url || null }];"),
("if (msg.type === \"whiteboard_event\") {\n          const p = msg.payload || {};\n          if (p.kind === \"stroke\" && p.stroke) {",
 "if (msg.type === \"whiteboard_event\") {\n          const p = msg.payload || {};\n          if (p.kind === \"page\" || p.kind === \"slides\" || p.kind === \"pdf\") return;\n          if (p.kind === \"stroke\" && p.stroke) {"),
("if (msg.type === \"classroom_control\" && topic === CONTROL_TOPIC) {\n            const p = msg.payload || {};",
 "if (msg.type === \"classroom_control\" && topic === CONTROL_TOPIC) {\n            const p = msg.payload || {};\n            slideControlActiveRef.current = true;"),
("const payload = { kind: \"pdf\", pages: next }; publishControl(payload); send({ type: \"whiteboard_event\", payload });",
 "const payload = { kind: \"pdf\", pages: next }; slideControlActiveRef.current = true; publishControl(payload);"),
]
for old, new in replacements:
    if old not in s:
        raise SystemExit(f'Missing expected source fragment: {old[:100]}')
    s = s.replace(old, new, 1)
for old, new in [
("strokesByPageRef.current = new Map(next.map((x) => [x.page_number, strokesByPageRef.current.get(x.page_number) || []]));\n              setTimeout(redraw, 0);",
 "strokesByPageRef.current = new Map(next.map((x) => [x.page_number, strokesByPageRef.current.get(x.page_number) || []]));"),
("strokesByPageRef.current.set(next, strokesByPageRef.current.get(next) || []);\n              setTimeout(redraw, 0);",
 "strokesByPageRef.current.set(next, strokesByPageRef.current.get(next) || []);"),
("strokesByPageRef.current = new Map(next.map((x) => [x.page_number, []]));\n              setTimeout(redraw, 0);",
 "strokesByPageRef.current = new Map(next.map((x) => [x.page_number, []]));"),
]:
    if old not in s:
        raise SystemExit(f'Missing redraw fragment: {old[:100]}')
    s = s.replace(old, new, 1)
p.write_text(s)
print('Patched Classroom.jsx')
