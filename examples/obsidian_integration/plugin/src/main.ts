import {
  App,
  MarkdownView,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  ItemView,
  WorkspaceLeaf
} from "obsidian";
import {
  DspyClient,
  MemorySnippet,
  PredictPayload,
  PredictResponse,
  RetrievalHit
} from "./api";
import "../styles.css";

interface DspyPluginSettings {
  baseUrl: string;
  apiKey?: string;
  includeMemoryByDefault: boolean;
  includeRetrievalByDefault: boolean;
  streamResponses: boolean;
}

const DEFAULT_SETTINGS: DspyPluginSettings = {
  baseUrl: "http://localhost:8000",
  apiKey: undefined,
  includeMemoryByDefault: true,
  includeRetrievalByDefault: true,
  streamResponses: true
};

const VIEW_TYPE = "dspy-response-view";

class DspyResponseView extends ItemView {
  private panelEl: HTMLElement;
  private textarea: HTMLTextAreaElement;
  private state: {
    output: string;
    memories: MemorySnippet[];
    retrievals: RetrievalHit[];
  } = { output: "", memories: [], retrievals: [] };

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
    this.panelEl = this.contentEl.createDiv({ cls: "dspy-panel" });
    const heading = this.panelEl.createEl("h2", { text: "DSPy Response" });
    heading.style.marginTop = "0";
    this.textarea = this.panelEl.createEl("textarea");
    this.textarea.readOnly = true;
  }

  getViewType(): string {
    return VIEW_TYPE;
  }

  getDisplayText(): string {
    return "DSPy Response";
  }

  displayResponse(response: PredictResponse) {
    this.state = {
      output: response.output,
      memories: response.memories,
      retrievals: response.retrievals
    };
    this.render();
  }

  reset() {
    this.state = { output: "", memories: [], retrievals: [] };
    this.render();
  }

  appendOutput(delta: string) {
    this.state.output += delta;
    this.render();
  }

  setMemories(memories: MemorySnippet[]) {
    this.state.memories = memories;
    this.render();
  }

  setRetrievals(retrievals: RetrievalHit[]) {
    this.state.retrievals = retrievals;
    this.render();
  }

  private render() {
    const sections: string[] = [];
    if (this.state.output.length > 0) {
      sections.push(this.state.output);
    }
    if (this.state.memories.length > 0) {
      sections.push(
        "Memories:\n" +
          this.state.memories
            .map((memory) => `• [${memory.source}] ${memory.text}`)
            .join("\n")
      );
    }
    if (this.state.retrievals.length > 0) {
      sections.push(
        "Retrievals:\n" +
          this.state.retrievals
            .map((hit) => `• (${hit.score.toFixed(2)}) ${hit.text}`)
            .join("\n")
      );
    }

    this.textarea.value = sections.join("\n\n");
  }
}

export default class DspyObsidianPlugin extends Plugin {
  settings!: DspyPluginSettings;

  async onload() {
    await this.loadSettings();

    this.registerView(
      VIEW_TYPE,
      (leaf) => new DspyResponseView(leaf)
    );

    this.addCommand({
      id: "dspy-predict",
      name: "Predict with Memory",
      editorCallback: async (editor, view) => {
        if (!(view instanceof MarkdownView)) {
          new Notice("DSPy only works in markdown views");
          return;
        }
        const selection = editor.getSelection() || view.getViewData();
        if (!selection || selection.trim().length === 0) {
          new Notice("Select some text or place the cursor in a note first.");
          return;
        }

        const client = new DspyClient({
          baseUrl: this.settings.baseUrl,
          apiKey: this.settings.apiKey
        });

        const payload: PredictPayload = {
          prompt: selection,
          note_path: this.app.workspace.getActiveFile()?.path,
          include_memory: this.settings.includeMemoryByDefault,
          include_retrieval: this.settings.includeRetrievalByDefault
        };

        new Notice("Sending context to DSPy...");

        try {
          if (this.settings.streamResponses) {
            await this.streamResponse(client, payload);
          } else {
            const response = await client.predict(payload);
            await this.showResponse(response);
          }
          new Notice("DSPy response received.");
        } catch (error) {
          console.error(error);
          new Notice("Failed to contact the DSPy backend. Check the console for details.");
        }
      }
    });

    this.addSettingTab(new DspySettingTab(this.app, this));
  }

  async onunload() {
    this.app.workspace.getLeavesOfType(VIEW_TYPE).forEach((leaf) => leaf.detach());
  }

  async showResponse(response: PredictResponse) {
    const view = await this.ensureResponseView();
    if (!view) {
      return;
    }
    view.displayResponse(response);
  }

  private async ensureResponseView(): Promise<DspyResponseView | null> {
    let leaf: WorkspaceLeaf | null = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0] ?? null;
    if (!leaf) {
      leaf = this.app.workspace.getRightLeaf(false);
      if (!leaf) {
        new Notice("Unable to create DSPy response pane");
        return null;
      }
      await leaf.setViewState({ type: VIEW_TYPE, active: true });
    }
    this.app.workspace.revealLeaf(leaf);
    return leaf.view as unknown as DspyResponseView;
  }

  private async streamResponse(client: DspyClient, payload: PredictPayload) {
    const view = await this.ensureResponseView();
    if (!view) {
      return;
    }
    view.reset();

    try {
      const response = await client.predictStream(payload, {
        onChunk: (chunk) => view.appendOutput(chunk),
        onMetadata: ({ memories, retrievals }) => {
          view.setMemories(memories);
          view.setRetrievals(retrievals);
        }
      });
      view.displayResponse(response);
    } catch (error) {
      console.error("Streaming failed, falling back to standard request", error);
      const response = await client.predict(payload);
      view.displayResponse(response);
    }
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

class DspySettingTab extends PluginSettingTab {
  plugin: DspyObsidianPlugin;

  constructor(app: App, plugin: DspyObsidianPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "DSPy Backend Settings" });

    new Setting(containerEl)
      .setName("Backend URL")
      .setDesc("Base URL of the FastAPI service")
      .addText((text) =>
        text
          .setPlaceholder("http://localhost:8000")
          .setValue(this.plugin.settings.baseUrl)
          .onChange(async (value) => {
            this.plugin.settings.baseUrl = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("API Key")
      .setDesc("Optional bearer token to include in requests")
      .addText((text) =>
        text
          .setPlaceholder("sk-...")
          .setValue(this.plugin.settings.apiKey ?? "")
          .onChange(async (value) => {
            this.plugin.settings.apiKey = value.trim() || undefined;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Include Memory")
      .setDesc("Send memories by default when querying DSPy")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.includeMemoryByDefault)
          .onChange(async (value) => {
            this.plugin.settings.includeMemoryByDefault = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Include Retrieval")
      .setDesc("Send OpenSearch retrieval results by default")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.includeRetrievalByDefault)
          .onChange(async (value) => {
            this.plugin.settings.includeRetrievalByDefault = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Stream Responses")
      .setDesc("Attempt to stream partial responses over Server-Sent Events")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.streamResponses)
          .onChange(async (value) => {
            this.plugin.settings.streamResponses = value;
            await this.plugin.saveSettings();
          })
      );
  }
}
