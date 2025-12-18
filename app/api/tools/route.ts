import { NextResponse } from 'next/server';
import { McpGraphApi } from 'mcpgraph';

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

