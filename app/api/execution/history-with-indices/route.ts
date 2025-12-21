import { NextRequest, NextResponse } from 'next/server';
import { getController } from '@/lib/executionController';
import { getApi } from '@/lib/mcpGraphApi';
import type { NodeExecutionRecord } from 'mcpgraph';

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

    const api = getApi();
    if (!api) {
      return NextResponse.json(
        { error: 'API instance not available' },
        { status: 500 }
      );
    }
    
    // Get execution history by iterating through execution records
    // We'll get records until we hit null
    const history: NodeExecutionRecord[] = [];
    let index = 0;
    
    while (true) {
      const record = api.getExecutionByIndex(index);
      if (!record) break;
      history.push(record);
      index++;
    }
    
    return NextResponse.json({ history });
  } catch (error) {
    console.error('Error getting execution history with indices:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

