// tagent core 公共 API 入口
export { CORE_VERSION } from "./version.js";
export type {
  AgentConfig,
  ChatMessage,
  Tool,
  ToolCallData,
  ToolContext,
  ToolDef,
  ToolExecPolicy,
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
  TransientToolError,
  type ToolResultEnvelope,
  type ToolResultFail,
  type ToolResultOk,
} from "./tools.js";
export { runAgent, type AgentEvent, type AgentDeps } from "./loop.js";
export {
  runReAct,
  parseAction,
  parseActionJson,
  reactJsonResponseFormat,
  REACT_SYSTEM_PROMPT,
  REACT_JSON_SYSTEM_PROMPT,
  type ActionParse,
} from "./react.js";
export {
  estimateTokens,
  estimateMessagesTokens,
  trimMessages,
  type TrimPolicy,
  type TrimResult,
} from "./memory.js";
