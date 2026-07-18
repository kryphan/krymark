# The feedback widget

One script tag. ~6KB gzip, vanilla JS, Shadow DOM (no style bleed either way), no cookies, no login for reviewers.

```html
<script src="https://YOUR-KRYMARK/w.js" data-key="YOUR_WIDGET_KEY" defer></script>
```

`data-key` comes from your project page. Paste before `</body>`.

## What reviewers see

1. A **Feedback** tab on the right edge of every page.
2. Tap it → "Tap the spot you want to comment on". Hovering highlights the *meaningful* element (auto-snap walks up from the raw target to something with visual identity — semantic tag, id, background, border or shadow — never a bare text node).
3. **Click** to pick — or **drag a box** around an area if auto-snap doesn't grab what they mean (the widget picks the element that encloses the box).
4. A sheet opens: one big text box (any language), optional name/email (auto-filled from their last note), an **↑ Bigger area** button, and a **screenshot preview** with a ✕ to remove it if it shows something private.
5. Send → "Sent ✓" with a **Send another** button. A **My notes (n)** counter in the hint bar lists everything they've sent on this site.

On screens narrower than 480px the sheet becomes a bottom sheet; selection works by tap.

## What gets captured

| Field | Notes |
|---|---|
| `selector` | CSS path at report time (anchor, not identity — code drifts) |
| `dom_html` | element `outerHTML`, server-capped at 64KB |
| `dom_text` | element inner text (first 400 chars) |
| `computed_style` | ~20 key computed styles |
| `position` | bounding rect + scroll offsets |
| `meta` | page URL, viewport, DPR, UA, `shot_error` when a screenshot failed |
| `screenshot` | webp of the exact element (see below) |

## Screenshots

Captured with [snapdom](https://github.com/zumerlab/snapdom), **self-hosted from your KryMark origin** (`/vendor/snapdom.mjs`, jsDelivr as fallback) so ad-blockers and third-party-script policies don't kill it. The module is warmed the moment picking starts; capture runs when the sheet opens so sending is instant. Two-stage retry (full quality → reduced scale) and re-compression instead of dropping oversized images. If everything fails, the note still sends — with `meta.shot_error` so you can measure the failure rate.

Cross-origin iframes and tainted canvases can't be captured — by design the DOM context is the load-bearing payload, the image is a bonus.

## Per-platform install

- **Lovable / Bolt / v0** — tell the AI: *"Add this script tag at the end of the body, keep it exactly as-is"* and paste the snippet.
- **Next.js** — in `app/layout.tsx`: `<Script src="https://YOUR-KRYMARK/w.js" data-key="…" strategy="afterInteractive" />` (`next/script`).
- **Webflow** — Site settings → Custom code → Footer.
- **WordPress** — any header/footer-scripts plugin, footer slot.
- **Plain HTML / Vite / CRA** — paste into `index.html` before `</body>`.

## CSP

If the host site sets a Content-Security-Policy, allow your KryMark origin in `script-src` (for `w.js` + the capture module) and `connect-src` (for the report POST).

## Behaviors worth knowing

- SPA route change mid-selection cancels the pick with a toast (the DOM they were pointing at is gone).
- Double-embed is a no-op (`window.__krymark` guard).
- Reporter identity (name/email) lives in `localStorage` on *their* browser only; the "My notes" trail is per-site key.
- The widget never talks to the database — it POSTs to `/api/report`, which validates, rate-limits and writes server-side.

## Reviewing WITHOUT touching the site's code

Two options when you can't (or don't want to) add the snippet:

1. **Bookmarklet** — on the project page, drag the "◉ Review" button to your bookmarks bar. Clicking it on any page injects the widget one-off. Caveat: blocked on sites with a strict `script-src` CSP.
2. **Browser extension** (`extension/` in the repo, Manifest V3, bundle included) — beats CSP because the widget runs in the extension's isolated world. Install: `chrome://extensions` → Developer mode → *Load unpacked* → pick the `extension/` folder.
   - **No API key.** Just be logged into your KryMark dashboard in the same browser. Open the popup → it lists your projects (create one right there too) → click a project → the widget appears on the current tab.
   - **Alt+C** — on any activated site, jump straight into element-pick mode (no clicking the Feedback tab).
   - **Persists across reloads** — once you activate a site, the widget re-injects on every page load until you hit *Stop* in the popup.
   - Or paste a project link (`<origin>/r/<widget_key>` or the `/p/…` dashboard URL) to review without logging in. Screenshots work too (the capture library is bundled).

Both send to the same `/api/report` pipeline — notes look identical to embed-widget notes.
