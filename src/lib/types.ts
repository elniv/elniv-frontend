// Shapes mirror the FastAPI schemas in elniv-backend (schemas/*.py).

export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface ChatResponse {
  status: string;
  conversation_id: string | null;
  reply: string;
}

export interface Checkin {
  id: string;
  mood: string;
  focus_area: string;
  context: string | null;
  created_at: string;
}

export type LLMProvider = "openrouter" | "openai" | "gemini" | "groq";

export interface LLMSettings {
  id: string;
  provider: LLMProvider;
  model: string;
  use_custom_llm: boolean;
  has_api_key?: boolean;
  created_at: string;
  updated_at: string;
}

export interface LLMSettingsUpdate {
  provider: LLMProvider;
  model: string;
  api_key?: string | null;
  use_custom_llm: boolean;
}

export interface ProviderInfo {
  name: LLMProvider;
  display_name: string;
  supports_custom_api_key: boolean;
}

export interface VoiceStatus {
  available: boolean;
  provider: string | null;
}

export interface Transcription {
  text: string;
  provider: string;
}
