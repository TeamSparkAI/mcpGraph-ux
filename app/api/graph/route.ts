import { NextResponse } from 'next/server';
import { type NodeDefinition } from 'mcpgraph';
import { getApi } from '@/lib/mcpGraphApi';

// Force dynamic rendering - this route requires runtime config
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const api = getApi();
    const config = api.getConfig();
    
    // Get toolName from query parameter
    const url = new URL(request.url);
    const toolName = url.searchParams.get('toolName');
    
    if (!toolName) {
      return NextResponse.json(
        { error: 'toolName query parameter is required' },
        { status: 400 }
      );
    }
    
    // Get tool definition from config.tools (which is ToolDefinition[], not ToolInfo)
    // getTool() returns ToolInfo which doesn't have nodes - we need ToolDefinition from config
    const tool = config.tools.find(t => t.name === toolName);
    
    if (!tool) {
      const toolNames = config.tools.map(t => t.name);
      return NextResponse.json(
        { error: `Tool '${toolName}' not found. Available tools: ${toolNames.join(', ')}` },
        { status: 404 }
      );
    }
    
    if (!tool.nodes || tool.nodes.length === 0) {
      return NextResponse.json(
        { error: `Tool '${toolName}' has no nodes defined` },
        { status: 404 }
      );
    }
    
    const allNodes: NodeDefinition[] = tool.nodes;
    console.log(`[graph/route] Found ${allNodes.length} nodes for tool '${toolName}'`);
    console.log(`[graph/route] Node IDs:`, allNodes.map(n => n.id));
    
    // Transform nodes into React Flow format
    const nodes = allNodes.map((node: NodeDefinition) => {
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
    
    allNodes.forEach((node: NodeDefinition) => {
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

    console.log(`[graph/route] Returning ${nodes.length} nodes and ${edges.length} edges`);
    
    return NextResponse.json({ 
      nodes, 
      edges, 
      tools: config.tools,
      config: {
        name: config.server.name,
        version: config.server.version,
        servers: Object.entries(config.mcpServers || {}).map(([name, server]) => {
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

