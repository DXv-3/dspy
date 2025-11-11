# Tampermonkey Dev Inspector helper

The Dev Inspector helper is a drop-in snippet you can paste into any Tampermonkey userscript. It renders a small floating panel that lets you point at elements, capture stable selectors, jot down notes, and (optionally) forward everything to a tiny backend for teammates.

## Install the helper

1. Create or open a Tampermonkey userscript.
2. Paste the [helper source](../../js/tampermonkey-inspector.js) right after the metadata block. The metadata for a blank script looks like this:
   ```javascript
   // ==UserScript==
   // @name         Dev Inspector helper
   // @namespace    https://dspy.ai/tampermonkey
   // @version      1.0
   // @description  Inspect DOM nodes and capture selectors quickly.
   // @match        *://*/*
   // @grant        none
   // ==/UserScript==

   // Paste the helper below this line.
   ```
3. Save the script and refresh the page you want to inspect. You should see an **Inspector** panel in the top-right corner. Drag the header to reposition it anywhere.

> 💡 **Optional:** host the helper locally and reference it with `@require` while iterating. That keeps the userscript tiny and makes updates instantaneous.

## Use the panel

The panel is organised into four sections. Everything works with plain mouse/keyboard input—no browser extensions beyond Tampermonkey are required.

### 1. Element summary

- Press **Start selecting** to turn on inspection mode.
- Hover the page: the active node is highlighted and the panel lists tag, id, classes, notable attributes, and a trimmed text preview.
- Click a node to lock it in place. Press **Clear** or hit `Esc` to reset.

### 2. Selectors

- Both a CSS selector and XPath are generated automatically for the active element.
- Use **Copy CSS** or **Copy XPath** to push the selector to your clipboard.
- You can keep the panel open while you test the selector straight from the browser console or your automation script.

### 3. Notes & snippet

- Hit **Add snippet** to append a ready-to-edit `document.querySelector` block to the notes area.
- Use the notes textarea to outline steps in your userscript. Everything stays local to the page until you copy it elsewhere.

### 4. Backend sync (optional)

Enable the backend panel by defining a tiny config before the helper loads:

```javascript
window.TampermonkeyInspectorConfig = {
  backend: {
    enabled: true,
    endpoint: 'http://localhost:8000/events',
    apiKey: 'dev-key',   // optional
    autoSend: false      // automatically POST when you add a snippet
  }
};
```

Once set, configure the endpoint or API key inside the panel. Press **Send selection** to POST the current payload, or tick **Send automatically after snippet** to forward the data whenever you add a snippet.

Payloads include:

- page URL and title
- ISO timestamp
- generated selectors
- the element summary
- the notes area contents
- the snippet produced by **Add snippet**

## Example backend and dashboard

A minimal FastAPI service plus static dashboard live under [`examples/tampermonkey_dev_inspector/`](../../../examples/tampermonkey_dev_inspector/).

```bash
cd examples/tampermonkey_dev_inspector/backend
uvicorn app:app --reload
```

Then open [`frontend/index.html`](../../../examples/tampermonkey_dev_inspector/frontend/index.html) in a browser. Enter the backend URL (defaults to `http://localhost:8000/events`) and optionally the API key you configured. The dashboard polls the backend and shows every selector the helper sends.

The backend stores events in memory so you can restart quickly during development. Extend it or swap it for your own service when you need persistence.
