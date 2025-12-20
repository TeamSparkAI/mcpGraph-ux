import { NextRequest, NextResponse } from 'next/server';
import { getController, unregisterController, getAllExecutionIds } from '@/lib/executionController';
import { sendExecutionEvent, closeExecutionStream } from '@/lib/executionStreamServer';
import { getApi } from '@/lib/mcpGraphApi';


export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { executionId, action } = body;

    if (!executionId) {
      return NextResponse.json(
        { error: 'Missing executionId' },
        { status: 400 }
      );
    }

    if (!action || !['pause', 'resume', 'step', 'stop'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be one of: pause, resume, step, stop' },
        { status: 400 }
      );
    }

    console.log(`[Controller API] Looking for controller with executionId: ${executionId}`);
    // Force getApi to be called to ensure module is loaded
    const api = getApi();
    console.log(`[Controller API] API instance: ${api ? 'present' : 'null'}`);
    const controller = getController(executionId);
    if (!controller) {
      console.log(`[Controller API] Controller not found for executionId: ${executionId}`);
      // Log all registered executionIds for debugging
      const allIds = getAllExecutionIds();
      console.log(`[Controller API] Currently registered executionIds: ${allIds.length > 0 ? allIds.join(', ') : 'none'}`);
      return NextResponse.json(
        { error: 'Execution not found or not active' },
        { status: 404 }
      );
    }
    console.log(`[Controller API] Found controller for executionId: ${executionId}, status: ${controller.getState().status}`);

    const state = controller.getState();
    
    switch (action) {
      case 'pause':
        if (state.status !== 'running') {
          return NextResponse.json(
            { error: `Cannot pause: execution status is ${state.status}` },
            { status: 400 }
          );
        }
        controller.pause();
        // Don't send stateUpdate here - onPause hook will send it
        return NextResponse.json({ success: true, status: 'paused' });

      case 'resume':
        if (state.status !== 'paused') {
          return NextResponse.json(
            { error: `Cannot resume: execution status is ${state.status}` },
            { status: 400 }
          );
        }
        controller.resume();
        // Don't send stateUpdate here - the onResume hook already sends it
        return NextResponse.json({ success: true, status: 'running' });

      case 'step':
        if (state.status !== 'paused') {
          return NextResponse.json(
            { error: `Cannot step: execution status is ${state.status}` },
            { status: 400 }
          );
        }
        await controller.step();
        const newState = controller.getState();
        // Don't send stateUpdate here - the onPause hook already sends the correct stateUpdate
        // when step completes and pauses at the next node
        return NextResponse.json({ 
          success: true, 
          status: newState.status,
          currentNodeId: newState.currentNodeId,
        });

      case 'stop':
        if (state.status !== 'running' && state.status !== 'paused') {
          return NextResponse.json(
            { error: `Cannot stop: execution status is ${state.status}` },
            { status: 400 }
          );
        }
        
        // Call stop() - this sets status to "stopped" and will cause execution to throw "Execution was stopped"
        controller.stop();
        
        // Send stopped event
        sendExecutionEvent(executionId, 'executionStopped', {
          timestamp: Date.now(),
        });
        
        // Clean up controller and stream
        unregisterController(executionId);
        closeExecutionStream(executionId);
        
        return NextResponse.json({ success: true, status: 'stopped' });

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error in controller action:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

