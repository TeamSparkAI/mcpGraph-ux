'use client';

import { useEffect, useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  useNodesState,
  useEdgesState,
  ConnectionMode,
  MarkerType,
  Handle,
  Position,
} from 'reactflow';
import dagre from 'dagre';
import 'reactflow/dist/style.css';
import styles from './GraphVisualization.module.css';

export type NodeExecutionState = 'pending' | 'running' | 'completed' | 'error';

export interface NodeExecutionStatus {
  nodeId: string;
  state: NodeExecutionState;
  startTime?: number;
  endTime?: number;
  duration?: number;
  error?: string;
}

interface GraphVisualizationProps {
  nodes: Node[];
  edges: Edge[];
  selectedTool?: string | null;
  executionState?: Map<string, NodeExecutionStatus>;
  highlightedNode?: string | null;
  breakpoints?: Set<string>;
  onToggleBreakpoint?: (nodeId: string) => void;
  onNodeClick?: (nodeId: string) => void;
  currentNodeId?: string | null;
}

// Custom node styles based on node type and execution state
const getNodeStyle = (nodeType: string, executionState?: NodeExecutionState) => {
  const baseStyle: React.CSSProperties = {
    padding: '10px',
    borderRadius: '8px',
    borderStyle: 'solid',
    borderWidth: '2px',
    fontSize: '12px',
    fontWeight: 500,
    transition: 'all 0.3s ease',
    boxSizing: 'border-box', // Include border in width/height to prevent shifting
  };

  // Override colors based on execution state
  if (executionState === 'running') {
    return {
      ...baseStyle,
      backgroundColor: '#fff9c4',
      borderColor: '#fbc02d',
      color: '#f57f17',
      boxShadow: '0 0 10px rgba(251, 192, 45, 0.5)',
      animation: 'pulse 1.5s ease-in-out infinite',
    };
  } else if (executionState === 'paused') {
    return {
      ...baseStyle,
      backgroundColor: '#e0f2f7',
      borderColor: '#00bcd4',
      color: '#006064',
      boxShadow: '0 0 0 3px #00bcd4',
    };
  } else if (executionState === 'completed') {
    return {
      ...baseStyle,
      backgroundColor: '#c8e6c9',
      borderColor: '#66bb6a',
      color: '#2e7d32',
    };
  } else if (executionState === 'error') {
    return {
      ...baseStyle,
      backgroundColor: '#ffcdd2',
      borderColor: '#ef5350',
      color: '#c62828',
    };
  }

  switch (nodeType) {
    case 'entry':
      return {
        ...baseStyle,
        backgroundColor: '#e8f5e9',
        borderColor: '#4caf50',
        color: '#2e7d32',
      };
    case 'exit':
      return {
        ...baseStyle,
        backgroundColor: '#fff3e0',
        borderColor: '#ff9800',
        color: '#e65100',
      };
    case 'mcp':
      return {
        ...baseStyle,
        backgroundColor: '#e3f2fd',
        borderColor: '#2196f3',
        color: '#1565c0',
      };
    case 'transform':
      return {
        ...baseStyle,
        backgroundColor: '#f3e5f5',
        borderColor: '#9c27b0',
        color: '#6a1b9a',
      };
    case 'switch':
      return {
        ...baseStyle,
        backgroundColor: '#fce4ec',
        borderColor: '#e91e63',
        color: '#c2185b',
      };
    default:
      return {
        ...baseStyle,
        backgroundColor: '#f5f5f5',
        borderColor: '#9e9e9e',
        color: '#616161',
      };
  }
};

// Node type icon component
function NodeTypeIcon({ nodeType }: { nodeType: string }) {
  const iconStyle: React.CSSProperties = {
    width: '1em',
    height: '1em',
    color: '#000',
    flexShrink: 0,
    display: 'inline-block',
  };

  switch (nodeType) {
    case 'mcp':
      return (
        <svg
          fill="currentColor"
          fillRule="evenodd"
          height="1em"
          style={iconStyle}
          viewBox="0 0 24 24"
          width="1em"
          xmlns="http://www.w3.org/2000/svg"
        >
          <title>ModelContextProtocol</title>
          <path d="M15.688 2.343a2.588 2.588 0 00-3.61 0l-9.626 9.44a.863.863 0 01-1.203 0 .823.823 0 010-1.18l9.626-9.44a4.313 4.313 0 016.016 0 4.116 4.116 0 011.204 3.54 4.3 4.3 0 013.609 1.18l.05.05a4.115 4.115 0 010 5.9l-8.706 8.537a.274.274 0 000 .393l1.788 1.754a.823.823 0 010 1.18.863.863 0 01-1.203 0l-1.788-1.753a1.92 1.92 0 010-2.754l8.706-8.538a2.47 2.47 0 000-3.54l-.05-.049a2.588 2.588 0 00-3.607-.003l-7.172 7.034-.002.002-.098.097a.863.863 0 01-1.204 0 .823.823 0 010-1.18l7.273-7.133a2.47 2.47 0 00-.003-3.537z"></path>
          <path d="M14.485 4.703a.823.823 0 000-1.18.863.863 0 00-1.204 0l-7.119 6.982a4.115 4.115 0 000 5.9 4.314 4.314 0 006.016 0l7.12-6.982a.823.823 0 000-1.18.863.863 0 00-1.204 0l-7.119 6.982a2.588 2.588 0 01-3.61 0 2.47 2.47 0 010-3.54l7.12-6.982z"></path>
        </svg>
      );
    case 'entry':
      return (
        <svg
          fill="currentColor"
          height="1em"
          style={iconStyle}
          viewBox="0 0 24 24"
          width="1em"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M8 5v14l11-7z" />
        </svg>
      );
    case 'exit':
      return (
        <svg
          fill="currentColor"
          height="1em"
          style={iconStyle}
          viewBox="0 0 24 24"
          width="1em"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
        </svg>
      );
    case 'transform':
      return (
        <svg
          fill="currentColor"
          height="1em"
          style={iconStyle}
          viewBox="0 0 24 24"
          width="1em"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94L14.4 2.81c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
        </svg>
      );
    case 'switch':
      return (
        <svg
          fill="currentColor"
          height="1em"
          style={iconStyle}
          viewBox="0 0 24 24"
          width="1em"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zM4 6h4v12H4V6zm6 12V6h10v12H10z" />
        </svg>
      );
    default:
      return null;
  }
}

// Custom node component with left/right handles for horizontal flow
function CustomNode({ data }: { data: any }) {
  const nodeType = data.nodeType || 'unknown';
  const executionState = data.executionState as NodeExecutionState | undefined;
  const isHighlighted = data.isHighlighted as boolean | undefined;
  const isCurrentNode = data.isCurrentNode as boolean | undefined;
  const hasBreakpoint = data.hasBreakpoint as boolean | undefined;
  const onToggleBreakpoint = data.onToggleBreakpoint as ((nodeId: string) => void) | undefined;
  const onNodeClick = data.onNodeClick as ((nodeId: string) => void) | undefined;
  const nodeId = data.nodeId as string;
  
  const baseStyle = getNodeStyle(nodeType, executionState);
  
  // Make current node very obvious with outline (doesn't affect layout)
  let style: React.CSSProperties = { ...baseStyle };
  if (isCurrentNode) {
    // Use outline to create thicker border effect without changing element size
    style = {
      ...baseStyle,
      outline: '4px solid',
      outlineColor: baseStyle.borderColor as string || '#333',
      outlineOffset: '-2px', // Overlap with border to create thicker effect
      zIndex: 10,
    };
  }
  
  if (isHighlighted) {
    // Use outline for highlight to avoid layout shift (outline doesn't affect box model)
    style = {
      ...style,
      outline: isCurrentNode ? '4px solid rgba(255, 193, 7, 0.8)' : '3px solid rgba(255, 193, 7, 0.5)',
      outlineOffset: isCurrentNode ? '-2px' : '2px',
      boxShadow: '0 0 20px rgba(255, 193, 7, 0.3)',
      zIndex: 10,
    };
  }
  const isEntry = nodeType === 'entry';
  const isExit = nodeType === 'exit';

  // Add status indicator
  const statusIndicator = executionState === 'running' ? '⏳' :
                         executionState === 'completed' ? '✓' :
                         executionState === 'error' ? '✗' : null;

  const handleBreakpointClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleBreakpoint && nodeId) {
      onToggleBreakpoint(nodeId);
    }
  };

  const handleNodeClick = (e: React.MouseEvent) => {
    // Don't trigger node click if clicking on breakpoint
    if ((e.target as HTMLElement).closest('button')) {
      return;
    }
    if (onNodeClick && nodeId) {
      onNodeClick(nodeId);
    }
  };

  return (
    <div style={{ ...style, cursor: onNodeClick ? 'pointer' : 'default' }} onClick={handleNodeClick}>
      {!isEntry && (
        <Handle
          type="target"
          position={Position.Left}
          style={{ background: '#555' }}
        />
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
        {statusIndicator && <span>{statusIndicator}</span>}
        <span>{data.label}</span>
        <NodeTypeIcon nodeType={nodeType} />
        {data.duration !== undefined && (
          <span style={{ fontSize: '10px', opacity: 0.7 }}>
            ({data.duration}ms)
          </span>
        )}
        {onToggleBreakpoint && (
          <button
            onClick={handleBreakpointClick}
            style={{
              width: 24,
              height: 24,
              borderRadius: '50%',
              cursor: 'pointer',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              background: 'transparent',
              flexShrink: 0,
            }}
            title={hasBreakpoint ? 'Click to remove breakpoint' : 'Click to add breakpoint'}
          >
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: hasBreakpoint ? '#ef5350' : 'transparent',
                border: hasBreakpoint ? '2px solid white' : '1px solid #999',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: hasBreakpoint ? '8px' : '0',
                boxShadow: hasBreakpoint ? '0 2px 4px rgba(0,0,0,0.2)' : 'none',
                opacity: hasBreakpoint ? 1 : 0.5,
                transition: 'opacity 0.2s, background 0.2s, border 0.2s',
              }}
              onMouseEnter={(e) => {
                if (!hasBreakpoint) {
                  e.currentTarget.style.opacity = '1';
                }
              }}
              onMouseLeave={(e) => {
                if (!hasBreakpoint) {
                  e.currentTarget.style.opacity = '0.5';
                }
              }}
            >
              {hasBreakpoint && '●'}
            </span>
          </button>
        )}
      </div>
      {!isExit && (
        <Handle
          type="source"
          position={Position.Right}
          style={{ background: '#555' }}
        />
      )}
    </div>
  );
}

// Define nodeTypes outside component to avoid React Flow warning
const nodeTypes = {
  custom: CustomNode,
};

// Dagre layout algorithm for automatic graph positioning
const layoutNodes = (nodes: Node[], edges: Edge[]): Node[] => {
  // Create a new dagre graph
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ 
    rankdir: 'LR', // Left to right layout
    nodesep: 100,  // Horizontal spacing between nodes
    ranksep: 150,  // Vertical spacing between ranks
    marginx: 50,
    marginy: 50,
  });

  // Add nodes to dagre graph
  nodes.forEach(node => {
    // Estimate node dimensions (dagre needs width/height)
    const nodeType = (node.data as any)?.nodeType || 'unknown';
    const label = node.id;
    // Rough estimate: ~10px per character + padding
    const width = Math.max(150, label.length * 8 + 40);
    const height = 80;
    
    g.setNode(node.id, { width, height });
  });

  // Add edges to dagre graph
  edges.forEach(edge => {
    g.setEdge(edge.source, edge.target);
  });

  // Run dagre layout
  dagre.layout(g);

  // Map dagre positions back to React Flow nodes
  const positionedNodes = nodes.map(node => {
    const nodeType = (node.data as any)?.nodeType || 'unknown';
    const dagreNode = g.node(node.id);
    
    return {
      ...node,
      type: 'custom', // Use custom node type with left/right handles
      position: {
        x: dagreNode.x - (dagreNode.width / 2), // Center the node
        y: dagreNode.y - (dagreNode.height / 2),
      },
      data: {
        ...node.data,
        label: node.id,
      },
    };
  });

  return positionedNodes;
};

export default function GraphVisualization({
  nodes,
  edges,
  selectedTool,
  executionState,
  highlightedNode,
  breakpoints,
  onToggleBreakpoint,
  onNodeClick,
  currentNodeId,
}: GraphVisualizationProps) {
  const layoutedNodes = useMemo(() => layoutNodes(nodes, edges), [nodes, edges]);

  // Merge execution state, highlight, and breakpoints into nodes
  const nodesWithExecutionState = useMemo(() => {
    return layoutedNodes.map(node => {
      const status = executionState?.get(node.id);
      const isCurrentNode = currentNodeId === node.id;
      return {
        ...node,
        data: {
          ...node.data,
          nodeId: node.id,
          executionState: status?.state || 'pending',
          duration: status?.duration,
          isHighlighted: highlightedNode === node.id,
          isCurrentNode, // Mark current node explicitly
          hasBreakpoint: breakpoints?.has(node.id) || false,
          onToggleBreakpoint,
          onNodeClick,
        },
      };
    });
  }, [layoutedNodes, executionState, highlightedNode, breakpoints, onToggleBreakpoint, onNodeClick, currentNodeId]);

  const [flowNodes, setNodes, onNodesChange] = useNodesState(nodesWithExecutionState);
  const [flowEdges, setEdges, onEdgesChange] = useEdgesState(
    edges.map(edge => ({
      ...edge,
      sourceHandle: null, // Use default right handle
      targetHandle: null, // Use default left handle
      markerEnd: {
        type: MarkerType.ArrowClosed,
      },
      style: { strokeWidth: 2 },
    }))
  );

  useEffect(() => {
    const layouted = layoutNodes(nodes, edges);
    // Merge execution state, highlight, and breakpoints into nodes
    const nodesWithState = layouted.map(node => {
      const status = executionState?.get(node.id);
      const isCurrentNode = currentNodeId === node.id;
      return {
        ...node,
        data: {
          ...node.data,
          nodeId: node.id,
          executionState: status?.state || 'pending',
          duration: status?.duration,
          isHighlighted: highlightedNode === node.id,
          isCurrentNode, // Mark current node explicitly
          hasBreakpoint: breakpoints?.has(node.id) || false,
          onToggleBreakpoint,
          onNodeClick,
        },
      };
    });
    setNodes(nodesWithState);
    setEdges(
      edges.map(edge => ({
        ...edge,
        sourceHandle: null, // Use default right handle
        targetHandle: null, // Use default left handle
        markerEnd: {
          type: MarkerType.ArrowClosed,
        },
        style: { strokeWidth: 2 },
      }))
    );
  }, [nodes, edges, executionState, highlightedNode, breakpoints, onToggleBreakpoint, onNodeClick, currentNodeId, setNodes, setEdges]);

  // Filter nodes/edges for selected tool if provided
  const filteredNodes = useMemo(() => {
    if (!selectedTool) return flowNodes;
    return flowNodes.filter(node => {
      const data = node.data as any;
      return (
        (data.nodeType === 'entry' && data.tool === selectedTool) ||
        (data.nodeType === 'exit' && data.tool === selectedTool) ||
        flowEdges.some(edge => {
          // Include nodes that are reachable from entry or lead to exit
          const entryNode = flowNodes.find(
            n => (n.data as any)?.nodeType === 'entry' && (n.data as any)?.tool === selectedTool
          );
          const exitNode = flowNodes.find(
            n => (n.data as any)?.nodeType === 'exit' && (n.data as any)?.tool === selectedTool
          );
          
          if (!entryNode || !exitNode) return false;
          
          // Simple reachability check
          const visited = new Set<string>();
          const queue = [entryNode.id];
          visited.add(entryNode.id);
          
          while (queue.length > 0) {
            const current = queue.shift()!;
            if (current === node.id) return true;
            
            flowEdges
              .filter(e => e.source === current)
              .forEach(e => {
                if (!visited.has(e.target)) {
                  visited.add(e.target);
                  queue.push(e.target);
                }
              });
          }
          
          return false;
        })
      );
    });
  }, [flowNodes, flowEdges, selectedTool]);

  const filteredEdges = useMemo(() => {
    if (!selectedTool) return flowEdges;
    const filteredNodeIds = new Set(filteredNodes.map(n => n.id));
    return flowEdges.filter(
      edge => filteredNodeIds.has(edge.source) && filteredNodeIds.has(edge.target)
    );
  }, [flowEdges, filteredNodes, selectedTool]);

  return (
    <div className={styles.container}>
      <ReactFlow
        nodes={filteredNodes}
        edges={filteredEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        connectionMode={ConnectionMode.Loose}
        nodeTypes={nodeTypes}
        fitView
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}

