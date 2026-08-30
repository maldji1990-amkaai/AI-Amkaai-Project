import { VIDEO_CLIP_LENGTH_SECONDS, VIDEO_CREDITS_PER_SECOND } from "@/lib/config";

export function normalizeVideoDuration(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error("INVALID_VIDEO_DURATION");
  const seconds = Math.ceil(n);
  if (seconds < 1) throw new Error("INVALID_VIDEO_DURATION");
  return seconds;
}

export function getVideoClipCount(seconds: number) {
  return Math.ceil(seconds / VIDEO_CLIP_LENGTH_SECONDS);
}

export function getVideoCreditCost(seconds: number) {
  return Math.max(1, Math.ceil(seconds)) * VIDEO_CREDITS_PER_SECOND;
}

export function getClipDurations(seconds: number) {
  const count = getVideoClipCount(seconds);
  return Array.from({ length: count }, (_, i) =>
    i === count - 1 ? seconds - VIDEO_CLIP_LENGTH_SECONDS * i : VIDEO_CLIP_LENGTH_SECONDS
  );
}
