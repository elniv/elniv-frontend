import { api, ApiError, streamRequest } from "./api";
import type {
  ChatResponse,
  Checkin,
  Conversation,
  LLMSettings,
  LLMSettingsUpdate,
  Message,
  Page,
  ProviderInfo,
  Transcription,
  VoiceStatus,
} from "./types";

// FastAPI routes are declared with trailing slashes on collection roots. Calling them
// without one would trigger a redirect, which browsers can't follow across origins
// with an Authorization header, so the paths below match the backend exactly.

export const chatApi = {
  send: (message: string, conversationId: string | null, signal?: AbortSignal) =>
    api.post<ChatResponse>("/chat/", { message, conversation_id: conversationId }, { timeoutMs: 90_000, signal }),
  /**
   * Stream the reply, calling `onDelta` per chunk. Falls back to the non-streaming
   * endpoint if the server has no /chat/stream route (older backend); a 404 for a missing
   * conversation reads "Conversation not found.", so it isn't mistaken for that.
   */
  stream: async (message: string, conversationId: string | null, onDelta: (text: string) => void, signal?: AbortSignal): Promise<ChatResponse> => {
    const body = { message, conversation_id: conversationId };
    try {
      const done = await streamRequest<{ conversation_id: string; reply: string }>("/chat/stream", body, { onDelta }, signal);
      return { status: "success", conversation_id: done.conversation_id, reply: done.reply };
    } catch (error) {
      if (error instanceof ApiError && (error.status === 405 || (error.status === 404 && error.message === "Not Found"))) {
        return chatApi.send(message, conversationId, signal);
      }
      throw error;
    }
  },
};

export const conversationsApi = {
  list: (limit = 100, offset = 0) => api.get<Page<Conversation>>(`/conversations/?limit=${limit}&offset=${offset}`),
  messages: (id: string, offset = 0, limit = 100, signal?: AbortSignal) =>
    api.get<Page<Message>>(`/conversations/${id}/messages?limit=${limit}&offset=${offset}`, { signal }),
  rename: (id: string, title: string) => api.patch<Conversation>(`/conversations/${id}`, { title }),
  remove: (id: string) => api.delete(`/conversations/${id}`),
};

/** Load every message in a conversation, following pagination. */
export async function loadAllMessages(id: string, signal?: AbortSignal): Promise<Message[]> {
  const all: Message[] = [];
  for (;;) {
    const page = await conversationsApi.messages(id, all.length, 100, signal);
    all.push(...page.items);
    if (page.items.length === 0 || all.length >= page.total) return all;
  }
}

export const checkinsApi = {
  list: (limit = 50, offset = 0) => api.get<Page<Checkin>>(`/checkins/?limit=${limit}&offset=${offset}`),
  create: (input: { mood: string; focus_area: string; context?: string | null }) => api.post<Checkin>("/checkins/", input),
  remove: (id: string) => api.delete(`/checkins/${id}`),
};

export const llmApi = {
  get: () => api.get<LLMSettings | null>("/llm-settings/"),
  save: (input: LLMSettingsUpdate) => api.put<LLMSettings>("/llm-settings/", input),
  reset: () => api.delete("/llm-settings/"),
  providers: () => api.get<ProviderInfo[]>("/llm-settings/providers"),
};

export const voiceApi = {
  status: () => api.get<VoiceStatus>("/voice/status"),
  transcribe: (blob: Blob, filename: string, language?: string) => {
    const form = new FormData();
    form.append("audio", blob, filename);
    if (language) form.append("language", language);
    return api.upload<Transcription>("/voice/transcribe", form);
  },
};
