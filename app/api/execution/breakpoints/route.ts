import { NextRequest, NextResponse } from 'next/server';
import { getController } from '@/lib/executionController';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// Store breakpoints by executionId (fallback if controller not available)
const breakpointsStore = new Map<string, string[]>();

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
    if (controller) {
      // Get breakpoints from controller if available
      const state = controller.getState();
      // Note: mcpGraph doesn't expose breakpoints directly, so we use our store
      const breakpoints = breakpointsStore.get(executionId) || [];
      return NextResponse.json({ breakpoints });
    }

    // Fallback to store
    const breakpoints = breakpointsStore.get(executionId) || [];
    return NextResponse.json({ breakpoints });
  } catch (error) {
    console.error('Error getting breakpoints:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { executionId, breakpoints } = body;

    if (!executionId) {
      return NextResponse.json(
        { error: 'Missing executionId' },
        { status: 400 }
      );
    }

    if (!Array.isArray(breakpoints)) {
      return NextResponse.json(
        { error: 'breakpoints must be an array' },
        { status: 400 }
      );
    }

    const controller = getController(executionId);
    if (controller) {
      controller.setBreakpoints(breakpoints);
    }

    // Store breakpoints
    breakpointsStore.set(executionId, breakpoints);

    return NextResponse.json({ success: true, breakpoints });
  } catch (error) {
    console.error('Error setting breakpoints:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const executionId = request.nextUrl.searchParams.get('executionId');
    
    if (!executionId) {
      return NextResponse.json(
        { error: 'Missing executionId parameter' },
        { status: 400 }
      );
    }

    const controller = getController(executionId);
    if (controller) {
      controller.clearBreakpoints();
    }

    breakpointsStore.delete(executionId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error clearing breakpoints:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

