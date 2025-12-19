/**
 * Execution stream abstraction for real-time execution updates
 * Uses Server-Sent Events (SSE) but abstracted for easy migration if needed
 */

export interface ExecutionEvent {
  type: string;
  data: any;
  timestamp: number;
}

export type ExecutionEventCallback = (event: ExecutionEvent) => void;

export interface ExecutionStream {
  connect(callback: ExecutionEventCallback): void;
  disconnect(): void;
  isConnected(): boolean;
}

export class SSEExecutionStream implements ExecutionStream {
  private eventSource: EventSource | null = null;
  private callback: ExecutionEventCallback | null = null;
  private executionId: string;

  constructor(executionId: string) {
    this.executionId = executionId;
  }

  connect(callback: ExecutionEventCallback): void {
    if (this.eventSource) {
      this.disconnect();
    }

    this.callback = callback;

    const url = `/api/execution/stream?executionId=${encodeURIComponent(this.executionId)}`;
    this.eventSource = new EventSource(url);

    this.eventSource.onopen = () => {
      console.log(`[SSE Client] Connection opened for executionId: ${this.executionId}`);
    };

    this.eventSource.onerror = (error) => {
      console.error(`[SSE Client] Connection error for executionId: ${this.executionId}`, error, this.eventSource?.readyState);
      // EventSource automatically reconnects, but we should handle errors
    };

    // Listen for all event types
    this.eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (this.callback) {
          this.callback({
            type: event.type || 'message',
            data,
            timestamp: data.timestamp || Date.now(),
          });
        }
      } catch (error) {
        console.error('Error parsing SSE event:', error);
      }
    };

    // Listen for specific event types
    const eventTypes = [
      'connected',
      'nodeStart',
      'nodeComplete',
      'nodeError',
      'pause',
      'resume',
      'executionComplete',
      'executionError',
      'stateUpdate',
    ];

    eventTypes.forEach((eventType) => {
      this.eventSource?.addEventListener(eventType, (event: any) => {
        try {
          console.log(`[SSE Client] Received event: ${eventType}`, event.data);
          const data = JSON.parse(event.data);
          if (this.callback) {
            this.callback({
              type: eventType,
              data,
              timestamp: data.timestamp || Date.now(),
            });
          }
        } catch (error) {
          console.error(`[SSE Client] Error parsing SSE event (${eventType}):`, error);
        }
      });
    });
  }

  disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.callback = null;
  }

  isConnected(): boolean {
    return this.eventSource !== null && this.eventSource.readyState === EventSource.OPEN;
  }
}

/**
 * Generate a unique execution ID
 */
export function generateExecutionId(): string {
  return `exec_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

