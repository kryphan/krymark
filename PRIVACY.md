# KryMark browser extension — Privacy Policy

_Last updated: 2026-07-18_

The KryMark browser extension is a client for **your own KryMark instance** (self-hosted or provided by your team). It is not a hosted service run by us — it only talks to the KryMark server URL you configure.

## What the extension stores

Locally in your browser (via `chrome.storage`), never sent to us:

- **Your instance URL** (e.g. `https://krymark.yourteam.com`).
- **Activated sites** — a map of which sites you're reviewing and which project each maps to, so the widget can persist across page reloads.
- Nothing else. No browsing history, no analytics, no tracking.

## What the extension sends, and to whom

When you submit a piece of feedback, the extension sends it **only to the KryMark instance URL you configured** — not to any third party and not to the extension's authors:

- Your feedback text, and optional name/email you type.
- Technical context of the element you selected: its HTML, computed styles, position, page URL, and an optional screenshot of that element.

This is the core function of the tool: turning your feedback into an actionable report on your own server. Where that data lives and how long it is retained is governed by **your KryMark instance**, which you or your team control.

## Permissions

- **Host access (`<all_urls>`) + `scripting` + `activeTab` + `tabs`** — required to inject the feedback widget into the page you choose to review, and to re-inject it after reloads on sites you've activated. The widget only runs on pages you explicitly activate.
- **`storage`** — to remember your instance URL and activated sites (above).

The extension does **not** read pages you haven't activated, does not run on every site automatically, and contains no ad, tracker, or analytics code.

## Authentication

To create or list projects, the extension uses your existing logged-in session with your KryMark instance (a same-origin request performed inside your dashboard tab). It never stores your password. It does not use an API key unless you explicitly add one in the extension's advanced options.

## Contact

Source code: https://github.com/kryphan/krymark — open an issue for questions.
