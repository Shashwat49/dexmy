import { useEffect, useRef } from "react";

/**
 * Keeps LiveKit screen-share video in the classroom's main stage.
 * It observes the existing LiveKit media containers so this is independent
 * of the media SDK's internal DOM implementation.
 */
export default function ClassroomScreenShareFix() {
  const previousMainVideos = useRef([]);

  useEffect(() => {
    const main = document.getElementById("main-classroom-stage");
    const local = document.getElementById("local-stage");
    const remote = document.getElementById("remote-stage");
    if (!main || !local || !remote) return undefined;

    const isLikelyScreenShare = (video) => {
      const track = video?.srcObject?.getVideoTracks?.()[0];
      if (!track) return false;
      const settings = track.getSettings?.() || {};
      const ratio = settings.width && settings.height ? settings.width / settings.height : 0;
      const label = String(track.label || "").toLowerCase();
      return ratio > 1.45 || /screen|display|window|tab/.test(label);
    };

    const sync = () => {
      const candidates = [
        ...local.querySelectorAll("video"),
        ...remote.querySelectorAll("video"),
      ];
      const screenVideo = candidates.find(isLikelyScreenShare);
      const old = main.querySelector("video");

      if (screenVideo) {
        if (old !== screenVideo) {
          if (old) old.remove();
          previousMainVideos.current = [screenVideo];
          screenVideo.classList.remove("object-cover");
          screenVideo.classList.add("object-contain");
          screenVideo.style.position = "absolute";
          screenVideo.style.inset = "0";
          screenVideo.style.width = "100%";
          screenVideo.style.height = "100%";
          screenVideo.style.objectFit = "contain";
          screenVideo.style.background = "#000";
          main.appendChild(screenVideo);
        }
        main.dataset.screenSharing = "true";
      } else {
        if (old) old.remove();
        main.dataset.screenSharing = "false";
        window.dispatchEvent(new CustomEvent("dexmy:screen-share-stopped"));
      }
    };

    const observer = new MutationObserver(sync);
    observer.observe(local, { childList: true, subtree: true });
    observer.observe(remote, { childList: true, subtree: true });
    const timer = window.setInterval(sync, 500);
    sync();

    return () => {
      observer.disconnect();
      window.clearInterval(timer);
      const video = main.querySelector("video");
      if (video) video.remove();
    };
  }, []);

  return null;
}
