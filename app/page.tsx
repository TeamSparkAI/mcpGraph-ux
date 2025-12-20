'use client';

import { useEffect, useState } from 'react';
import GraphVisualization, { type NodeExecutionStatus } from '@/components/GraphVisualization';
import ToolList from '@/components/ToolList';
import ToolTester from '@/components/ToolTester';
import ServerDetails from '@/components/ServerDetails';
import NodeInspector, { type NodeInspectionData } from '@/components/NodeInspector';
import type { NodeExecutionRecord } from '@/components/ExecutionHistory';
import styles from './page.module.css';

interface Tool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
}

export default function Home() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [graphData, setGraphData] = useState<{ nodes: any[]; edges: any[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [executionState, setExecutionState] = useState<Map<string, NodeExecutionStatus>>(new Map());
  const [highlightedNode, setHighlightedNode] = useState<string | null>(null);
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);
  const [breakpoints, setBreakpoints] = useState<Set<string>>(new Set());
  const [inspectedNode, setInspectedNode] = useState<NodeInspectionData | null>(null);
  const [executionHistory, setExecutionHistory] = useState<NodeExecutionRecord[]>([]);

  const [serverDetails, setServerDetails] = useState<any>(null);

  useEffect(() => {
    // Load tools and graph data (graph includes config)
    Promise.all([
      fetch('/api/tools').then(res => res.json()),
      fetch('/api/graph').then(res => res.json()),
    ])
      .then(([toolsRes, graphRes]) => {
        if (toolsRes.error) {
          setError(toolsRes.error);
          return;
        }
        if (graphRes.error) {
          setError(graphRes.error);
          return;
        }
        setTools(toolsRes.tools);
        setGraphData({ nodes: graphRes.nodes, edges: graphRes.edges });
        if (graphRes.config) {
          setServerDetails(graphRes.config);
        }
        if (toolsRes.tools.length > 0) {
          setSelectedTool(toolsRes.tools[0].name);
        }
      })
      .catch(err => {
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <h1>Error</h1>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>mcpGraph UX</h1>
        <p>Visual interface for mcpGraph execution</p>
      </header>

      <div className={styles.main}>
        <div className={styles.sidebar}>
          {serverDetails && <ServerDetails config={serverDetails} />}
          <ToolList
            tools={tools}
            selectedTool={selectedTool}
            onSelectTool={setSelectedTool}
          />
        </div>

        <div className={styles.content}>
          <div className={styles.graphSection}>
            <h2>Graph Visualization</h2>
            {graphData && (
              <GraphVisualization
                nodes={graphData.nodes}
                edges={graphData.edges}
                selectedTool={selectedTool}
                executionState={executionState}
                highlightedNode={highlightedNode}
                currentNodeId={currentNodeId}
                breakpoints={breakpoints}
                onToggleBreakpoint={(nodeId) => {
                  const newBreakpoints = new Set(breakpoints);
                  if (newBreakpoints.has(nodeId)) {
                    newBreakpoints.delete(nodeId);
                  } else {
                    newBreakpoints.add(nodeId);
                  }
                  setBreakpoints(newBreakpoints);
                }}
                onNodeClick={(nodeId) => {
                  // Find node data from execution history or graph
                  const nodeStatus = executionState.get(nodeId);
                  const node = graphData.nodes.find(n => n.id === nodeId);
                  
                  // Try to find the node in execution history first (has input/output)
                  const historyRecord = executionHistory.find(r => r.nodeId === nodeId);
                  
                  if (historyRecord) {
                    // Use execution history data (has input/output)
                    setInspectedNode({
                      nodeId: historyRecord.nodeId,
                      nodeType: historyRecord.nodeType,
                      input: historyRecord.input,
                      output: historyRecord.output,
                      duration: historyRecord.duration,
                      startTime: historyRecord.startTime,
                      endTime: historyRecord.endTime,
                      error: historyRecord.error ? { message: historyRecord.error.message || 'Unknown error', stack: historyRecord.error.stack } : undefined,
                    });
                  } else if (nodeStatus || node) {
                    // Fallback to execution state data (no input/output)
                    setInspectedNode({
                      nodeId,
                      nodeType: (node?.data as any)?.nodeType || 'unknown',
                      duration: nodeStatus?.duration,
                      startTime: nodeStatus?.startTime,
                      endTime: nodeStatus?.endTime,
                      error: nodeStatus?.error ? { message: nodeStatus.error } : undefined,
                    });
                  }
                }}
              />
            )}
          </div>

          {selectedTool && (
            <div className={styles.testerSection}>
              <h2>Test Tool: {selectedTool}</h2>
              <ToolTester 
                toolName={selectedTool}
                onExecutionStateChange={setExecutionState}
                onNodeHighlight={setHighlightedNode}
                onCurrentNodeChange={setCurrentNodeId}
                breakpoints={breakpoints}
                onBreakpointsChange={setBreakpoints}
                onNodeInspect={setInspectedNode}
                onExecutionHistoryChange={setExecutionHistory}
              />
            </div>
          )}

          {inspectedNode && (
            <div className={styles.inspectorSection}>
              <NodeInspector 
                data={inspectedNode}
                onClose={() => setInspectedNode(null)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

