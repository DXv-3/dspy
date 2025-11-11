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
