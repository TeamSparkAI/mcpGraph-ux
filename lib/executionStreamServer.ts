/**
 * Server-side execution stream management
 * Handles SSE streams for real-time execution updates
 */

// Store active execution streams (in production, use Redis or similar for multi-instance)
const activeStreams = new Map<string, {
  controller: ReadableStreamDefaultController;
}>();

function sendEvent(controller: ReadableStreamDefaultController, event: string, data: any) {
  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  controller.enqueue(new TextEncoder().encode(message));
}

/**
 * Register a new execution stream
 */
export function registerExecutionStream(executionId: string, controller: ReadableStreamDefaultController) {
  console.log(`[SSE] Registering stream for executionId: ${executionId}`);
  activeStreams.set(executionId, { controller });
  // Send initial connection event
  sendEvent(controller, 'connected', { executionId });
  console.log(`[SSE] Registered stream for executionId: ${executionId}, total streams: ${activeStreams.size}`);
}

/**
 * Unregister an execution stream
 */
export function unregisterExecutionStream(executionId: string) {
  activeStreams.delete(executionId);
}

/**
 * Send an event to a specific execution stream
 */
export function sendExecutionEvent(executionId: string, event: string, data: any) {
  const stream = activeStreams.get(executionId);
  if (stream) {
    try {
      console.log(`[SSE] Sending event ${event} to execution ${executionId}`);
      sendEvent(stream.controller, event, data);
    } catch (error) {
      console.error('Error sending SSE event:', error);
      // Remove broken stream
      activeStreams.delete(executionId);
    }
  } else {
    console.warn(`[SSE] No active stream found for executionId: ${executionId}. Active streams:`, Array.from(activeStreams.keys()));
  }
}

/**
 * Close an execution stream
 */
export function closeExecutionStream(executionId: string) {
  const stream = activeStreams.get(executionId);
  if (stream) {
    try {
      stream.controller.close();
    } catch (error) {
      console.error('Error closing SSE stream:', error);
    }
    activeStreams.delete(executionId);
  }
}

