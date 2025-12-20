import { NextRequest } from 'next/server';
import { registerExecutionStream, unregisterExecutionStream } from '@/lib/executionStreamServer';


export async function GET(request: NextRequest) {
  const executionId = request.nextUrl.searchParams.get('executionId');
  
  if (!executionId) {
    return new Response('Missing executionId parameter', { status: 400 });
  }

  const stream = new ReadableStream({
    start(controller) {
      // Register stream for this execution
      registerExecutionStream(executionId, controller);
      
      // Note: The actual execution will be started via POST /api/tools/[toolName]
      // This stream will receive events from those hooks
    },
    cancel() {
      // Clean up when client disconnects
      unregisterExecutionStream(executionId);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

