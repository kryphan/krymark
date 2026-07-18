// Embed entry — <script src=".../w.js" data-key="..."> (hoặc bookmarklet chèn đúng thẻ này)
import { bootKrymark } from "./core";

const script =
  (document.currentScript as HTMLScriptElement | null) ??
  document.querySelector<HTMLScriptElement>("script[data-key][src*='w.js']");
if (script?.dataset.key) {
  bootKrymark(script.dataset.key, new URL(script.src).origin, script.dataset.lang);
}
