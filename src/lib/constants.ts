export const PRIORITY_LANES = ["skeleton", "mvp", "lovable"] as const;
export type PriorityLane = (typeof PRIORITY_LANES)[number];

export const EFFORT_LEVELS = ["xs", "s", "m", "l", "xl"] as const;
export type EffortLevel = (typeof EFFORT_LEVELS)[number];

export const LANE_LABELS: Record<PriorityLane, string> = {
  skeleton: "Skeleton",
  mvp: "MVP",
  lovable: "Lovable",
};

export const LANE_TO_DB = {
  skeleton: "SKELETON",
  mvp: "MVP",
  lovable: "LOVABLE",
} as const;

export const DB_TO_LANE = {
  SKELETON: "skeleton",
  MVP: "mvp",
  LOVABLE: "lovable",
} as const;

export const EFFORT_TO_DB = {
  xs: "XS",
  s: "S",
  m: "M",
  l: "L",
  xl: "XL",
} as const;

export const DB_TO_EFFORT = {
  XS: "xs",
  S: "s",
  M: "m",
  L: "l",
  XL: "xl",
} as const;

export const SESSION_COOKIE = "usm_session";

export const SAVE_DEBOUNCE_MS = 450;
