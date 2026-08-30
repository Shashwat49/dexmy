import { useEffect } from "react";

export default function ClassroomScreenShareFix() {
  useEffect(() => {
    const find = () => ({ canvas: document.querySelector("canvas"), local: document.getElementById("local-stage"), remote: document.getElementById("remote-stage") });
    let refs = find();
    if (!refs.canvas || !refs.local || !refs.remote) return undefined;
    const board = refs.canvas.parentElement;
    if (!board) return undefined;

    const stage = document.createElement("div");
    Object.assign(stage.style, { position: "absolute", inset: "0", zIndex: "40", display: "none", overflow: "hidden", background: "#000", borderRadius: "inherit" });
    board.appendChild(stage);
    const label = document.createElement("div");
    Object.assign(label.style, { position: "absolute", top: "12px", left: "12px", zIndex: "3", padding: "6px 9px", borderRadius: "8px", background: "rgba(0,0,0,.68)", color: "white", font: "500 11px system-ui,sans-serif", pointerEvents: "none" });
    stage.appendChild(label);

    const isScreen = (video) => {
      const track = video?.srcObject?.getVideoTracks?.()[0];
      if (!track) return false;
      const s = track.getSettings?.() || {};
      if (s.displaySurface) return true;
      const n = String(track.label || "").toLowerCase();
      return /screen|display|window|tab|monitor/.test(n);
    };

    const sync = () => {
      refs = find();
      if (!refs.canvas || !refs.local || !refs.remote) return;
      const videos = [...refs.local.querySelectorAll("video"), ...refs.remote.querySelectorAll("video")];
      const share = videos.find(isScreen);
      const current = stage.querySelector("video");
      if (share) {
        if (current !== share) {
          current?.remove();
          share.remove();
          Object.assign(share.style, { position: "absolute", inset: "0", width: "100%", height: "100%", objectFit: "contain", background: "#000" });
          stage.appendChild(share);
        }
        label.textContent = (share.closest("#local-stage") ? "Your screen" : "Participant screen") + " · Screen sharing";
        stage.style.display = "block";
        refs.canvas.style.visibility = "hidden";
      } else {
        current?.remove();
        stage.style.display = "none";
        refs.canvas.style.visibility = "visible";
      }
    };

    const observer = new MutationObserver(sync);
    observer.observe(refs.local, { childList: true, subtree: true });
    observer.observe(refs.remote, { childList: true, subtree: true });
    const interval = window.setInterval(sync, 400);
    sync();
    return () => { observer.disconnect(); window.clearInterval(interval); stage.remove(); if (refs.canvas) refs.canvas.style.visibility = "visible"; };
  }, []);
  return null;
}
