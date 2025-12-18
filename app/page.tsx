'use client';

import { useEffect, useState } from 'react';
import GraphVisualization from '@/components/GraphVisualization';
import ToolList from '@/components/ToolList';
import ToolTester from '@/components/ToolTester';
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

  useEffect(() => {
    // Load tools and graph data
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
              />
            )}
          </div>

          {selectedTool && (
            <div className={styles.testerSection}>
              <h2>Test Tool: {selectedTool}</h2>
              <ToolTester toolName={selectedTool} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

