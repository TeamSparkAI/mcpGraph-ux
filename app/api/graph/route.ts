import { NextResponse } from 'next/server';
import { type NodeDefinition } from 'mcpgraph';
import { getApi } from '@/lib/mcpGraphApi';

// Force dynamic rendering - this route requires runtime config
export const dynamic = 'force-dynamic';

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

      // Add specific data based on node type using type guards
      if (node.type === 'entry' && 'tool' in node) {
        return {
          ...baseNode,
          data: {
            ...baseNode.data,
            tool: node.tool,
          },
        };
      } else if (node.type === 'exit' && 'tool' in node) {
        return {
          ...baseNode,
          data: {
            ...baseNode.data,
            tool: node.tool,
          },
        };
      } else if (node.type === 'mcp' && 'server' in node && 'tool' in node && 'args' in node) {
        return {
          ...baseNode,
          data: {
            ...baseNode.data,
            server: node.server,
            tool: node.tool,
            args: node.args,
          },
        };
      } else if (node.type === 'transform' && 'transform' in node) {
        return {
          ...baseNode,
          data: {
            ...baseNode.data,
            transform: node.transform,
          },
        };
      } else if (node.type === 'switch' && 'conditions' in node) {
        return {
          ...baseNode,
          data: {
            ...baseNode.data,
            conditions: node.conditions,
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
        node.conditions.forEach((condition, index: number) => {
          edges.push({
            id: `${node.id}-${condition.target}-${index}`,
            source: node.id,
            target: condition.target,
            label: condition.rule ? JSON.stringify(condition.rule) : 'default',
          });
        });
      }
    });

    return NextResponse.json({ 
      nodes, 
      edges, 
      tools: config.tools,
      config: {
        name: config.server.name,
        version: config.server.version,
        description: config.server.description,
        servers: Object.entries(config.servers || {}).map(([name, server]) => {
          const details: {
            name: string;
            type: string;
            command?: string;
            args?: string[];
            cwd?: string;
            url?: string;
            headers?: Record<string, string>;
          } = {
            name,
            type: server.type || 'stdio',
          };
          
          if (server.type === 'stdio' || !server.type) {
            details.command = server.command;
            details.args = server.args || [];
            if (server.cwd) {
              details.cwd = server.cwd;
            }
          } else if (server.type === 'sse' || server.type === 'streamableHttp') {
            details.url = server.url;
            if (server.headers) {
              details.headers = server.headers;
            }
          }
          
          return details;
        }),
      },
    });
  } catch (error) {
    console.error('Error getting graph:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

