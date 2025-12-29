/**
 * Server-side execution stream management
 * Handles SSE streams for real-time execution updates
 * Uses the same module scope as the API instance
 */

import { getStreamsMap } from './mcpGraphApi';

function sendEvent(controller: ReadableStreamDefaultController, event: string, data: unknown) {
  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  controller.enqueue(new TextEncoder().encode(message));
}

/**
 * Register a new execution stream
 */
export function registerExecutionStream(executionId: string, controller: ReadableStreamDefaultController) {
  console.log(`[SSE] Registering stream for executionId: ${executionId}`);
  const streams = getStreamsMap();
  streams.set(executionId, { controller });
  // Send initial connection event
  sendEvent(controller, 'connected', { executionId });
  console.log(`[SSE] Registered stream for executionId: ${executionId}, total streams: ${streams.size}`);
}

/**
 * Unregister an execution stream
 */
export function unregisterExecutionStream(executionId: string) {
  getStreamsMap().delete(executionId);
}

/**
 * Send an event to a specific execution stream
 */
export function sendExecutionEvent(executionId: string, event: string, data: unknown) {
  const streams = getStreamsMap();
  const stream = streams.get(executionId);
  if (stream) {
    try {
      console.log(`[SSE] Sending event ${event} to execution ${executionId}`);
      sendEvent(stream.controller, event, data);
    } catch (error) {
      console.error('Error sending SSE event:', error);
      // Remove broken stream
      streams.delete(executionId);
    }
  } else {
    console.warn(`[SSE] No active stream found for executionId: ${executionId}. Active streams:`, Array.from(streams.keys()));
  }
}

/**
 * Close an execution stream
 */
export function closeExecutionStream(executionId: string) {
  const streams = getStreamsMap();
  const stream = streams.get(executionId);
  if (stream) {
    try {
      stream.controller.close();
    } catch (error) {
      console.error('Error closing SSE stream:', error);
    }
    streams.delete(executionId);
  }
}

