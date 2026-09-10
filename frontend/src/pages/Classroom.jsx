import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Room, RoomEvent, Track } from "livekit-client";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import "../classroom-media-fix.js";
import "./Classroom.css";

const attachMedia = (track, containerId, muted = false) => {
  if (!track) return;
  const box = document.getElementById(containerId);
  if (!box) return;
  if (track.kind === Track.Kind.Video) box.querySelectorAll("video").forEach((el) => el.remove());
  else box.querySelectorAll("audio").forEach((el) => el.remove());
  const el = track.attach();
  el.autoplay = true;
  el.playsInline = true;
  el.muted = muted;
  if (track.kind === Track.Kind.Video) el.className = "absolute inset-0 w-full h-full object-contain bg-black";
  box.appendChild(el);
  if (track.kind === Track.Kind.Audio && !muted) el.play?.().catch(() => {});
