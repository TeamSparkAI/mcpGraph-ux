'use client';

import { useEffect, useState } from 'react';
import GraphVisualization, { type NodeExecutionStatus } from '@/components/GraphVisualization';
import ToolList from '@/components/ToolList';
import ToolTester from '@/components/ToolTester';
import { ServerConfig, McpServers } from '@/components/ServerDetails';
import ExecutionHistory, { type NodeExecutionRecord } from '@/components/ExecutionHistory';
import DebugControls, { type ExecutionStatus } from '@/components/DebugControls';
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
  const [executionHistory, setExecutionHistory] = useState<NodeExecutionRecord[]>([]);
  const [executionResult, setExecutionResult] = useState<unknown>(null);
  const [executionTelemetry, setExecutionTelemetry] = useState<{
    totalDuration: number;
    nodeCounts: Record<string, number>;
    errorCount: number;
  } | null>(null);

  const [executionStatus, setExecutionStatus] = useState<ExecutionStatus>('not_started');
  const [currentExecutionId, setCurrentExecutionId] = useState<string | null>(null);
  const [runHandler, setRunHandler] = useState<(() => void) | null>(null);
  const [stepHandler, setStepHandler] = useState<(() => void) | null>(null);

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
          {serverDetails && <ServerConfig config={serverDetails} />}
          <ToolList
            tools={tools}
            selectedTool={selectedTool}
            onSelectTool={setSelectedTool}
          />
          {serverDetails && <McpServers config={serverDetails} />}
        </div>

        <div className={styles.content}>
          {/* Top section: Tool testing and debug controls */}
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
                onExecutionHistoryChange={setExecutionHistory}
                onResultChange={(result, telemetry) => {
                  setExecutionResult(result);
                  setExecutionTelemetry(telemetry);
                }}
                onExecutionStatusChange={setExecutionStatus}
                onExecutionIdChange={setCurrentExecutionId}
                onRunRequest={(handler) => setRunHandler(() => handler)}
                onStepRequest={(handler) => setStepHandler(() => handler)}
                showExecutionHistory={false}
                showDebugControls={false}
              />
            </div>
          )}

          {/* Bottom section: Split into graph (left) and execution history (right) */}
          <div className={styles.bottomSection}>
            {selectedTool && (
              <div className={styles.debugControlsHeader}>
                <DebugControls
                  executionId={currentExecutionId}
                  status={executionStatus}
                  currentNodeId={currentNodeId}
                  onRun={runHandler || undefined}
                  onStepFromStart={stepHandler || undefined}
                />
              </div>
            )}
            <div className={styles.graphHistoryContainer}>
              <div className={styles.graphSection}>
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
                      // Just highlight the node when clicked
                      setHighlightedNode(nodeId);
                      setTimeout(() => setHighlightedNode(null), 2000);
                    }}
                  />
                )}
              </div>

              <div className={styles.historySection}>
                <ExecutionHistory
                  history={executionHistory}
                  result={executionResult}
                  telemetry={executionTelemetry || undefined}
                  onNodeClick={(nodeId) => {
                    setHighlightedNode(nodeId);
                    setTimeout(() => setHighlightedNode(null), 2000);
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

