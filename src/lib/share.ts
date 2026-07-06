import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";

export async function shareLink(input: {
  title: string;
  text: string;
  url: string;
}): Promise<"shared" | "copied" | "failed"> {
  if (Capacitor.isNativePlatform()) {
    try {
      await Share.share(input);
      return "shared";
    } catch {
      return "failed";
    }
  }
  if (navigator.share) {
    try {
      await navigator.share(input);
      return "shared";
    } catch {
      // A cancelled browser share can still fall back to copying.
    }
  }
  try {
    await navigator.clipboard.writeText(input.url);
    return "copied";
  } catch {
    return "failed";
  }
}
