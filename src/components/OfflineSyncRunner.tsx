import { useEffect, useState } from "react";
import {
  flushExpenseQueue,
  readExpenseQueue,
} from "@/lib/offlineExpenseQueue";

export function OfflineSyncRunner() {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(() => readExpenseQueue().length);

  useEffect(() => {
    let timer = 0;
    async function sync() {
      const before = readExpenseQueue().length;
      setPending(before);
      if (before === 0) return;
      const result = await flushExpenseQueue();
      setPending(result.remaining);
      if (result.synced > 0) {
        setMessage(
          result.synced === 1
            ? "Offline expense synced."
            : `${result.synced} offline expenses synced.`,
        );
        timer = window.setTimeout(() => setMessage(null), 3000);
      }
    }
    void sync();
    window.addEventListener("online", sync);
    const updateCount = () => setPending(readExpenseQueue().length);
    window.addEventListener("bonado:offline-queue-change", updateCount);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("bonado:offline-queue-change", updateCount);
      window.clearTimeout(timer);
    };
  }, []);

  if (!message && pending === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[120] flex justify-center px-6">
      <div className="rounded-pill bg-ink px-4 py-2.5 text-[12.5px] font-bold text-bg shadow-[var(--shadow-floating)]">
        {message ??
          (pending === 1
            ? "1 expense waiting to sync"
            : `${pending} expenses waiting to sync`)}
      </div>
    </div>
  );
}
