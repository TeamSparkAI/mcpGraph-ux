'use client';

import { useEffect, useState, useRef } from 'react';
import ToolList from '@/components/ToolList';
import ToolTester from '@/components/ToolTester';
import InputForm, { type InputFormHandle } from '@/components/InputForm';
import { ServerConfig, McpServers } from '@/components/ServerDetails';
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
  const [graphData, setGraphData] = useState<{ nodes: Array<{ id: string; type: string; data: Record<string, unknown>; position: { x: number; y: number } }>; edges: Array<{ id: string; source: string; target: string; label?: string }> } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [serverDetails, setServerDetails] = useState<any>(null);
  const inputFormRef = useRef<InputFormHandle>(null);
  const toolTesterFormSubmitRef = useRef<((formData: Record<string, any>, startPaused: boolean) => void) | null>(null);

  useEffect(() => {
    // Load tools and server config
    fetch('/api/tools')
      .then(res => res.json())
      .then(toolsRes => {
        if (toolsRes.error) {
          setError(toolsRes.error);
          return;
        }
        setTools(toolsRes.tools);
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

  // Load graph data and server config when tool is selected
  useEffect(() => {
    if (!selectedTool) return;
    
    fetch(`/api/graph?toolName=${encodeURIComponent(selectedTool)}`)
      .then(res => res.json())
      .then(graphRes => {
        if (graphRes.error) {
          setError(graphRes.error);
          return;
        }
        setGraphData({ nodes: graphRes.nodes, edges: graphRes.edges });
        if (graphRes.config) {
          setServerDetails(graphRes.config);
        }
      })
      .catch(err => {
        setError(err.message);
      });
  }, [selectedTool]);

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
          {/* Top section: Input form */}
          {selectedTool && (
            <div className={styles.testerSection}>
              <h2>Test Tool: {selectedTool}</h2>
              <InputForm
                ref={inputFormRef}
                toolName={selectedTool}
                onSubmit={(data, startPaused) => {
                  // Form validated and collected data - pass to ToolTester for execution
                  if (toolTesterFormSubmitRef.current) {
                    toolTesterFormSubmitRef.current(data, startPaused);
                  } else {
                    console.warn('[page.tsx] toolTesterFormSubmitRef.current is null');
                  }
                }}
              />
            </div>
          )}

          {/* Bottom section: Execution/testing area (includes debug controls, graph, and history) */}
          {selectedTool && graphData && (
            <ToolTester
              toolName={selectedTool}
              graphData={graphData}
              inputFormRef={inputFormRef}
              onFormSubmit={(handler) => {
                // Store the handler that InputForm will call
                toolTesterFormSubmitRef.current = handler;
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

