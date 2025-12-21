import { NextRequest, NextResponse } from 'next/server';
import { getController } from '@/lib/executionController';
import { getApi } from '@/lib/mcpGraphApi';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const executionId = request.nextUrl.searchParams.get('executionId');
    
    if (!executionId) {
      return NextResponse.json(
        { error: 'Missing executionId parameter' },
        { status: 400 }
      );
    }

    const controller = getController(executionId);
    if (!controller) {
      return NextResponse.json(
        { error: 'Execution not found or not active' },
        { status: 404 }
      );
    }

    // Get execution history from the controller's state
    const state = controller.getState();
    const history = state.executionHistory || [];
    
    return NextResponse.json({ history });
  } catch (error) {
    console.error('Error getting execution history:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

