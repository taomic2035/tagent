// tagent core 公共 API 入口
export { CORE_VERSION } from "./version.js";
export type {
  AgentConfig,
  AgentGuards,
  ChatMessage,
  SteeringChannel,
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
  MemoryStore,
  scoreRecall,
  type MemoryFact,
  type RecalledFact,
} from "./store.js";
export {
  estimateTokens,
  estimateMessagesTokens,
  trimMessages,
  compactMessages,
  type TrimPolicy,
  type TrimResult,
  type CompactPolicy,
  type CompactResult,
} from "./memory.js";
export {
  toolCalled,
  toolResultOk,
  finalAnswers,
  all,
  predicateFromSpec,
  type TaskPredicate,
  type PredicateResult,
} from "./predicate.js";
export {
  shouldTerminateByTools, spillIfOversized, withSpill, headTailWindow,
  CellAuthority, runCodeCell, auditEffectSandwich,
  transitionAwait, baselineDiff, detectFalseCompletion,
} from "./industrial.js";
export type { SpillMeta, TerminateCapableEnvelope, ExecuteCodeDeps, CellResult,
  OrphanReport, AwaitState, AwaitTransition, VerdictClaim } from "./industrial.js";
export { SessionTree } from "./session-tree.js";
export type { SessionEntry } from "./session-tree.js";
export {
  applyBallEvent, BallCustodyEventLog, DEAD_BALL_ZOMBIE_GRACE_MS,
} from "./ball-custody.js";
export type { BallState, BallEvent, BallEventKind, BallSnapshot, BallTransitionResult } from "./ball-custody.js";
export {
  extractRouteTargets, pingPongUpdate, A2ABoard, FauxClient, DEFAULT_PINGPONG,
} from "./a2a.js";
export type { RouteTargets, PingPongConfig, PingPongVerdict, QueueEntry,
  HistoryMessage, ActiveRun, FauxStep, FauxUsage } from "./a2a.js";
export {
  normalizeCommand, decideApproval, learnAllowRule,
  HARDLINE_PATTERNS, DEFAULT_APPROVAL,
} from "./approval.js";
export type { ApprovalDecision, ApprovalConfig } from "./approval.js";
export {
  assertPredicateRegistryReady, PREDICATE_CAPABILITY_REGISTRY,
} from "./predicate.js";
export type { PredicateCapability, ManualOnlyCheck } from "./predicate.js";
