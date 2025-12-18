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
  try {
    const api = getApi();
    const body = await request.json();
    const args = body.args || {};

    const result = await api.executeTool(params.toolName, args);
    
    return NextResponse.json({ result });
  } catch (error) {
    console.error('Error executing tool:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

