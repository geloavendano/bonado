interface EntryVersion {
  id: string;
  created_at: string;
  last_edited_at: string | null;
}

function storageKey(userId: string) {
  return `bonado:seen-entries:${userId}`;
}

function readSeenMap(userId: string): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(storageKey(userId)) ?? "{}") as Record<
      string,
      string
    >;
  } catch {
    return {};
  }
}

export function isEntryUnread(entry: EntryVersion, userId: string) {
  const seenAt = readSeenMap(userId)[entry.id];
  if (!seenAt) return true;
  const latestChange = entry.last_edited_at ?? entry.created_at;
  return new Date(latestChange).getTime() > new Date(seenAt).getTime();
}

export function markEntryRead(entry: EntryVersion, userId: string) {
  const seen = readSeenMap(userId);
  seen[entry.id] = new Date().toISOString();
  localStorage.setItem(storageKey(userId), JSON.stringify(seen));
}
