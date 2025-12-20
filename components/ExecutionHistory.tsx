'use client';

import { useState } from 'react';
import styles from './ExecutionHistory.module.css';

export interface NodeExecutionRecord {
  nodeId: string;
  nodeType: string;
  startTime: number;
  endTime: number;
  duration: number;
  input: unknown;
  output: unknown;
  error?: Error;
}

interface ExecutionHistoryProps {
  history: NodeExecutionRecord[];
  onNodeClick?: (nodeId: string) => void;
}

export default function ExecutionHistory({ history, onNodeClick }: ExecutionHistoryProps) {
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

  if (history.length === 0) {
    return (
      <div className={styles.container}>
        <h3 className={styles.title}>Execution History</h3>
        <div className={styles.empty}>No execution history available</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Execution History</h3>
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
                  <span className={styles.duration}>{formatDuration(record.duration)}</span>
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
                    {!hasError && (
                      <div className={styles.dataItem}>
                        <strong>Output:</strong>
                        <pre className={styles.jsonData}>{formatJSON(record.output)}</pre>
                      </div>
                    )}
                  </div>
                  
                  <div className={styles.metadata}>
                    <div>Start: {formatTime(record.startTime)}</div>
                    <div>End: {formatTime(record.endTime)}</div>
                    <div>Duration: {formatDuration(record.duration)}</div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

