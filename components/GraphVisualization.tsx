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

interface GraphVisualizationProps {
  nodes: Node[];
  edges: Edge[];
  selectedTool?: string | null;
}

// Custom node styles based on node type
const getNodeStyle = (nodeType: string) => {
  const baseStyle = {
    padding: '10px',
    borderRadius: '8px',
    border: '2px solid',
    fontSize: '12px',
    fontWeight: 500,
  };

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

// Custom node component with left/right handles for horizontal flow
function CustomNode({ data }: { data: any }) {
  const nodeType = data.nodeType || 'unknown';
  const style = getNodeStyle(nodeType);
  const isEntry = nodeType === 'entry';
  const isExit = nodeType === 'exit';

  return (
    <div style={style}>
      {!isEntry && (
        <Handle
          type="target"
          position={Position.Left}
          style={{ background: '#555' }}
        />
      )}
      <div>{data.label}</div>
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
}: GraphVisualizationProps) {
  const layoutedNodes = useMemo(() => layoutNodes(nodes, edges), [nodes, edges]);

  const [flowNodes, setNodes, onNodesChange] = useNodesState(layoutedNodes);
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
    setNodes(layouted);
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
  }, [nodes, edges, setNodes, setEdges]);

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

