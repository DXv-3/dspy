(() => {
  'use strict';

  if (window.__TampermonkeyInspectorLoaded) {
    return;
  }
  window.__TampermonkeyInspectorLoaded = true;

  const NS = 'tm-inspector';
  const overlayId = `${NS}-overlay`;

  const style = document.createElement('style');
  style.id = `${NS}-styles`;
  style.textContent = `
    #${NS}-panel {
      position: fixed;
      top: 16px;
      right: 16px;
      width: 320px;
      z-index: 2147483647;
      background: rgba(32, 33, 36, 0.96);
      color: #f1f3f4;
      font-family: "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      border-radius: 12px;
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.36);
      overflow: hidden;
      border: 1px solid rgba(255, 255, 255, 0.08);
    }

    #${NS}-panel header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      background: linear-gradient(135deg, #5f4b8b, #485461);
      color: white;
      cursor: move;
      user-select: none;
    }

    #${NS}-panel h1 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
    }

    #${NS}-panel main {
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      max-height: 70vh;
      overflow-y: auto;
    }

    .${NS}-badge {
      background: rgba(255, 255, 255, 0.12);
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 12px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .${NS}-controls {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
    }

    .${NS}-controls button,
    .${NS}-copy button,
    .${NS}-steps button {
      padding: 8px 10px;
      border-radius: 8px;
      border: none;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.12s ease, box-shadow 0.12s ease;
      background: rgba(255, 255, 255, 0.12);
      color: inherit;
    }

    .${NS}-controls button:hover,
    .${NS}-copy button:hover,
    .${NS}-steps button:hover {
      transform: translateY(-1px);
      box-shadow: 0 6px 12px rgba(15, 15, 15, 0.25);
      background: rgba(255, 255, 255, 0.18);
    }

    .${NS}-controls button:active,
    .${NS}-copy button:active,
    .${NS}-steps button:active {
      transform: translateY(0);
      box-shadow: none;
    }

    .${NS}-section {
      background: rgba(255, 255, 255, 0.06);
      border-radius: 12px;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .${NS}-section h2 {
      margin: 0;
      font-size: 13px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: rgba(241, 243, 244, 0.75);
    }

    .${NS}-info {
      font-size: 13px;
      line-height: 1.45;
      word-break: break-word;
      color: rgba(241, 243, 244, 0.92);
    }

    .${NS}-info strong {
      color: white;
      font-weight: 600;
    }

    #${overlayId} {
      position: fixed;
      pointer-events: none;
      border: 2px solid #8ab4f8;
      background: rgba(138, 180, 248, 0.2);
      border-radius: 6px;
      z-index: 2147483646;
      transition: all 0.06s ease-out;
    }

    .${NS}-copy {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .${NS}-copy code {
      background: rgba(0, 0, 0, 0.4);
      border-radius: 8px;
      padding: 10px;
      font-family: "JetBrains Mono", "Fira Code", "SFMono-Regular", monospace;
      font-size: 12px;
      color: #e8eaed;
      line-height: 1.4;
    }

    .${NS}-section label {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 12px;
      color: rgba(241, 243, 244, 0.75);
    }

    .${NS}-section input[type="text"],
    .${NS}-section input[type="url"],
    .${NS}-section input[type="password"] {
      width: 100%;
      border: none;
      border-radius: 8px;
      background: rgba(0, 0, 0, 0.35);
      color: #e8eaed;
      padding: 8px 10px;
      font-size: 12px;
      font-family: "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    .${NS}-section input[type="text"]:focus,
    .${NS}-section input[type="url"]:focus,
    .${NS}-section input[type="password"]:focus {
      outline: 2px solid rgba(138, 180, 248, 0.6);
    }

    .${NS}-switch {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      color: rgba(241, 243, 244, 0.75);
    }

    .${NS}-switch input[type="checkbox"] {
      width: 16px;
      height: 16px;
      accent-color: #8ab4f8;
    }

    .${NS}-status {
      font-size: 11px;
      color: rgba(241, 243, 244, 0.6);
    }

    .${NS}-steps textarea {
      width: 100%;
      min-height: 120px;
      border-radius: 10px;
      border: none;
      padding: 10px 12px;
      font-size: 12px;
      font-family: "JetBrains Mono", "Fira Code", "SFMono-Regular", monospace;
      background: rgba(0, 0, 0, 0.3);
      color: #e8eaed;
      resize: vertical;
    }

    .${NS}-steps textarea:focus {
      outline: 2px solid rgba(138, 180, 248, 0.6);
    }

    .${NS}-empty {
      font-size: 12px;
      color: rgba(241, 243, 244, 0.6);
      font-style: italic;
    }

    .${NS}-footer {
      text-align: right;
      font-size: 11px;
      color: rgba(241, 243, 244, 0.5);
    }
  `;
  document.head.appendChild(style);

  const overlay = document.createElement('div');
  overlay.id = overlayId;
  overlay.style.display = 'none';
  document.body.appendChild(overlay);

  const panel = document.createElement('section');
  panel.id = `${NS}-panel`;
  panel.innerHTML = `
    <header>
      <h1>Dev Inspector</h1>
      <span class="${NS}-badge">Tampermonkey Helper</span>
    </header>
    <main>
      <div class="${NS}-section">
        <h2>Selection</h2>
        <div class="${NS}-controls">
          <button data-action="start">Start</button>
          <button data-action="lock" disabled>Lock</button>
          <button data-action="clear" disabled>Clear</button>
        </div>
        <div class="${NS}-info ${NS}-empty">Click “Start” and hover to explore the page.</div>
      </div>
      <div class="${NS}-section">
        <h2>Selectors</h2>
        <div class="${NS}-copy">
          <code data-field="css">Select an element to populate selectors…</code>
          <button data-action="copy-css" disabled>Copy CSS Selector</button>
          <button data-action="copy-xpath" disabled>Copy XPath</button>
        </div>
      </div>
      <div class="${NS}-section ${NS}-integrations">
        <h2>Backend Sync</h2>
        <label class="${NS}-switch">
          <input type="checkbox" data-field="backend-enabled" />
          <span>Enable API sync</span>
        </label>
        <label>
          Endpoint URL
          <input type="url" placeholder="https://localhost:8000/events" data-field="backend-endpoint" />
        </label>
        <label>
          API key (optional)
          <input type="password" placeholder="Bearer token" data-field="backend-api-key" />
        </label>
        <label class="${NS}-switch">
          <input type="checkbox" data-field="backend-auto" />
          <span>Auto-send when adding a step</span>
        </label>
        <button data-action="send-backend" disabled>Send current selection</button>
        <div class="${NS}-status ${NS}-backend-status">Sync disabled.</div>
      </div>
      <div class="${NS}-section ${NS}-steps">
        <h2>Script Builder</h2>
        <textarea placeholder="// Steps you want your Tampermonkey script to run\n// Click ‘Add Step’ to insert template code for the current element." data-field="steps"></textarea>
        <button data-action="add-step" disabled>Add Step to Notes</button>
      </div>
      <div class="${NS}-footer">Drag the header to reposition • ESC to exit selection</div>
    </main>
  `;
  document.body.appendChild(panel);

  const infoBox = panel.querySelector(`.${NS}-info`);
  const controls = {
    start: panel.querySelector('[data-action="start"]'),
    lock: panel.querySelector('[data-action="lock"]'),
    clear: panel.querySelector('[data-action="clear"]'),
    copyCss: panel.querySelector('[data-action="copy-css"]'),
    copyXpath: panel.querySelector('[data-action="copy-xpath"]'),
    addStep: panel.querySelector('[data-action="add-step"]'),
    sendBackend: panel.querySelector('[data-action="send-backend"]')
  };
  const fields = {
    css: panel.querySelector('[data-field="css"]'),
    steps: panel.querySelector('[data-field="steps"]'),
    backendEnabled: panel.querySelector('[data-field="backend-enabled"]'),
    backendEndpoint: panel.querySelector('[data-field="backend-endpoint"]'),
    backendApiKey: panel.querySelector('[data-field="backend-api-key"]'),
    backendAuto: panel.querySelector('[data-field="backend-auto"]'),
    backendStatus: panel.querySelector(`.${NS}-backend-status`)
  };

  const state = {
    mode: 'idle', // idle | live | locked
    highlighted: null,
    selected: null
  };

  const storageKey = `${NS}-config`;
  const defaultConfig = {
    backend: {
      enabled: false,
      endpoint: '',
      apiKey: '',
      autoSend: false,
      lastSynced: null,
      lastError: null
    }
  };

  function loadConfig() {
    const globalConfig = window.TampermonkeyInspectorConfig || {};
    let persisted = {};
    try {
      persisted = JSON.parse(localStorage.getItem(storageKey) || '{}');
    } catch (error) {
      console.warn('[Tampermonkey Inspector] Failed to parse stored config', error);
    }
    return {
      backend: {
        ...defaultConfig.backend,
        ...(globalConfig.backend || {}),
        ...(persisted.backend || {})
      }
    };
  }

  let config = loadConfig();

  function persistConfig() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(config));
    } catch (error) {
      console.warn('[Tampermonkey Inspector] Failed to persist config', error);
    }
  }

  function formatTime(dateString) {
    if (!dateString) return null;
    try {
      const date = new Date(dateString);
      return date.toLocaleTimeString();
    } catch (error) {
      return null;
    }
  }

  function updateBackendStatus(message) {
    if (!fields.backendStatus) return;
    fields.backendStatus.textContent = message;
  }

  function refreshBackendUI() {
    if (!fields.backendEnabled) {
      return;
    }
    const backend = config.backend;
    fields.backendEnabled.checked = !!backend.enabled;
    if (fields.backendEndpoint) {
      fields.backendEndpoint.value = backend.endpoint || '';
    }
    if (fields.backendApiKey) {
      fields.backendApiKey.value = backend.apiKey || '';
    }
    if (fields.backendAuto) {
      fields.backendAuto.checked = !!backend.autoSend;
    }
    const disabled = !backend.enabled;
    if (fields.backendEndpoint) {
      fields.backendEndpoint.disabled = disabled;
    }
    if (fields.backendApiKey) {
      fields.backendApiKey.disabled = disabled;
    }
    if (fields.backendAuto) {
      fields.backendAuto.disabled = disabled;
    }
    if (controls.sendBackend) {
      controls.sendBackend.disabled = disabled;
    }

    if (!backend.enabled) {
      updateBackendStatus('Sync disabled.');
    } else if (backend.lastError) {
      updateBackendStatus(`Last error: ${backend.lastError}`);
    } else if (backend.lastSynced) {
      const formatted = formatTime(backend.lastSynced);
      updateBackendStatus(formatted ? `Last synced at ${formatted}` : 'Sync ready.');
    } else {
      updateBackendStatus('Sync ready. Select an element to send it to the API.');
    }

    updateSendButtonState();
  }

  function highlight(element) {
    if (!element || element === document.body || element === document.documentElement) {
      overlay.style.display = 'none';
      state.highlighted = null;
      return;
    }

    const rect = element.getBoundingClientRect();
    overlay.style.display = 'block';
    overlay.style.top = `${rect.top + window.scrollY}px`;
    overlay.style.left = `${rect.left + window.scrollX}px`;
    overlay.style.width = `${rect.width}px`;
    overlay.style.height = `${rect.height}px`;
    state.highlighted = element;
  }

  function describeElement(element) {
    if (!element) return null;
    const tag = element.tagName.toLowerCase();
    const id = element.id || null;
    const classes = [...element.classList];
    const attributes = [...element.attributes]
      .filter(attr => !['style'].includes(attr.name))
      .reduce((acc, attr) => {
        acc[attr.name] = attr.value;
        return acc;
      }, {});
    const text = element.innerText ? element.innerText.trim() : '';
    return {
      tag,
      id,
      classes,
      attributes,
      textPreview: text.slice(0, 240),
      textLength: text.length
    };
  }

  function summarize(element) {
    if (!element) {
      infoBox.textContent = 'Select an element to inspect its details.';
      infoBox.classList.add(`${NS}-empty`);
      return;
    }

    const summary = describeElement(element);
    infoBox.classList.remove(`${NS}-empty`);
    const selectorLabel = `${summary.tag}${summary.id ? `#${summary.id}` : ''}${summary.classes.map(cls => `.${cls}`).join('')}`;
    const attrContent = Object.entries(summary.attributes)
      .filter(([name]) => !['id', 'class'].includes(name))
      .map(([name, value]) => `${name}="${value}"`)
      .join(' ');
    const preview = summary.textPreview;

    infoBox.innerHTML = `
      <div><strong>Element</strong>: <code>${selectorLabel}</code></div>
      ${attrContent ? `<div><strong>Attributes</strong>: <code>${attrContent}</code></div>` : ''}
      ${preview ? `<div><strong>Preview</strong>: ${preview}${summary.textLength > preview.length ? '…' : ''}</div>` : ''}
    `;
  }

  function cssPath(element) {
    if (!element || element.nodeType !== 1) return '';
    const path = [];
    let current = element;
    while (current && current.nodeType === 1 && current !== document.body) {
      let selector = current.nodeName.toLowerCase();
      if (current.id) {
        selector += `#${CSS.escape(current.id)}`;
        path.unshift(selector);
        break;
      }
      const classes = [...current.classList];
      if (classes.length) {
        selector += '.' + classes.map(cls => CSS.escape(cls)).join('.');
      }
      const siblings = [...current.parentNode.children].filter(child => child.nodeName === current.nodeName);
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        selector += `:nth-of-type(${index})`;
      }
      path.unshift(selector);
      current = current.parentElement;
    }
    if (current === document.body) {
      path.unshift('body');
    }
    return path.join(' > ');
  }

  function xpath(element) {
    if (!element) return '';
    if (element.id) {
      return `//*[@id="${element.id}"]`;
    }
    const parts = [];
    let current = element;
    while (current && current.nodeType === 1 && current !== document.documentElement) {
      let index = 1;
      let sibling = current.previousElementSibling;
      while (sibling) {
        if (sibling.nodeName === current.nodeName) {
          index += 1;
        }
        sibling = sibling.previousElementSibling;
      }
      const tag = current.nodeName.toLowerCase();
      parts.unshift(`${tag}[${index}]`);
      current = current.parentElement;
    }
    return `/${parts.join('/')}`;
  }

  function updateSelectors(element) {
    if (!element) {
      fields.css.textContent = 'Select an element to populate selectors…';
      controls.copyCss.disabled = true;
      controls.copyXpath.disabled = true;
      controls.addStep.disabled = true;
      updateSendButtonState();
      return;
    }
    const css = cssPath(element);
    const xp = xpath(element);
    fields.css.textContent = `CSS: ${css}\nXPath: ${xp}`;
    controls.copyCss.disabled = !css;
    controls.copyXpath.disabled = !xp;
    controls.addStep.disabled = false;
    updateSendButtonState();
    controls.copyCss.dataset.value = css;
    controls.copyXpath.dataset.value = xp;
  }

  function updateSendButtonState() {
    if (!controls.sendBackend) return;
    controls.sendBackend.disabled = !(config.backend.enabled && state.selected);
  }

  function buildSnippet(element, css) {
    if (!element) return '';
    const safeCss = (css || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    return `// ${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''}` +
      `\nconst target = document.querySelector('${safeCss}');` +
      `\n// TODO: interact with target (e.g. target.click())\n`;
  }

  function currentSelectionSnapshot(extra = {}) {
    if (!state.selected) return null;
    const css = controls.copyCss.dataset.value || cssPath(state.selected);
    const xp = controls.copyXpath.dataset.value || xpath(state.selected);
    const elementSummary = describeElement(state.selected);
    return {
      url: window.location.href,
      title: document.title,
      timestamp: new Date().toISOString(),
      selectors: {
        css,
        xpath: xp
      },
      element: elementSummary,
      notes: fields.steps.value,
      ...extra
    };
  }

  async function sendSelectionToBackend(options = {}) {
    const backend = config.backend;
    if (!backend.enabled) {
      toast('Enable backend sync to send selections.');
      return;
    }
    if (!backend.endpoint) {
      updateBackendStatus('Add an endpoint URL to sync selections.');
      toast('Add an endpoint URL first.');
      return;
    }
    if (!state.selected) {
      toast('Select an element before syncing.');
      return;
    }

    const snapshot = currentSelectionSnapshot({
      trigger: options.trigger || 'manual',
      snippet: options.snippet || buildSnippet(state.selected, controls.copyCss.dataset.value || cssPath(state.selected))
    });
    if (!snapshot) {
      toast('Unable to capture the current selection.');
      return;
    }

    updateBackendStatus('Syncing…');
    if (controls.sendBackend) {
      controls.sendBackend.disabled = true;
    }

    const headers = {
      'Content-Type': 'application/json'
    };
    if (backend.apiKey) {
      headers.Authorization = `Bearer ${backend.apiKey}`;
    }

    try {
      const response = await fetch(backend.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(snapshot)
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      config.backend.lastSynced = snapshot.timestamp;
      config.backend.lastError = null;
      persistConfig();
      refreshBackendUI();
      toast('Selection synced to backend.');
    } catch (error) {
      console.error('[Tampermonkey Inspector] Failed to sync selection', error);
      config.backend.lastError = error.message || 'Unknown error';
      persistConfig();
      refreshBackendUI();
      toast(`Backend sync failed: ${config.backend.lastError}`);
    } finally {
      updateSendButtonState();
    }
  }

  function select(element) {
    state.selected = element;
    summarize(element);
    updateSelectors(element);
    controls.lock.disabled = true;
    controls.clear.disabled = false;
    state.mode = 'locked';
    updateSendButtonState();
  }

  function clearSelection() {
    state.selected = null;
    state.highlighted = null;
    overlay.style.display = 'none';
    infoBox.classList.add(`${NS}-empty`);
    infoBox.textContent = 'Click “Start” and hover to explore the page.';
    fields.css.textContent = 'Select an element to populate selectors…';
    controls.copyCss.disabled = true;
    controls.copyXpath.disabled = true;
    controls.addStep.disabled = true;
    controls.clear.disabled = true;
    controls.lock.disabled = true;
    updateSendButtonState();
  }

  function startSelection() {
    state.mode = 'live';
    controls.start.disabled = true;
    controls.lock.disabled = false;
    controls.clear.disabled = false;
    panel.classList.remove(`${NS}-paused`);
  }

  function lockSelection() {
    if (state.highlighted) {
      select(state.highlighted);
      controls.start.disabled = false;
      controls.lock.disabled = true;
    }
  }

  function handleMouseMove(event) {
    if (state.mode !== 'live') return;
    if (!panel.contains(event.target)) {
      highlight(event.target);
      summarize(event.target);
      updateSelectors(event.target);
    } else {
      highlight(null);
    }
  }

  function handleClick(event) {
    if (state.mode !== 'live') return;
    if (panel.contains(event.target)) return;
    event.preventDefault();
    event.stopPropagation();
    lockSelection();
  }

  function copyToClipboard(value) {
    navigator.clipboard.writeText(value).then(() => {
      const label = value.length > 64 ? value.slice(0, 61) + '…' : value;
      toast(`Copied: ${label}`);
    }).catch(() => {
      toast('Clipboard copy failed. Copy manually from the panel.');
    });
  }

  function toast(message) {
    const notice = document.createElement('div');
    notice.textContent = message;
    notice.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: rgba(32, 33, 36, 0.94);
      color: #e8eaed;
      padding: 12px 16px;
      border-radius: 10px;
      box-shadow: 0 12px 24px rgba(0, 0, 0, 0.32);
      z-index: 2147483647;
      font-size: 13px;
      font-weight: 500;
      opacity: 0;
      transform: translateY(12px);
      transition: opacity 0.2s ease, transform 0.2s ease;
    `;
    document.body.appendChild(notice);
    requestAnimationFrame(() => {
      notice.style.opacity = '1';
      notice.style.transform = 'translateY(0)';
    });
    setTimeout(() => {
      notice.style.opacity = '0';
      notice.style.transform = 'translateY(12px)';
      setTimeout(() => notice.remove(), 220);
    }, 1800);
  }

  function addStep() {
    if (!state.selected) return;
    const css = controls.copyCss.dataset.value || cssPath(state.selected);
    const snippet = buildSnippet(state.selected, css);
    fields.steps.value += (fields.steps.value.endsWith('\n') || fields.steps.value === '' ? '' : '\n') + snippet + '\n';
    toast('Template inserted into notes.');
    if (config.backend.enabled && config.backend.autoSend) {
      sendSelectionToBackend({ trigger: 'auto-add-step', snippet });
    }
  }

  function enableDrag(handle, element) {
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let initialX = 0;
    let initialY = 0;

    handle.addEventListener('pointerdown', (event) => {
      isDragging = true;
      startX = event.clientX;
      startY = event.clientY;
      const rect = element.getBoundingClientRect();
      initialX = rect.left;
      initialY = rect.top;
      handle.setPointerCapture(event.pointerId);
    });

    handle.addEventListener('pointermove', (event) => {
      if (!isDragging) return;
      const deltaX = event.clientX - startX;
      const deltaY = event.clientY - startY;
      element.style.left = `${initialX + deltaX}px`;
      element.style.top = `${initialY + deltaY}px`;
      element.style.right = 'auto';
      element.style.bottom = 'auto';
    });

    handle.addEventListener('pointerup', () => {
      isDragging = false;
    });
  }

  enableDrag(panel.querySelector('header'), panel);

  controls.start.addEventListener('click', () => {
    startSelection();
  });

  controls.lock.addEventListener('click', () => {
    lockSelection();
  });

  controls.clear.addEventListener('click', () => {
    clearSelection();
    controls.start.disabled = false;
    state.mode = 'idle';
  });

  controls.copyCss.addEventListener('click', () => {
    if (!controls.copyCss.disabled) {
      copyToClipboard(controls.copyCss.dataset.value);
    }
  });

  controls.copyXpath.addEventListener('click', () => {
    if (!controls.copyXpath.disabled) {
      copyToClipboard(controls.copyXpath.dataset.value);
    }
  });

  controls.addStep.addEventListener('click', () => {
    addStep();
  });

  if (controls.sendBackend) {
    controls.sendBackend.addEventListener('click', () => {
      sendSelectionToBackend({ trigger: 'manual' });
    });
  }

  if (fields.backendEnabled) {
    fields.backendEnabled.addEventListener('change', () => {
      config.backend.enabled = fields.backendEnabled.checked;
      if (!config.backend.enabled) {
        config.backend.lastError = null;
      }
      persistConfig();
      refreshBackendUI();
    });
  }

  if (fields.backendEndpoint) {
    fields.backendEndpoint.addEventListener('input', (event) => {
      config.backend.endpoint = event.target.value.trim();
      persistConfig();
      refreshBackendUI();
    });
  }

  if (fields.backendApiKey) {
    fields.backendApiKey.addEventListener('input', (event) => {
      config.backend.apiKey = event.target.value.trim();
      persistConfig();
    });
  }

  if (fields.backendAuto) {
    fields.backendAuto.addEventListener('change', () => {
      config.backend.autoSend = fields.backendAuto.checked;
      persistConfig();
    });
  }

  document.addEventListener('mousemove', handleMouseMove, true);
  document.addEventListener('click', handleClick, true);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && state.mode === 'live') {
      event.stopPropagation();
      state.mode = 'idle';
      controls.start.disabled = false;
      controls.lock.disabled = true;
      overlay.style.display = 'none';
      toast('Selection paused.');
    }
  }, true);

  refreshBackendUI();
  clearSelection();
})();
