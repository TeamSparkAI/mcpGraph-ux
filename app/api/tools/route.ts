import { NextResponse } from 'next/server';
import { getApi } from '@/lib/mcpGraphApi';

// Force dynamic rendering - this route requires runtime config
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const api = getApi();
    const tools = api.listTools();
    return NextResponse.json({ tools });
  } catch (error) {
    console.error('Error listing tools:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

