'use client';

import { useState } from 'react';
import styles from './ExecutionHistory.module.css';

export interface NodeExecutionRecord {
  nodeId: string;
  nodeType: string;
  startTime: number;
  endTime?: number; // Optional for pending/running nodes
  duration?: number; // Optional for pending/running nodes
  input: unknown;
  output?: unknown; // Optional for pending/running nodes
  error?: Error;
  executionIndex?: number; // For tracking specific node instances
}

interface ExecutionHistoryProps {
  history: NodeExecutionRecord[];
  onNodeClick?: (nodeId: string) => void;
  result?: unknown;
  telemetry?: {
    totalDuration: number;
    nodeCounts: Record<string, number>;
    errorCount: number;
  };
}

export default function ExecutionHistory({ history, onNodeClick, result, telemetry }: ExecutionHistoryProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  const toggleExpand = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
    });
  };

  const formatDuration = (ms: number) => {
    if (ms < 1) return `${(ms * 1000).toFixed(0)}μs`;
    if (ms < 1000) return `${ms.toFixed(2)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatJSON = (data: unknown) => {
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  };

  if (history.length === 0 && !result) {
    return (
      <div className={styles.container}>
        <div className={styles.empty}>No execution history available</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.list}>
        {history.map((record, index) => {
          const isExpanded = expandedNodes.has(record.nodeId);
          const hasError = !!record.error;
          
          return (
            <div
              key={`${record.nodeId}-${index}`}
              className={`${styles.item} ${hasError ? styles.error : ''}`}
            >
              <div
                className={styles.header}
                onClick={() => {
                  toggleExpand(record.nodeId);
                  onNodeClick?.(record.nodeId);
                }}
              >
                <div className={styles.nodeInfo}>
                  <span className={styles.nodeId}>{record.nodeId}</span>
                  <span className={styles.nodeType}>{record.nodeType}</span>
                  {hasError && <span className={styles.errorBadge}>ERROR</span>}
                </div>
                <div className={styles.timing}>
                  {record.duration !== undefined ? (
                    <span className={styles.duration}>{formatDuration(record.duration)}</span>
                  ) : (
                    <span className={styles.duration} style={{ fontStyle: 'italic', color: '#666' }}>pending</span>
                  )}
                  <span className={styles.time}>{formatTime(record.startTime)}</span>
                </div>
                <button className={styles.expandButton}>
                  {isExpanded ? '▼' : '▶'}
                </button>
              </div>
              
              {isExpanded && (
                <div className={styles.details}>
                  {hasError && (
                    <div className={styles.errorSection}>
                      <strong>Error:</strong>
                      <pre className={styles.errorMessage}>
                        {record.error?.message || 'Unknown error'}
                        {record.error?.stack && (
                          <div className={styles.stackTrace}>
                            {record.error.stack}
                          </div>
                        )}
                      </pre>
                    </div>
                  )}
                  
                  <div className={styles.dataSection}>
                    <div className={styles.dataItem}>
                      <strong>Input:</strong>
                      <pre className={styles.jsonData}>{formatJSON(record.input)}</pre>
                    </div>
                    {!hasError && record.output !== undefined && (
                      <div className={styles.dataItem}>
                        <strong>Output:</strong>
                        <pre className={styles.jsonData}>{formatJSON(record.output)}</pre>
                      </div>
                    )}
                    {!hasError && record.output === undefined && (
                      <div className={styles.dataItem}>
                        <strong>Output:</strong>
                        <div style={{ fontStyle: 'italic', color: '#666' }}>Pending execution</div>
                      </div>
                    )}
                  </div>
                  
                  <div className={styles.metadata}>
                    <div>Start: {formatTime(record.startTime)}</div>
                    {record.endTime !== undefined && (
                      <div>End: {formatTime(record.endTime)}</div>
                    )}
                    {record.duration !== undefined && (
                      <div>Duration: {formatDuration(record.duration)}</div>
                    )}
                    {(record.endTime === undefined || record.duration === undefined) && (
                      <div style={{ fontStyle: 'italic', color: '#666' }}>Status: Pending</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      {/* Result display at the bottom - always expanded and styled to stand out */}
      {result !== null && result !== undefined && (
        <div className={styles.resultItem}>
          <div className={styles.resultHeader}>
            <div className={styles.resultTitle}>
              <span className={styles.resultIcon}>✓</span>
              <strong>Final Result</strong>
            </div>
            {telemetry && (
              <div className={styles.resultStats}>
                <span className={styles.statItem}>
                  <strong>Elapsed:</strong> {formatDuration(telemetry.totalDuration)}
                </span>
                <span className={styles.statItem}>
                  <strong>Nodes:</strong> {Object.values(telemetry.nodeCounts).reduce((sum, count) => sum + count, 0)}
                </span>
                {telemetry.errorCount > 0 && (
                  <span className={`${styles.statItem} ${styles.errorStat}`}>
                    <strong>Errors:</strong> {telemetry.errorCount}
                  </span>
                )}
              </div>
            )}
          </div>
          <div className={styles.resultContent}>
            <pre className={styles.resultPre}>{formatJSON(result)}</pre>
          </div>
        </div>
      )}
    </div>
  );
}

