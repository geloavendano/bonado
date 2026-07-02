const PALETTE = [
  "bg-av-1",
  "bg-av-2",
  "bg-av-3",
  "bg-av-4",
  "bg-av-5",
] as const;

/** Deterministic palette pick so the same person always renders the same color. */
export function avatarColorClass(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  const index = Math.abs(hash) % PALETTE.length;
  return PALETTE[index];
}

export function initial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}
