import axios from "axios";

export interface PredictPayload {
  prompt: string;
  note_path?: string;
  include_memory: boolean;
  include_retrieval: boolean;
}

export interface MemorySnippet {
  source: string;
  text: string;
  metadata: Record<string, string>;
}

export interface RetrievalHit {
  id: string;
  score: number;
  text: string;
  metadata: Record<string, string>;
}

export interface PredictResponse {
  output: string;
  memories: MemorySnippet[];
  retrievals: RetrievalHit[];
  raw_program_output?: Record<string, unknown>;
}

export interface ApiSettings {
  baseUrl: string;
  apiKey?: string;
}

export interface StreamCallbacks {
  onChunk?: (chunk: string) => void;
  onMetadata?: (data: {
    memories: MemorySnippet[];
    retrievals: RetrievalHit[];
    rawProgramOutput?: Record<string, unknown>;
  }) => void;
}

export class DspyClient {
  constructor(private settings: ApiSettings) {}

  async predict(payload: PredictPayload): Promise<PredictResponse> {
    const response = await axios.post<PredictResponse>(
      `${this.settings.baseUrl.replace(/\/$/, "")}/predict`,
      payload,
      {
        headers: this.settings.apiKey
          ? {
              Authorization: `Bearer ${this.settings.apiKey}`
            }
          : undefined
      }
    );
    return response.data;
  }

  async predictStream(
    payload: PredictPayload,
    callbacks: StreamCallbacks = {}
  ): Promise<PredictResponse> {
    const url = `${this.settings.baseUrl.replace(/\/$/, "")}/predict/stream`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        ...(this.settings.apiKey
          ? { Authorization: `Bearer ${this.settings.apiKey}` }
          : {}),
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok || !response.body) {
      throw new Error(`Streaming request failed with status ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    const aggregate: PredictResponse = {
      output: "",
      memories: [],
      retrievals: [],
      raw_program_output: undefined,
    };

    const processBuffer = () => {
      let boundary = buffer.indexOf("\n\n");
      while (boundary !== -1) {
        const rawEvent = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const dataPayload = rawEvent
          .split("\n")
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trimStart())
          .join("\n");

        if (dataPayload.length === 0) {
          boundary = buffer.indexOf("\n\n");
          continue;
        }

        let parsed: any;
        try {
          parsed = JSON.parse(dataPayload);
        } catch (error) {
          console.error("Failed to parse SSE event", error, dataPayload);
          boundary = buffer.indexOf("\n\n");
          continue;
        }

        if (parsed.type === "metadata") {
          if (Array.isArray(parsed.memories)) {
            aggregate.memories = parsed.memories;
          }
          if (Array.isArray(parsed.retrievals)) {
            aggregate.retrievals = parsed.retrievals;
          }
          if (parsed.raw_program_output) {
            aggregate.raw_program_output = parsed.raw_program_output;
          }
          callbacks.onMetadata?.({
            memories: aggregate.memories,
            retrievals: aggregate.retrievals,
            rawProgramOutput: aggregate.raw_program_output,
          });
        } else if (parsed.type === "chunk" && typeof parsed.delta === "string") {
          aggregate.output += parsed.delta;
          callbacks.onChunk?.(parsed.delta);
        } else if (parsed.type === "complete") {
          if (typeof parsed.output === "string") {
            aggregate.output = parsed.output;
          }
          if (Array.isArray(parsed.memories)) {
            aggregate.memories = parsed.memories;
          }
          if (Array.isArray(parsed.retrievals)) {
            aggregate.retrievals = parsed.retrievals;
          }
          if (parsed.raw_program_output) {
            aggregate.raw_program_output = parsed.raw_program_output;
          }
        }

        boundary = buffer.indexOf("\n\n");
      }
    };

    while (true) {
      const { value, done } = await reader.read();
      if (value) {
        buffer += decoder.decode(value, { stream: true });
        processBuffer();
      }
      if (done) {
        buffer += decoder.decode();
        processBuffer();
        break;
      }
    }

    return aggregate;
  }
}
