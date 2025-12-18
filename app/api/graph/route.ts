import { NextResponse } from 'next/server';
import { McpGraphApi, type NodeDefinition } from 'mcpgraph';

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
    const config = api.getConfig();
    
    // Transform nodes into React Flow format
    const nodes = config.nodes.map((node: NodeDefinition) => {
      const baseNode = {
        id: node.id,
        type: node.type,
        data: {
          label: node.id,
          nodeType: node.type,
          ...node,
        },
        position: { x: 0, y: 0 }, // Will be calculated by layout algorithm
      };

      // Add specific data based on node type
      if (node.type === 'entry' || node.type === 'exit') {
        return {
          ...baseNode,
          data: {
            ...baseNode.data,
            tool: (node as any).tool,
          },
        };
      } else if (node.type === 'mcp') {
        return {
          ...baseNode,
          data: {
            ...baseNode.data,
            server: (node as any).server,
            tool: (node as any).tool,
            args: (node as any).args,
          },
        };
      } else if (node.type === 'transform') {
        return {
          ...baseNode,
          data: {
            ...baseNode.data,
            transform: (node as any).transform,
          },
        };
      } else if (node.type === 'switch') {
        return {
          ...baseNode,
          data: {
            ...baseNode.data,
            conditions: (node as any).conditions,
          },
        };
      }

      return baseNode;
    });

    // Create edges from node.next and switch conditions
    const edges: Array<{ id: string; source: string; target: string; label?: string }> = [];
    
    config.nodes.forEach((node: NodeDefinition) => {
      if ('next' in node && node.next) {
        edges.push({
          id: `${node.id}-${node.next}`,
          source: node.id,
          target: node.next,
        });
      }
      
      if (node.type === 'switch' && 'conditions' in node) {
        const switchNode = node as any;
        switchNode.conditions.forEach((condition: any, index: number) => {
          edges.push({
            id: `${node.id}-${condition.target}-${index}`,
            source: node.id,
            target: condition.target,
            label: condition.rule ? JSON.stringify(condition.rule) : 'default',
          });
        });
      }
    });

    return NextResponse.json({ nodes, edges, tools: config.tools });
  } catch (error) {
    console.error('Error getting graph:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

