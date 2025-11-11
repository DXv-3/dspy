# Tampermonkey Dev Inspector Helper

This lightweight helper gives you an on-page control panel for inspecting and scripting DOM interactions when you build Tampermonkey automations. It is designed to feel approachable even if you are new to front-end tooling, while still exposing the selectors and snippets developers need to wire reliable scripts.

## Why this tool exists

Tampermonkey is a flexible power tool, but figuring out which DOM nodes to target can still be tedious. The helper builds on the idea of "developer inspection" and wraps it in a friendlier interface:

- **Point-and-hover discovery** – visually highlight elements as you move the mouse.
- **One-click selector capture** – copy stable CSS selectors or XPath expressions.
- **Script building notes** – append ready-to-edit Tampermonkey snippets with the current target.
- **Minimal footprint** – a draggable floating panel that keeps out of your way.

Because the helper is pure JavaScript, you can paste it into any Tampermonkey script (or run it from the console) without external dependencies.

## Getting started

1. Open Tampermonkey and create a new userscript.
2. Copy the [helper source](../../js/tampermonkey-inspector.js) into your editor, right below the metadata block. The top of the script should look similar to the snippet below:

```javascript
// ==UserScript==
// @name         Dev Inspector Helper
// @namespace    https://dspy.ai/tampermonkey
// @version      1.0
// @description  Floating selection panel to speed up Tampermonkey DOM scripting.
// @match        *://*/*
// @grant        none
// ==/UserScript==

// Paste the helper below this line…
```

> 💡 **Tip:** If you keep the helper in a separate file during local development, you can import it with `@require` from a local server or a shared gist, making updates painless.

3. Save the userscript and refresh the target page.
4. A "Dev Inspector" badge appears in the top-right corner. Drag it wherever you want and press **Start** to begin selecting.

## Using the panel

The panel has three sections that guide you from discovery to scripting.

### 1. Selection controls

- **Start** – enter live selection mode. Hover elements on the page to see an outline and their summary. Click once to lock onto the current node.
- **Lock** – freeze the current highlight without leaving selection mode. Handy when you want to copy selectors before interacting with the page.
- **Clear** – remove highlights and reset the state.
- **Esc** – exits selection mode from the keyboard.

### 2. Selector toolbox

- The CSS and XPath representations auto-populate for the active element.
- **Copy CSS Selector** / **Copy XPath** – copy the current selector straight to your clipboard. Toast messages confirm the action.

### 3. Script builder notes

- **Add Step to Notes** – drops a starter snippet into the notes area, referencing the current element with `document.querySelector(...)`.
- Use the notes area to storyboard the automation you are writing. Because the textarea accepts plain text, you can copy/paste directly into your userscript afterwards.

## Quality-of-life extras

- **Draggable header** – drag the gradient header to reposition the panel so it never covers your work.
- **Smart summaries** – view tag, id, classes, and top attributes at a glance, along with a trimmed text preview.
- **Non-intrusive overlay** – highlights do not intercept mouse events, so you can keep browsing normally when paused.

## Extending the helper

The helper is intentionally small and self-contained. Feel free to:

- Add organization-specific shortcuts (for example, copy HTML or aria labels).
- Change the default snippets inserted by **Add Step** to match your coding style.
- Trigger other workflows (such as sending selectors to a REST endpoint) by adapting the copy handlers.

The source lives in [`docs/docs/js/tampermonkey-inspector.js`](../../js/tampermonkey-inspector.js). Duplicate it into your own project or keep it as a shared asset inside your team wiki.

## Syncing with a backend

The helper now ships with an optional **Backend Sync** section so you can log selectors to an API or collaborative dashboard. Configure it in three steps:

1. Define a global config before you load the helper (in Tampermonkey, place this above the helper source):

   ```javascript
   window.TampermonkeyInspectorConfig = {
     backend: {
       enabled: true,
       endpoint: 'http://localhost:8000/events',
       apiKey: 'dev-key',      // optional – removed if you disable auth
       autoSend: true          // automatically POST when you click “Add Step”
     }
   };
   ```

2. Open the **Backend Sync** section inside the panel and adjust the endpoint or toggle auto-send. Settings are cached per origin in `localStorage` so you only need to configure them once.
3. Use **Send current selection** to manually push the highlighted element to your API. Errors and timestamps surface inside the panel.

### Full-stack sample

A ready-to-run FastAPI backend plus lightweight dashboard live in `examples/tampermonkey_dev_inspector/` inside this repository:

- `backend/app.py` accepts the JSON payloads produced by the helper and stores them in-memory.
- `frontend/index.html` polls the backend and renders a timeline of captured selectors, generated snippets, and page metadata.

Follow the quick-start instructions in that README to spin up the backend, connect the dashboard, and watch new selectors stream in as you explore pages with the inspector.
