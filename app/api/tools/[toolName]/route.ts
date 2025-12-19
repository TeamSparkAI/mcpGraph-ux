import { NextResponse } from 'next/server';
import { McpGraphApi, type ExecutionOptions, type ExecutionHooks } from 'mcpgraph';
import { sendExecutionEvent, closeExecutionStream } from '@/lib/executionStreamServer';

// Force dynamic rendering - this route requires runtime config
export const dynamic = 'force-dynamic';

let apiInstance: McpGraphApi | null = null;

function getApi(): McpGraphApi {
  const configPath = process.env.MCPGRAPH_CONFIG_PATH;
  if (!configPath) {
    throw new Error('MCPGRAPH_CONFIG_PATH environment variable is not set');
  }

  if (!apiInstance) {
    apiInstance = new McpGraphApi(configPath);
  }

  return apiInstance;
}

export async function GET(
  request: Request,
  { params }: { params: { toolName: string } }
) {
  try {
    const api = getApi();
    const tool = api.getTool(params.toolName);
    
    if (!tool) {
      return NextResponse.json(
        { error: `Tool '${params.toolName}' not found` },
        { status: 404 }
      );
    }

    return NextResponse.json({ tool });
  } catch (error) {
    console.error('Error getting tool:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: { toolName: string } }
) {
  let executionId: string | undefined;
  try {
    const api = getApi();
    const body = await request.json();
    const args = body.args || {};
    executionId = body.executionId as string | undefined;
    const executionOptions = body.options as ExecutionOptions | undefined;

    // If executionId is provided, set up hooks to stream events via SSE
    let hooks: ExecutionHooks | undefined;
    if (executionId) {
      const execId = executionId; // Capture in const for closure
      console.log(`[API] Setting up hooks for executionId: ${execId}`);
      hooks = {
        onNodeStart: async (nodeId, node, context) => {
          console.log(`[API] onNodeStart hook called for node: ${nodeId}`);
          sendExecutionEvent(execId, 'nodeStart', {
            nodeId,
            nodeType: node.type,
            timestamp: Date.now(),
          });
          return true; // Continue execution
        },
        onNodeComplete: async (nodeId, node, input, output, duration) => {
          sendExecutionEvent(execId, 'nodeComplete', {
            nodeId,
            nodeType: node.type,
            input,
            output,
            duration,
            timestamp: Date.now(),
          });
        },
        onNodeError: async (nodeId, node, error, context) => {
          sendExecutionEvent(execId, 'nodeError', {
            nodeId,
            nodeType: node.type,
            error: {
              message: error.message,
              stack: error.stack,
            },
            timestamp: Date.now(),
          });
        },
        onPause: async (nodeId, context) => {
          sendExecutionEvent(execId, 'pause', {
            nodeId,
            timestamp: Date.now(),
          });
        },
        onResume: async () => {
          sendExecutionEvent(execId, 'resume', {
            timestamp: Date.now(),
          });
        },
      };
    }

    // Merge with provided hooks if any
    const finalOptions: ExecutionOptions = {
      ...executionOptions,
      hooks: executionOptions?.hooks
        ? {
            ...hooks,
            ...executionOptions.hooks,
            // Merge hook functions - call both
            onNodeStart: async (nodeId, node, context) => {
              const hook1 = hooks?.onNodeStart;
              const hook2 = executionOptions.hooks?.onNodeStart;
              const result1 = hook1 ? await hook1(nodeId, node, context) : true;
              const result2 = hook2 ? await hook2(nodeId, node, context) : true;
              return result1 && result2;
            },
            onNodeComplete: async (nodeId, node, input, output, duration) => {
              await hooks?.onNodeComplete?.(nodeId, node, input, output, duration);
              await executionOptions.hooks?.onNodeComplete?.(nodeId, node, input, output, duration);
            },
            onNodeError: async (nodeId, node, error, context) => {
              await hooks?.onNodeError?.(nodeId, node, error, context);
              await executionOptions.hooks?.onNodeError?.(nodeId, node, error, context);
            },
            onPause: async (nodeId, context) => {
              await hooks?.onPause?.(nodeId, context);
              await executionOptions.hooks?.onPause?.(nodeId, context);
            },
            onResume: async () => {
              await hooks?.onResume?.();
              await executionOptions.hooks?.onResume?.();
            },
          }
        : hooks,
      breakpoints: executionOptions?.breakpoints,
      enableTelemetry: executionOptions?.enableTelemetry ?? true, // Enable by default for UX
    };

    console.log(`[API] Executing tool ${params.toolName} with executionId: ${executionId || 'none'}`);
    const result = await api.executeTool(params.toolName, args, finalOptions);
    console.log(`[API] Tool execution completed, result:`, result.result ? 'present' : 'missing');

    // Send completion event and close stream
    if (executionId) {
      const execId = executionId; // Capture in const for closure
      console.log(`[API] Sending executionComplete event for executionId: ${execId}`);
      sendExecutionEvent(execId, 'executionComplete', {
        result: result.result,
        executionHistory: result.executionHistory,
        telemetry: result.telemetry
          ? {
              ...result.telemetry,
              nodeDurations: Object.fromEntries(result.telemetry.nodeDurations),
              nodeCounts: Object.fromEntries(result.telemetry.nodeCounts),
            }
          : undefined,
        timestamp: Date.now(),
      });
      // Close stream after a short delay to ensure final event is sent
      setTimeout(() => {
        console.log(`[API] Closing stream for executionId: ${execId}`);
        closeExecutionStream(execId);
      }, 100);
    }

    // Serialize telemetry Maps for JSON response
    const responseResult = {
      ...result,
      telemetry: result.telemetry
        ? {
            ...result.telemetry,
            nodeDurations: Object.fromEntries(result.telemetry.nodeDurations),
            nodeCounts: Object.fromEntries(result.telemetry.nodeCounts),
          }
        : undefined,
    };
    
    return NextResponse.json({ result: responseResult });
  } catch (error) {
    console.error('Error executing tool:', error);
    
    // Send error event if executionId exists
    if (executionId) {
      const execId = executionId; // Capture in const for closure
      sendExecutionEvent(execId, 'executionError', {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now(),
      });
      setTimeout(() => closeExecutionStream(execId), 100);
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

