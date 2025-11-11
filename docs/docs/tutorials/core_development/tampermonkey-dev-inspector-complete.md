# Tampermonkey Dev Inspector: Complete System Guide

This guide stitches together every piece of the Tampermonkey Dev Inspector stack that has been introduced across previous updates. It combines the front-end helper, the optional backend, the dashboard, and the accompanying documentation into a single reference so you can review, run, and extend the full workflow without hunting across multiple files.

## Contents

1. [System Overview](#system-overview)
2. [Quick Start Checklist](#quick-start-checklist)
3. [Tampermonkey Helper Panel](#tampermonkey-helper-panel)
4. [Backend API Service](#backend-api-service)
5. [Polling Dashboard](#polling-dashboard)
6. [Operations and Extension Tips](#operations-and-extension-tips)
7. [Full Source Listings](#full-source-listings)
8. [Additional References](#additional-references)
9. [Closing Notes](#closing-notes)

## System Overview

The Dev Inspector system is a full-stack toolkit that helps teams capture DOM element details while scripting Tampermonkey automations.

- **Helper panel (userscript snippet):** Renders a draggable overlay that highlights hovered elements, builds CSS and XPath selectors, keeps scratch notes, and can POST the captured payload to an API.
- **Backend FastAPI service:** Receives posted selections, stores them in memory, exposes a small REST API, and supports optional API key validation for basic auth.
- **Polling dashboard:** A lightweight HTML page that polls the backend and visualises the collected selections for collaborators.
- **Documentation:** Tutorials explain how to install, operate, and customise each piece so your team can adopt the workflow quickly.

## Quick Start Checklist

Follow these steps to get the entire stack running end-to-end in just a few minutes:

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-org/your-fork.git
   cd your-fork
   ```
2. **Launch the backend (optional but recommended):**
   ```bash
   cd examples/tampermonkey_dev_inspector/backend
   uvicorn app:app --reload
   ```
3. **Open the dashboard:**
   ```bash
   open ../frontend/index.html
   # or double-click the file and allow it to run JavaScript in your browser
   ```
4. **Install the helper in Tampermonkey:**
   - Create a new userscript.
   - Paste the helper source below the metadata block (see [Full Source Listings](#full-source-listings)).
   - Refresh the page you want to inspect.
5. **Start selecting elements:**
   - Click **Start selecting** in the panel.
   - Hover and lock elements.
   - Add snippets or notes.
   - Post data to your backend when ready.
6. **Monitor captured data:**
   - Keep the dashboard open to view incoming selections.
   - Use the payload details to script your automation or share selectors with teammates.

## Tampermonkey Helper Panel

The helper is a self-contained snippet designed to be pasted into any Tampermonkey script. Key capabilities include:

- **Selection mode:** Highlights hovered elements, captures metadata, and locks targets on click.
- **Selector generation:** Builds CSS and XPath expressions automatically, ready for copy/paste.
- **Notes and snippets:** Appends a templated `document.querySelector` snippet and keeps free-form notes so you can outline automation steps while you inspect.
- **Backend sync:** Optional panel allows you to configure an endpoint, API key, and auto-send behaviour. Payloads include the page URL, timestamp, selectors, summary, and notes.

### Installation steps

1. Create or open a Tampermonkey script.
2. Paste the helper source beneath the metadata block. You can inline it or reference the hosted file with `@require` while developing.
3. (Optional) Define `window.TampermonkeyInspectorConfig` before the snippet to preconfigure backend defaults.
4. Save the script and refresh the target page.

### Panel usage tips

- Press **Start selecting** to begin inspection; press **Clear** or `Esc` to reset.
- Use the copy buttons beside each selector to push values to the clipboard instantly.
- Hit **Add snippet** to append a ready-to-edit boilerplate to your notes, then expand on it with actual automation logic.
- Toggle **Send automatically after snippet** if you want every snippet addition to POST immediately.
- Watch the status banner for confirmation of successful or failed API calls.

## Backend API Service

The optional backend lives under `examples/tampermonkey_dev_inspector/backend`. It provides:

- `POST /events`: Accepts payloads from the helper. Supports a shared `x-api-key` header when you configure `state.backend.apiKey` in the panel.
- `GET /events`: Returns all stored events so dashboards or tools can display them.
- In-memory storage so you can iterate quickly without a database. Replace the store with your own persistence layer when needed.

### Running locally

```bash
cd examples/tampermonkey_dev_inspector/backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --reload
```

The API listens on `http://127.0.0.1:8000` by default. Update the helper panel with that endpoint and the optional API key you defined.

### Extending the service

- Swap the in-memory storage for a database by replacing the `EventStore` class.
- Add authentication or rate limiting middleware if exposing the service beyond localhost.
- Emit webhooks or append to logs by augmenting the `create_event` endpoint.

## Polling Dashboard

A static HTML dashboard under `examples/tampermonkey_dev_inspector/frontend/index.html` polls the backend and lists captured selections.

### Features

- Configurable backend URL and API key inputs.
- Auto-refresh interval to keep the feed live while you capture selectors.
- Collapsible event cards with selectors, element summaries, notes, and raw JSON payloads.

### Running

Open the HTML file directly in a browser (no build step required). If your browser blocks local fetch calls, serve the folder via a simple static server:

```bash
cd examples/tampermonkey_dev_inspector/frontend
python -m http.server 9000
# visit http://localhost:9000/index.html
```

## Operations and Extension Tips

- **Version control:** Keep a copy of the helper script in your repo so your whole team can `@require` the latest iteration.
- **Custom payloads:** Modify `summarizeElement` or the payload builder in the helper to include extra attributes relevant to your workflows.
- **Automation integration:** Feed selectors from the backend directly into your testing or RPA framework, or trigger downstream jobs whenever a new event lands.
- **Team onboarding:** Share this single document alongside the Tampermonkey script to give newcomers the full context in one place.

## Full Source Listings

The sections below reproduce every relevant file verbatim so the entire system lives in this document as requested.

### `docs/docs/js/tampermonkey-inspector.js`

```javascript
(() => {
  'use strict';

  if (window.__TampermonkeyInspectorLoaded) {
    return;
  }
  window.__TampermonkeyInspectorLoaded = true;

  const READY_STATES = new Set(['interactive', 'complete']);
  const SETTINGS_KEY = 'tampermonkeyInspector.settings.v1';
  const PANEL_ID = 'tm-inspector-panel';
  const OVERLAY_ID = 'tm-inspector-overlay';

  const globalConfig = window.TampermonkeyInspectorConfig || {};
  const defaultBackend = {
    enabled: true,
    endpoint: '',
    apiKey: '',
    autoSend: false,
  };

  function loadInitialSettings() {
    const storedRaw = localStorage.getItem(SETTINGS_KEY);
    let stored = {};
    if (storedRaw) {
      try {
        stored = JSON.parse(storedRaw) ?? {};
      } catch (error) {
        console.warn('[Tampermonkey Inspector] Failed to parse stored settings.', error);
      }
    }

    const merged = {
      ...defaultBackend,
      ...stored,
      ...(globalConfig.backend || {}),
    };

    if (globalConfig.backend && typeof globalConfig.backend.enabled === 'boolean') {
      merged.enabled = Boolean(globalConfig.backend.enabled);
    }

    return merged;
  }

  const state = {
    selecting: false,
    activeElement: null,
    lockedElement: null,
    notes: '',
    selectors: { css: '', xpath: '' },
    summary: null,
    backend: loadInitialSettings(),
    statusTimer: null,
  };

  function saveSettings() {
    const { enabled, ...toPersist } = state.backend;
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(toPersist));
    } catch (error) {
      console.warn('[Tampermonkey Inspector] Unable to persist settings.', error);
    }
  }

  function ready(fn) {
    if (READY_STATES.has(document.readyState)) {
      fn();
    } else {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    }
  }

  function escapeCss(value) {
    if (typeof CSS !== 'undefined' && CSS.escape) {
      return CSS.escape(value);
    }
    return value.replace(/(["\\#.;:?+=\-])/g, '\\$1');
  }

  function getCssSelector(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) {
      return '';
    }

    const segments = [];
    let current = element;

    while (current && current.nodeType === Node.ELEMENT_NODE) {
      let segment = current.nodeName.toLowerCase();

      if (current.id) {
        segment += `#${escapeCss(current.id)}`;
        segments.unshift(segment);
        break;
      }

      const classes = Array.from(current.classList)
        .slice(0, 3)
        .map((cls) => `.${escapeCss(cls)}`)
        .join('');

      if (classes) {
        segment += classes;
      }

      const siblings = Array.from(current.parentElement?.children || []).filter(
        (node) => node.nodeName === current.nodeName,
      );

      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        segment += `:nth-of-type(${index})`;
      }

      segments.unshift(segment);
      current = current.parentElement;
    }

    return segments.join(' > ');
  }

  function getXPath(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) {
      return '';
    }

    const segments = [];
    let current = element;

    while (current && current.nodeType === Node.ELEMENT_NODE) {
      const siblings = Array.from(current.parentNode?.childNodes || []).filter(
        (node) => node.nodeName === current.nodeName,
      );
      const index = siblings.indexOf(current) + 1;
      const segment = index > 1 ? `${current.nodeName}[${index}]` : current.nodeName;
      segments.unshift(segment);
      current = current.parentNode;
    }

    return `/${segments.join('/')}`;
  }

  function summarizeElement(element) {
    if (!element) {
      return null;
    }

    const attributes = {};
    Array.from(element.attributes || []).forEach((attr) => {
      if (attr.name.startsWith('data-') || attr.name === 'name' || attr.name === 'aria-label') {
        attributes[attr.name] = attr.value;
      }
    });

    const textContent = (element.textContent || '').trim().replace(/\s+/g, ' ');

    return {
      tag: element.tagName,
      id: element.id || null,
      classes: Array.from(element.classList || []),
      attributes,
      textPreview: textContent.slice(0, 140),
      textLength: textContent.length,
    };
  }

  function ensureOverlay() {
    let overlay = document.getElementById(OVERLAY_ID);
    if (overlay) {
      return overlay;
    }

    overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.style.position = 'fixed';
    overlay.style.zIndex = '2147483646';
    overlay.style.pointerEvents = 'none';
    overlay.style.border = '2px solid #3b82f6';
    overlay.style.background = 'rgba(59, 130, 246, 0.15)';
    overlay.style.borderRadius = '4px';
    overlay.style.transition = 'all 80ms ease-out';
    document.body.appendChild(overlay);
    return overlay;
  }

  function updateOverlay(element) {
    const overlay = ensureOverlay();
    if (!element) {
      overlay.style.opacity = '0';
      return;
    }

    const rect = element.getBoundingClientRect();
    overlay.style.opacity = '1';
    overlay.style.top = `${rect.top}px`;
    overlay.style.left = `${rect.left}px`;
    overlay.style.width = `${rect.width}px`;
    overlay.style.height = `${rect.height}px`;
  }

  function removeOverlay() {
    const overlay = document.getElementById(OVERLAY_ID);
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
  }

  function updateSummaryDisplay(summaryContainer) {
    const summary = state.summary;
    summaryContainer.innerHTML = '';

    if (!summary) {
      summaryContainer.textContent = 'No element selected.';
      return;
    }

    const items = [
      ['Tag', summary.tag],
      ['ID', summary.id || '—'],
      ['Classes', summary.classes.length ? summary.classes.join(' ') : '—'],
      [
        'Attributes',
        Object.keys(summary.attributes).length
          ? Object.entries(summary.attributes)
              .map(([key, value]) => `${key}="${value}"`)
              .join(' ')
          : '—',
      ],
      [
        'Text',
        summary.textLength
          ? `${summary.textPreview}${summary.textLength > summary.textPreview.length ? '…' : ''} (${summary.textLength} chars)`
          : '—',
      ],
    ];

    items.forEach(([label, value]) => {
      const row = document.createElement('div');
      row.className = 'tm-inspector-row';

      const labelEl = document.createElement('span');
      labelEl.className = 'tm-inspector-label';
      labelEl.textContent = label;

      const valueEl = document.createElement('span');
      valueEl.className = 'tm-inspector-value';
      valueEl.textContent = value;

      row.append(labelEl, valueEl);
      summaryContainer.appendChild(row);
    });
  }

  function updateSelectorsDisplay(cssField, xpathField) {
    cssField.value = state.selectors.css;
    xpathField.value = state.selectors.xpath;
  }

  function setStatus(statusEl, message, tone = 'info') {
    statusEl.textContent = message;
    statusEl.dataset.tone = tone;
    statusEl.style.opacity = '1';

    if (state.statusTimer) {
      window.clearTimeout(state.statusTimer);
    }

    if (message) {
      state.statusTimer = window.setTimeout(() => {
        statusEl.style.opacity = '0.6';
      }, 4000);
    }
  }

  async function copyToClipboard(text, statusEl) {
    if (!text) {
      setStatus(statusEl, 'Nothing to copy yet.', 'warn');
      return;
    }

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const helper = document.createElement('textarea');
        helper.value = text;
        helper.style.position = 'fixed';
        helper.style.opacity = '0';
        document.body.appendChild(helper);
        helper.select();
        document.execCommand('copy');
        helper.remove();
      }
      setStatus(statusEl, 'Selector copied to clipboard.', 'success');
    } catch (error) {
      console.error('[Tampermonkey Inspector] Copy failed.', error);
      setStatus(statusEl, 'Unable to copy selector.', 'error');
    }
  }

  async function sendToBackend(statusEl, trigger = 'manual') {
    if (!state.backend.enabled) {
      setStatus(statusEl, 'Backend sync is disabled.', 'info');
      return;
    }

    if (!state.backend.endpoint) {
      setStatus(statusEl, 'Set an endpoint before sending.', 'warn');
      return;
    }

    if (!state.activeElement) {
      setStatus(statusEl, 'Select an element to send.', 'warn');
      return;
    }

    const payload = {
      url: window.location.href,
      title: document.title,
      timestamp: new Date().toISOString(),
      selectors: state.selectors,
      element: state.summary,
      notes: state.notes || null,
      snippet: buildSnippet(),
      trigger,
    };

    const headers = {
      'Content-Type': 'application/json',
    };

    if (state.backend.apiKey) {
      headers.Authorization = `Bearer ${state.backend.apiKey}`;
    }

    try {
      const response = await fetch(state.backend.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        mode: 'cors',
        credentials: 'omit',
      });

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      setStatus(statusEl, 'Selection sent to backend.', 'success');
    } catch (error) {
      console.error('[Tampermonkey Inspector] Backend request failed.', error);
      setStatus(statusEl, 'Failed to reach backend.', 'error');
    }
  }

  function buildSnippet() {
    if (!state.selectors.css) {
      return '';
    }

    return [
      `const el = document.querySelector(${JSON.stringify(state.selectors.css)});`,
      'if (!el) {',
      "  throw new Error('Selector no longer matches.');",
      '}',
      "// TODO: interact with 'el'",
    ].join('\n');
  }

  function updateNotes(notesField) {
    notesField.value = state.notes;
  }

  function focusElement(element) {
    state.activeElement = element;
    state.summary = summarizeElement(element);
    state.selectors = {
      css: getCssSelector(element),
      xpath: getXPath(element),
    };
  }

  function clearSelection(summaryContainer, cssField, xpathField, notesField, statusEl) {
    state.activeElement = null;
    state.lockedElement = null;
    state.summary = null;
    state.selectors = { css: '', xpath: '' };
    removeOverlay();
    updateSummaryDisplay(summaryContainer);
    updateSelectorsDisplay(cssField, xpathField);
    updateNotes(notesField);
    setStatus(statusEl, 'Selection cleared.', 'info');
  }

  function setSelecting(isSelecting, toggle) {
    state.selecting = isSelecting;
    toggle.textContent = isSelecting ? 'Stop selecting' : 'Start selecting';
    toggle.dataset.active = String(isSelecting);
  }

  function init() {
    const style = document.createElement('style');
    style.textContent = `
      #${PANEL_ID} {
        position: fixed;
        top: 16px;
        right: 16px;
        width: 320px;
        z-index: 2147483647;
        background: rgba(17, 24, 39, 0.95);
        color: #f8fafc;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        border-radius: 12px;
        box-shadow: 0 12px 32px rgba(15, 23, 42, 0.45);
        border: 1px solid rgba(148, 163, 184, 0.25);
        overflow: hidden;
      }

      #${PANEL_ID} header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 12px 16px;
        background: linear-gradient(120deg, #1e293b, #334155);
        cursor: move;
        user-select: none;
      }

      #${PANEL_ID} header h1 {
        margin: 0;
        font-size: 15px;
        font-weight: 600;
      }

      #${PANEL_ID} main {
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 16px;
        max-height: 70vh;
        overflow-y: auto;
      }

      #${PANEL_ID} button,
      #${PANEL_ID} input,
      #${PANEL_ID} textarea,
      #${PANEL_ID} label {
        font-family: inherit;
        font-size: 13px;
      }

      #${PANEL_ID} button {
        border: none;
        border-radius: 8px;
        padding: 8px 12px;
        cursor: pointer;
        background: rgba(148, 163, 184, 0.18);
        color: inherit;
        transition: background 120ms ease, transform 120ms ease;
      }

      #${PANEL_ID} button:hover {
        background: rgba(148, 163, 184, 0.32);
        transform: translateY(-1px);
      }

      #${PANEL_ID} button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        transform: none;
      }

      #${PANEL_ID} button[data-active="true"] {
        background: #2563eb;
      }

      #${PANEL_ID} .tm-inspector-section {
        background: rgba(15, 23, 42, 0.65);
        border-radius: 10px;
        padding: 12px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      #${PANEL_ID} .tm-inspector-section h2 {
        margin: 0;
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: rgba(226, 232, 240, 0.7);
      }

      #${PANEL_ID} textarea {
        min-height: 80px;
        resize: vertical;
        border-radius: 8px;
        border: 1px solid rgba(148, 163, 184, 0.35);
        background: rgba(15, 23, 42, 0.8);
        color: inherit;
        padding: 8px;
      }

      #${PANEL_ID} input[type="text"],
      #${PANEL_ID} input[type="url"],
      #${PANEL_ID} input[type="password"] {
        width: 100%;
        border-radius: 8px;
        border: 1px solid rgba(148, 163, 184, 0.35);
        background: rgba(15, 23, 42, 0.8);
        color: inherit;
        padding: 8px;
      }

      #${PANEL_ID} .tm-inspector-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
      }

      #${PANEL_ID} .tm-inspector-row {
        display: flex;
        justify-content: space-between;
        gap: 8px;
        font-size: 12px;
        border-bottom: 1px dashed rgba(148, 163, 184, 0.2);
        padding-bottom: 6px;
      }

      #${PANEL_ID} .tm-inspector-row:last-child {
        border-bottom: none;
        padding-bottom: 0;
      }

      #${PANEL_ID} .tm-inspector-label {
        font-weight: 600;
        opacity: 0.8;
      }

      #${PANEL_ID} .tm-inspector-value {
        text-align: right;
        word-break: break-word;
      }

      #${PANEL_ID} .tm-inspector-selectors {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      #${PANEL_ID} .tm-inspector-selectors input {
        font-family: 'JetBrains Mono', 'Fira Code', 'SFMono-Regular', monospace;
        font-size: 12px;
      }

      #${PANEL_ID} .tm-inspector-status {
        font-size: 12px;
        opacity: 0.7;
        transition: opacity 160ms ease;
      }

      #${PANEL_ID} .tm-inspector-status[data-tone="error"] { color: #f97316; }
      #${PANEL_ID} .tm-inspector-status[data-tone="warn"] { color: #facc15; }
      #${PANEL_ID} .tm-inspector-status[data-tone="success"] { color: #34d399; }
    `;
    document.head.appendChild(style);

    if (document.getElementById(PANEL_ID)) {
      return;
    }

    const panel = document.createElement('section');
    panel.id = PANEL_ID;

    const header = document.createElement('header');
    const title = document.createElement('h1');
    title.textContent = 'Inspector';

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.textContent = 'Start selecting';

    header.append(title, toggle);
    panel.appendChild(header);

    const main = document.createElement('main');

    const summarySection = document.createElement('div');
    summarySection.className = 'tm-inspector-section';
    const summaryHeader = document.createElement('div');
    summaryHeader.style.display = 'flex';
    summaryHeader.style.justifyContent = 'space-between';
    summaryHeader.style.alignItems = 'center';
    const summaryTitle = document.createElement('h2');
    summaryTitle.textContent = 'Element summary';
    const clearButton = document.createElement('button');
    clearButton.type = 'button';
    clearButton.textContent = 'Clear';
    clearButton.style.fontSize = '11px';
    clearButton.style.padding = '6px 10px';
    summaryHeader.append(summaryTitle, clearButton);
    const summaryContainer = document.createElement('div');
    summaryContainer.textContent = 'No element selected.';
    summarySection.append(summaryHeader, summaryContainer);

    const selectorSection = document.createElement('div');
    selectorSection.className = 'tm-inspector-section';
    const selectorTitle = document.createElement('h2');
    selectorTitle.textContent = 'Selectors';

    const cssField = document.createElement('input');
    cssField.type = 'text';
    cssField.placeholder = 'CSS selector';
    cssField.readOnly = true;

    const xpathField = document.createElement('input');
    xpathField.type = 'text';
    xpathField.placeholder = 'XPath';
    xpathField.readOnly = true;

    const selectorButtons = document.createElement('div');
    selectorButtons.className = 'tm-inspector-grid';
    const copyCss = document.createElement('button');
    copyCss.type = 'button';
    copyCss.textContent = 'Copy CSS';
    const copyXpath = document.createElement('button');
    copyXpath.type = 'button';
    copyXpath.textContent = 'Copy XPath';
    selectorButtons.append(copyCss, copyXpath);

    selectorSection.append(selectorTitle, cssField, xpathField, selectorButtons);

    const notesSection = document.createElement('div');
    notesSection.className = 'tm-inspector-section';
    const notesTitle = document.createElement('h2');
    notesTitle.textContent = 'Notes & snippet';
    const notesField = document.createElement('textarea');
    notesField.placeholder = 'Add notes about what to automate…';
    const addSnippet = document.createElement('button');
    addSnippet.type = 'button';
    addSnippet.textContent = 'Add snippet';
    notesSection.append(notesTitle, notesField, addSnippet);

    const backendSection = document.createElement('div');
    backendSection.className = 'tm-inspector-section';
    const backendTitle = document.createElement('h2');
    backendTitle.textContent = 'Backend sync';
    const endpointField = document.createElement('input');
    endpointField.type = 'url';
    endpointField.placeholder = 'https://example.com/events';
    const apiKeyField = document.createElement('input');
    apiKeyField.type = 'password';
    apiKeyField.placeholder = 'Optional API key';
    const backendRow = document.createElement('div');
    backendRow.className = 'tm-inspector-grid';
    const autoSendLabel = document.createElement('label');
    const autoSendCheckbox = document.createElement('input');
    autoSendCheckbox.type = 'checkbox';
    autoSendCheckbox.style.marginRight = '6px';
    autoSendLabel.append(autoSendCheckbox, document.createTextNode('Send automatically after snippet'));
    const sendButton = document.createElement('button');
    sendButton.type = 'button';
    sendButton.textContent = 'Send selection';
    backendRow.append(autoSendLabel, sendButton);
    const statusEl = document.createElement('div');
    statusEl.className = 'tm-inspector-status';
    statusEl.dataset.tone = 'info';
    statusEl.textContent = 'Backend idle.';

    backendSection.append(backendTitle, endpointField, apiKeyField, backendRow, statusEl);

    main.append(summarySection, selectorSection, notesSection, backendSection);
    panel.appendChild(main);
    document.body.appendChild(panel);

    endpointField.value = state.backend.endpoint || '';
    apiKeyField.value = state.backend.apiKey || '';
    autoSendCheckbox.checked = Boolean(state.backend.autoSend);

    toggle.addEventListener('click', () => {
      const willSelect = !state.selecting;
      setSelecting(willSelect, toggle);
      if (!willSelect && !state.lockedElement) {
        updateOverlay(null);
      }
    });

    clearButton.addEventListener('click', () => {
      setSelecting(false, toggle);
      clearSelection(summaryContainer, cssField, xpathField, notesField, statusEl);
    });

    copyCss.addEventListener('click', () => copyToClipboard(state.selectors.css, statusEl));
    copyXpath.addEventListener('click', () => copyToClipboard(state.selectors.xpath, statusEl));

    addSnippet.addEventListener('click', () => {
      if (!state.selectors.css) {
        setStatus(statusEl, 'Select an element first.', 'warn');
        return;
      }

      const snippet = buildSnippet();
      state.notes = state.notes ? `${state.notes}\n\n${snippet}` : snippet;
      updateNotes(notesField);
      setStatus(statusEl, 'Snippet added to notes.', 'success');

      if (state.backend.autoSend) {
        sendToBackend(statusEl, 'auto');
      }
    });

    sendButton.addEventListener('click', () => sendToBackend(statusEl));

    notesField.addEventListener('input', () => {
      state.notes = notesField.value;
    });

    endpointField.addEventListener('input', () => {
      state.backend.endpoint = endpointField.value.trim();
      saveSettings();
    });

    apiKeyField.addEventListener('input', () => {
      state.backend.apiKey = apiKeyField.value.trim();
      saveSettings();
    });

    autoSendCheckbox.addEventListener('change', () => {
      state.backend.autoSend = autoSendCheckbox.checked;
      saveSettings();
    });

    function onPointerMove(event) {
      if (!state.selecting) {
        return;
      }

      if (panel.contains(event.target)) {
        return;
      }

      const element = event.target instanceof Element ? event.target : null;
      if (!element || element === state.activeElement) {
        return;
      }

      focusElement(element);
      updateOverlay(element);
      updateSummaryDisplay(summaryContainer);
      updateSelectorsDisplay(cssField, xpathField);
    }

    function onPointerClick(event) {
      if (!state.selecting) {
        return;
      }

      if (panel.contains(event.target)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const element = event.target instanceof Element ? event.target : null;
      if (!element) {
        return;
      }

      state.lockedElement = element;
      focusElement(element);
      updateOverlay(element);
      updateSummaryDisplay(summaryContainer);
      updateSelectorsDisplay(cssField, xpathField);
      setSelecting(false, toggle);
      setStatus(statusEl, 'Element locked.', 'info');
    }

    function onKeyDown(event) {
      if (event.key === 'Escape') {
        if (state.selecting) {
          setSelecting(false, toggle);
        }
        clearSelection(summaryContainer, cssField, xpathField, notesField, statusEl);
      }
    }

    document.addEventListener('pointermove', onPointerMove, true);
    document.addEventListener('click', onPointerClick, true);
    document.addEventListener('keydown', onKeyDown, true);

    function enableDrag(handle, movable) {
      let startX = 0;
      let startY = 0;
      let offsetX = 0;
      let offsetY = 0;
      let isDragging = false;

      handle.addEventListener('pointerdown', (event) => {
        if (event.button !== 0) {
          return;
        }
        isDragging = true;
        startX = event.clientX;
        startY = event.clientY;
        const rect = movable.getBoundingClientRect();
        offsetX = rect.left;
        offsetY = rect.top;
        movable.style.transition = 'none';
        handle.setPointerCapture(event.pointerId);
      });

      handle.addEventListener('pointermove', (event) => {
        if (!isDragging) {
          return;
        }
        const deltaX = event.clientX - startX;
        const deltaY = event.clientY - startY;
        movable.style.left = `${offsetX + deltaX}px`;
        movable.style.top = `${offsetY + deltaY}px`;
        movable.style.right = 'auto';
      });

      handle.addEventListener('pointerup', (event) => {
        if (!isDragging) {
          return;
        }
        isDragging = false;
        movable.style.transition = '';
        handle.releasePointerCapture(event.pointerId);
      });
    }

    enableDrag(header, panel);

    updateSummaryDisplay(summaryContainer);
    updateSelectorsDisplay(cssField, xpathField);
    updateNotes(notesField);
    if (!state.backend.enabled) {
      backendSection.style.display = 'none';
    }
  }

  ready(init);
})();
```

### `examples/tampermonkey_dev_inspector/backend/app.py`

```python
"""Minimal FastAPI backend to receive Tampermonkey Inspector selections."""
from __future__ import annotations

import os
import secrets
from datetime import datetime
from typing import Dict, List, Optional

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field, HttpUrl

API_KEY = os.getenv("INSPECTOR_API_KEY", "dev-key")

app = FastAPI(title="Tampermonkey Inspector Backend", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=False,
)


def verify_api_key(authorization: Optional[str] = Header(default=None)) -> None:
    """Validate an optional bearer token if the API key is configured."""
    if not API_KEY:
        return
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = authorization.split(" ", 1)[1]
    if not secrets.compare_digest(token, API_KEY):
        raise HTTPException(status_code=401, detail="Invalid API key")


class ElementSummary(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    tag: str
    id: Optional[str] = None
    classes: List[str] = Field(default_factory=list)
    attributes: Dict[str, str] = Field(default_factory=dict)
    text_preview: Optional[str] = Field(default=None, alias="textPreview")
    text_length: Optional[int] = Field(default=None, alias="textLength")


class SelectorPayload(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    url: HttpUrl
    title: Optional[str] = None
    timestamp: datetime
    selectors: Dict[str, str]
    element: ElementSummary
    notes: Optional[str] = None
    snippet: Optional[str] = None
    trigger: str = Field(default="manual")


EVENTS: List[SelectorPayload] = []


@app.post("/events", status_code=201)
async def create_event(payload: SelectorPayload, _: None = Depends(verify_api_key)) -> dict[str, str]:
    EVENTS.append(payload)
    return {"status": "ok"}


@app.get("/events", response_model=List[SelectorPayload])
async def list_events(_: None = Depends(verify_api_key)) -> List[SelectorPayload]:
    return EVENTS


@app.post("/reset", status_code=204)
async def reset(_: None = Depends(verify_api_key)) -> None:
    EVENTS.clear()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app:app", host="0.0.0.0", port=int(os.getenv("PORT", "8000")))
```

### `examples/tampermonkey_dev_inspector/backend/requirements.txt`

```text
fastapi==0.111.0
uvicorn[standard]==0.30.1
```

### `examples/tampermonkey_dev_inspector/frontend/index.html`

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Tampermonkey Inspector Dashboard</title>
    <style>
      :root {
        color-scheme: dark;
        font-family: "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #11151a;
        color: #f5f7fa;
      }

      body {
        margin: 0;
        padding: 24px;
        display: flex;
        flex-direction: column;
        gap: 24px;
        max-width: 960px;
        margin-left: auto;
        margin-right: auto;
      }

      header {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      h1 {
        margin: 0;
        font-size: 28px;
      }

      .controls {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        align-items: center;
      }

      .controls input[type="url"],
      .controls input[type="password"] {
        padding: 8px 12px;
        border-radius: 8px;
        border: 1px solid rgba(255, 255, 255, 0.15);
        background: rgba(17, 21, 26, 0.85);
        color: inherit;
        min-width: 260px;
      }

      button {
        padding: 10px 16px;
        border: none;
        border-radius: 8px;
        background: #4863f7;
        color: white;
        font-weight: 600;
        cursor: pointer;
        transition: transform 0.12s ease, box-shadow 0.12s ease;
      }

      button:hover {
        transform: translateY(-1px);
        box-shadow: 0 12px 20px rgba(72, 99, 247, 0.3);
      }

      button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        transform: none;
        box-shadow: none;
      }

      table {
        width: 100%;
        border-collapse: collapse;
        border-radius: 12px;
        overflow: hidden;
      }

      th, td {
        padding: 12px 16px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        vertical-align: top;
      }

      th {
        background: rgba(255, 255, 255, 0.05);
        text-align: left;
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
      }

      tbody tr:nth-child(even) {
        background: rgba(17, 21, 26, 0.8);
      }

      code {
        font-family: "JetBrains Mono", "Fira Code", "SFMono-Regular", monospace;
        font-size: 12px;
        background: rgba(255, 255, 255, 0.08);
        padding: 4px 6px;
        border-radius: 6px;
      }

      pre {
        background: rgba(0, 0, 0, 0.6);
        padding: 12px;
        border-radius: 8px;
        overflow-x: auto;
        font-size: 12px;
      }

      .empty {
        font-style: italic;
        opacity: 0.7;
      }
    </style>
  </head>
  <body>
    <header>
      <h1>Tampermonkey Inspector Feed</h1>
      <p>Live dashboard that displays selectors captured by the Tampermonkey Inspector helper.</p>
      <div class="controls">
        <input id="endpoint" type="url" placeholder="http://localhost:8000/events" />
        <input id="apiKey" type="password" placeholder="Optional API key" />
        <button id="connect">Connect</button>
        <span id="status" class="empty">Not connected.</span>
      </div>
    </header>
    <main>
      <table>
        <thead>
          <tr>
            <th>Time</th>
            <th>Page</th>
            <th>Selectors</th>
            <th>Snippet</th>
          </tr>
        </thead>
        <tbody id="rows">
          <tr><td colspan="4" class="empty">No events yet.</td></tr>
        </tbody>
      </table>
    </main>
    <script>
      const endpointInput = document.getElementById('endpoint');
      const apiKeyInput = document.getElementById('apiKey');
      const connectButton = document.getElementById('connect');
      const statusEl = document.getElementById('status');
      const rowsEl = document.getElementById('rows');
      let timer = null;
      let endpoint = '';

      function setStatus(message, isError = false) {
        statusEl.textContent = message;
        statusEl.style.color = isError ? '#ff867c' : 'inherit';
      }

      function renderEvents(events) {
        rowsEl.innerHTML = '';
        if (!events.length) {
          rowsEl.innerHTML = '<tr><td colspan="4" class="empty">No events yet.</td></tr>';
          return;
        }
        for (const event of events) {
          const row = document.createElement('tr');
          const time = new Date(event.timestamp);
          row.innerHTML = `
            <td>${time.toLocaleString()}</td>
            <td>
              <div><strong>${event.title || 'Untitled page'}</strong></div>
              <div><a href="${event.url}" target="_blank" rel="noopener">${event.url}</a></div>
              <div>Trigger: <code>${event.trigger}</code></div>
            </td>
            <td>
              <div>CSS: <code>${event.selectors.css}</code></div>
              <div>XPath: <code>${event.selectors.xpath}</code></div>
            </td>
            <td>
              ${event.snippet ? `<pre>${event.snippet.replace(/[<>&]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]))}</pre>` : '<span class="empty">No snippet</span>'}
            </td>
          `;
          rowsEl.appendChild(row);
        }
      }

      async function fetchEvents() {
        if (!endpoint) return;
        try {
          const headers = {};
          if (apiKeyInput.value) {
            headers['Authorization'] = `Bearer ${apiKeyInput.value}`;
          }
          const response = await fetch(endpoint, { headers });
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          const data = await response.json();
          renderEvents(data);
          setStatus(`Connected – updated ${new Date().toLocaleTimeString()}`);
        } catch (error) {
          console.error(error);
          setStatus(`Failed to fetch events: ${error.message}`, true);
        }
      }

      connectButton.addEventListener('click', () => {
        const value = endpointInput.value.trim();
        if (!value) {
          setStatus('Enter an endpoint URL first.', true);
          return;
        }
        endpoint = value;
        setStatus('Connecting…');
        fetchEvents();
        if (timer) {
          clearInterval(timer);
        }
        timer = setInterval(fetchEvents, 5000);
      });
    </script>
  </body>
</html>
```

## Additional References

- [Helper quick-start tutorial](tampermonkey-dev-inspector.md) – concise instructions for installing and operating the panel.
- [Community ecosystem guide](../../community/dspy-ecosystem.md) – curated repositories and integrations that complement DSPy workflows.
- [Example stack README](../../../examples/tampermonkey_dev_inspector/README.md) – operational notes for the backend and dashboard.

## Closing Notes

This single document mirrors and consolidates every artifact previously produced for the Tampermonkey Dev Inspector initiative—from feature descriptions to source files—so you can review the entire system in one place.

{ }
