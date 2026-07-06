type RefreshHandler = () => void | Promise<void>;

const handlers = new Set<RefreshHandler>();

export function registerDataRefresh(handler: RefreshHandler) {
  handlers.add(handler);
  return () => {
    handlers.delete(handler);
  };
}

export async function refreshVisibleData() {
  await Promise.allSettled([...handlers].map((handler) => handler()));
}
