export const STAGES = [
  { id: "idea", label: "Idea" },
  { id: "researching", label: "Researching" },
  { id: "scripting", label: "Scripting" },
  { id: "filming", label: "Filming" },
  { id: "editing", label: "Editing" },
  { id: "scheduled", label: "Scheduled" },
  { id: "published", label: "Published" },
] as const;
export type StageId = (typeof STAGES)[number]["id"];

export const FORMATS = [
  { id: "long_video", label: "Long video" },
  { id: "short", label: "Short" },
  { id: "reel", label: "Reel" },
  { id: "tiktok", label: "TikTok" },
  { id: "carousel", label: "Carousel" },
] as const;

export { PLATFORMS, type PlatformId } from "./platforms";

export const PRIORITIES = [
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
  { id: "urgent", label: "Urgent" },
] as const;

export const labelOf = (list: readonly { id: string; label: string }[], id: string) =>
  list.find((x) => x.id === id)?.label ?? id;

/** Which formats a long video spawns when repurposed, and on which platform. */
export const REPURPOSE_TARGETS = [
  { format: "short", platform: "youtube", suffix: "Short" },
  { format: "reel", platform: "instagram", suffix: "Reel" },
  { format: "tiktok", platform: "tiktok", suffix: "TikTok" },
] as const;
