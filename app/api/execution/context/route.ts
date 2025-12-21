import { NextRequest, NextResponse } from 'next/server';
import { getController } from '@/lib/executionController';
import { getApi } from '@/lib/mcpGraphApi';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const executionId = request.nextUrl.searchParams.get('executionId');
    const nodeId = request.nextUrl.searchParams.get('nodeId');
    const sequenceIdParam = request.nextUrl.searchParams.get('sequenceId');
    
    if (!executionId) {
      return NextResponse.json(
        { error: 'Missing executionId parameter' },
        { status: 400 }
      );
    }
    
    if (!nodeId || !sequenceIdParam) {
      return NextResponse.json(
        { error: 'Missing nodeId or sequenceId parameter' },
        { status: 400 }
      );
    }

    const sequenceId = parseInt(sequenceIdParam, 10);
    if (isNaN(sequenceId)) {
      return NextResponse.json(
        { error: 'Invalid sequenceId parameter' },
        { status: 400 }
      );
    }

    // Try to get controller first (for active executions)
    const controller = getController(executionId);
    let context: Record<string, unknown> | null = null;
    
    if (controller) {
      // Use controller's context directly (works for active executions)
      try {
        const state = controller.getState();
        context = state.context.getContextForExecution(sequenceId);
        console.log(`[API] Got context from controller for executionIndex=${sequenceId}, nodeId=${nodeId}:`, context ? 'present' : 'null');
      } catch (error) {
        console.error(`[API] Error getting context from controller:`, error);
      }
    } else {
      // Fallback to API method (may not work after execution completes)
      const api = getApi();
      if (api) {
        context = api.getContextForExecution(sequenceId);
        console.log(`[API] Got context from API for executionIndex=${sequenceId}, nodeId=${nodeId}:`, context ? 'present' : 'null');
      } else {
        console.error(`[API] No controller or API available`);
      }
    }
    
    return NextResponse.json({ context: context || null });
  } catch (error) {
    console.error('Error getting node input context:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

