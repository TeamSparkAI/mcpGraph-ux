import { McpGraphApi } from 'mcpgraph';
import type { ExecutionController } from 'mcpgraph';

// Use globalThis to persist across Next.js module recompilations
const GLOBAL_KEY = '__mcpGraphUX_singleton__';
type GlobalState = {
  apiInstance?: McpGraphApi;
  activeControllers?: Map<string, ExecutionController>;
  activeStreams?: Map<string, { controller: ReadableStreamDefaultController }>;
};

function getGlobalState(): GlobalState {
  const global = globalThis as typeof globalThis & { [GLOBAL_KEY]?: GlobalState };
  if (!global[GLOBAL_KEY]) {
    global[GLOBAL_KEY] = {};
  }
  return global[GLOBAL_KEY]!;
}

/**
 * Get or create the shared McpGraphApi instance.
 * This ensures the config is only loaded once across all API routes.
 */
export function getApi(): McpGraphApi {
  const state = getGlobalState();
  const configPath = process.env.MCPGRAPH_CONFIG_PATH;
  if (!configPath) {
    throw new Error('MCPGRAPH_CONFIG_PATH environment variable is not set');
  }

  if (!state.apiInstance) {
    console.log(`[mcpGraphApi] Creating new API instance`);
    state.apiInstance = new McpGraphApi(configPath);
  } else {
    console.log(`[mcpGraphApi] Returning existing API instance (controllers: ${state.activeControllers?.size || 0}, streams: ${state.activeStreams?.size || 0})`);
  }

  return state.apiInstance;
}

/**
 * Get the controllers map (persists across module recompilations)
 */
export function getControllersMap(): Map<string, ExecutionController> {
  const state = getGlobalState();
  if (!state.activeControllers) {
    console.log(`[mcpGraphApi] Creating new controllers map`);
    state.activeControllers = new Map<string, ExecutionController>();
  }
  return state.activeControllers;
}

/**
 * Get the streams map (persists across module recompilations)
 */
export function getStreamsMap(): Map<string, { controller: ReadableStreamDefaultController }> {
  const state = getGlobalState();
  if (!state.activeStreams) {
    state.activeStreams = new Map<string, { controller: ReadableStreamDefaultController }>();
  }
  return state.activeStreams;
}

