// tagent core 公共 API 入口
export { CORE_VERSION } from "./version.js";
export type {
  AgentConfig,
  ChatMessage,
  Tool,
  ToolCallData,
  ToolContext,
  ToolDef,
  StreamEvent,
  Usage,
} from "./types.js";
export {
  LLMHttpError,
  LLMStreamError,
  OpenAIClient,
  sseEvents,
} from "./client.js";
export type { ChatRequest, LLMClient } from "./client.js";
export {
  ToolRegistry,
  type ToolResultEnvelope,
  type ToolResultFail,
  type ToolResultOk,
} from "./tools.js";
