import { useEffect } from "react";
import { useShareIntent } from "expo-share-intent";
export default function ShareCapture({
  ready,
  onCapture,
  onError,
}: {
  ready: boolean;
  onCapture: (text: string) => void;
  onError: (text: string) => void;
}) {
  const { hasShareIntent, shareIntent, resetShareIntent, error } =
    useShareIntent();
  useEffect(() => {
    if (!ready || !hasShareIntent) return;
    const text = shareIntent.text ?? shareIntent.webUrl;
    if (text) onCapture(text.slice(0, 20000));
    resetShareIntent();
  }, [ready, hasShareIntent, shareIntent]);
  useEffect(() => {
    if (error)
      onError(
        "Could not receive this shared content. Copy the text or link into Capture.",
      );
  }, [error]);
  return null;
}
