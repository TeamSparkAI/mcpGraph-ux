import { NextResponse } from 'next/server';
import { type ExecutionOptions, type ExecutionHooks, type ExecutionResult } from 'mcpgraph';
import { getApi } from '@/lib/mcpGraphApi';
import { sendExecutionEvent, closeExecutionStream } from '@/lib/executionStreamServer';
import { registerController, unregisterController, getController } from '@/lib/executionController';


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
    
    // Log breakpoints received
    const breakpointsReceived = executionOptions?.breakpoints || [];
    console.log(`[API] Received breakpoints: ${breakpointsReceived.length > 0 ? breakpointsReceived.join(', ') : 'none'}`);

    // If executionId is provided, set up hooks to stream events via SSE
    // Store breakpoints for use in hooks (controller may not be available yet)
    const breakpointsList = executionOptions?.breakpoints || [];
    let hooks: ExecutionHooks | undefined;
    if (executionId) {
      const execId = executionId; // Capture in const for closure
      console.log(`[API] Setting up hooks for executionId: ${execId}, breakpoints: ${breakpointsList.join(', ')}`);
      hooks = {
        onNodeStart: async (executionIndex, nodeId, node, context) => {
          console.log(`[API] onNodeStart hook called for node: ${nodeId}, executionIndex: ${executionIndex}`);
          
          // Check if this node should have a breakpoint
          const controller = getController(execId);
          if (controller && breakpointsList.includes(nodeId)) {
            const controllerBreakpoints = controller.getBreakpoints();
            const state = controller.getState();
            console.log(`[API] WARNING: onNodeStart called for node ${nodeId} which has a breakpoint!`);
            console.log(`[API] Controller breakpoints: ${controllerBreakpoints.length > 0 ? controllerBreakpoints.join(', ') : 'none'}`);
            console.log(`[API] Controller status: ${state.status}, currentNodeId: ${state.currentNodeId}`);
          }
          
          sendExecutionEvent(execId, 'nodeStart', {
            nodeId,
            nodeType: node.type,
            executionIndex,
            context, // Send context so client can determine input
            timestamp: Date.now(),
          });
          
          // Note: mcpGraph should check breakpoints internally before executing nodes
          // If we reach here, the node is starting. The controller's breakpoint checking
          // should have paused execution before this hook is called.
          
          return true; // Continue execution
        },
        onNodeComplete: async (executionIndex, nodeId, node, input, output, duration) => {
          sendExecutionEvent(execId, 'nodeComplete', {
            nodeId,
            nodeType: node.type,
            executionIndex,
            input,
            output,
            duration,
            timestamp: Date.now(),
          });
        },
        onNodeError: async (executionIndex, nodeId, node, error, context) => {
          sendExecutionEvent(execId, 'nodeError', {
            nodeId,
            nodeType: node.type,
            executionIndex,
            input: context, // Include context as input (mcpGraph 0.1.19+ provides actual context)
            error: {
              message: error.message,
              stack: error.stack,
            },
            timestamp: Date.now(),
          });
        },
        onPause: async (executionIndex, nodeId, context) => {
          console.log(`[API] onPause hook called for node: ${nodeId}, executionIndex: ${executionIndex}`);
          
          // Look up node type from config
          const api = getApi();
          const config = api.getConfig();
          const node = config.nodes.find(n => n.id === nodeId);
          const nodeType = node?.type || 'unknown';
          
          sendExecutionEvent(execId, 'pause', {
            nodeId,
            nodeType,
            executionIndex,
            context, // Include context so client can show input for pending node
            timestamp: Date.now(),
          });
          // Send stateUpdate to ensure UI status is updated
          sendExecutionEvent(execId, 'stateUpdate', {
            status: 'paused',
            currentNodeId: nodeId,
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
            onNodeStart: async (executionIndex, nodeId, node, context) => {
              const hook1 = hooks?.onNodeStart;
              const hook2 = executionOptions.hooks?.onNodeStart;
              const result1 = hook1 ? await hook1(executionIndex, nodeId, node, context) : true;
              const result2 = hook2 ? await hook2(executionIndex, nodeId, node, context) : true;
              return result1 && result2;
            },
            onNodeComplete: async (executionIndex, nodeId, node, input, output, duration) => {
              await hooks?.onNodeComplete?.(executionIndex, nodeId, node, input, output, duration);
              await executionOptions.hooks?.onNodeComplete?.(executionIndex, nodeId, node, input, output, duration);
            },
            onNodeError: async (executionIndex, nodeId, node, error, context) => {
              await hooks?.onNodeError?.(executionIndex, nodeId, node, error, context);
              await executionOptions.hooks?.onNodeError?.(executionIndex, nodeId, node, error, context);
            },
            onPause: async (executionIndex, nodeId, context) => {
              await hooks?.onPause?.(executionIndex, nodeId, context);
              await executionOptions.hooks?.onPause?.(executionIndex, nodeId, context);
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
    const finalBreakpoints = finalOptions.breakpoints || [];
    console.log(`[API] Final options breakpoints: ${finalBreakpoints.length > 0 ? finalBreakpoints.join(', ') : 'none'}`);
    console.log(`[API] Final options object:`, JSON.stringify({ 
      breakpoints: finalBreakpoints, 
      enableTelemetry: finalOptions.enableTelemetry,
      hasHooks: !!finalOptions.hooks
    }, null, 2));
    
    // Start execution and get controller directly (mcpGraph 0.1.11+ returns both)
    const { promise: executionPromise, controller } = api.executeTool(params.toolName, args, finalOptions);
    
    console.log(`[API] executeTool returned controller: ${controller ? 'present' : 'null'}, executionId: ${executionId || 'none'}`);
    
    // Register controller immediately if we have executionId and controller
    if (executionId && controller) {
      const execId = executionId; // Capture in const for closure
      registerController(execId, controller);
      console.log(`[API] Registered controller for executionId: ${execId}`);
      
      // Log breakpoints on controller
      const controllerBreakpoints = controller.getBreakpoints();
      console.log(`[API] Controller breakpoints: ${controllerBreakpoints.length > 0 ? controllerBreakpoints.join(', ') : 'none'}`);
    } else {
      if (!executionId) {
        console.log(`[API] WARNING: No executionId provided, controller not registered`);
      }
      if (!controller) {
        console.log(`[API] WARNING: Controller is null, cannot register. Hooks: ${!!finalOptions.hooks}, Breakpoints: ${finalBreakpoints.length > 0 ? finalBreakpoints.join(', ') : 'none'}`);
      }
    }
    
    const result = await executionPromise;
    console.log(`[API] Tool execution completed, result:`, result.result ? 'present' : 'missing');

    // Send completion event and close stream
    if (executionId) {
      const execId = executionId; // Capture in const for closure
      console.log(`[API] Sending executionComplete event for executionId: ${execId}`);
      
      // Fetch input contexts for all execution records BEFORE unregistering controller
      // Use the controller's context directly since api.getContextForExecution() requires active controller
      const controller = getController(execId);
      console.log(`[API] Fetching input contexts for ${result.executionHistory?.length || 0} records`);
      const executionHistoryWithInput = (result.executionHistory || []).map((record) => {
        console.log(`[API] Processing record: nodeId=${record.nodeId}, executionIndex=${record.executionIndex}`);
        try {
          let context: Record<string, unknown> | null = null;
          if (controller) {
            const state = controller.getState();
            context = state.context.getContextForExecution(record.executionIndex);
          } else {
            console.warn(`[API] Controller not found for ${execId}, trying API method`);
            context = api.getContextForExecution(record.executionIndex);
          }
          console.log(`[API] Got context for ${record.nodeId}:`, context ? 'present' : 'null', context);
          return {
            ...record,
            input: context || undefined,
          };
        } catch (error) {
          console.error(`[API] Error getting context for executionIndex ${record.executionIndex}:`, error);
          return record;
        }
      });
      console.log(`[API] Final execution history with input:`, JSON.stringify(executionHistoryWithInput, null, 2));

      sendExecutionEvent(execId, 'executionComplete', {
        result: result.result,
        executionHistory: executionHistoryWithInput,
        telemetry: result.telemetry
          ? {
              ...result.telemetry,
              nodeDurations: Object.fromEntries(result.telemetry.nodeDurations),
              nodeCounts: Object.fromEntries(result.telemetry.nodeCounts),
            }
          : undefined,
        timestamp: Date.now(),
      });
      // Close stream immediately - enqueue is synchronous, event is already sent
      console.log(`[API] Closing stream for executionId: ${execId}`);
      closeExecutionStream(execId);
      unregisterController(execId);
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
    
    // Check if execution was stopped (not a real error)
    const isStopped = error instanceof Error && error.message === 'Execution was stopped';
    
    if (executionId) {
      const execId = executionId; // Capture in const for closure
      
      if (isStopped) {
        // Execution was stopped by user - send stopped event, not error
        sendExecutionEvent(execId, 'executionStopped', {
          timestamp: Date.now(),
        });
      } else {
        // Real error occurred
        sendExecutionEvent(execId, 'executionError', {
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: Date.now(),
        });
      }
      
      // Close stream immediately - enqueue is synchronous, event is already sent
      closeExecutionStream(execId);
      unregisterController(execId);
    }
    
    // If stopped, return success (stopping is intentional)
    if (isStopped) {
      return NextResponse.json({ 
        result: null,
        stopped: true 
      });
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

