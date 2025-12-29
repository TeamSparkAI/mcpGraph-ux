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
                  <div className={styles.dataSection}>
                    <div className={styles.dataItem}>
                      <strong>Input:</strong>
                      <pre className={styles.jsonData}>{formatJSON(record.input)}</pre>
                    </div>
                    {hasError ? (
                      <div className={styles.dataItem}>
                        <strong>Error:</strong>
                        <pre className={styles.errorOutput}>
                          {(() => {
                            const err = record.error;
                            if (!err) return 'Unknown error';
                            
                            // Extract error properties
                            const errorCode = 'code' in err && typeof err.code === 'number' ? err.code : null;
                            const errorData = 'data' in err ? err.data : null;
                            const errorType = 'errorType' in err && typeof err.errorType === 'string' ? err.errorType : 'unknown';
                            const stderr = 'stderr' in err && Array.isArray(err.stderr) ? err.stderr : null;
                            const result = 'result' in err ? err.result : null;
                            
                            // Clean the message - remove stderr part if stderr is available as separate property
                            let errorText = err.message || 'Unknown error';
                            if (stderr && stderr.length > 0) {
                              // Remove the stderr part that was concatenated into the message
                              errorText = errorText.split('\n\nServer stderr output:')[0].trim();
                            }
                            
                            // Prepend error code if available
                            if (errorCode !== null) {
                              errorText = `[Error ${errorCode}] ${errorText}`;
                            }
                            
                            return (
                              <>
                                <div className={styles.errorTypeBadge}>
                                  {errorType === 'mcp' && '🔴 MCP Protocol Error'}
                                  {errorType === 'tool' && '🟡 Tool Error'}
                                  {errorType === 'unknown' && '❌ Error'}
                                </div>
                                {errorText}
                                
                                {/* Show stderr for MCP errors */}
                                {stderr && stderr.length > 0 && (
                                  <div className={styles.errorSection}>
                                    <strong>Server stderr output:</strong>
                                    <pre className={styles.stderrOutput}>{stderr.join('\n')}</pre>
                                  </div>
                                )}
                                
                                {/* Show error data for MCP errors */}
                                {errorData !== null && errorData !== undefined && (
                                  <div className={styles.errorSection}>
                                    <strong>Error Details:</strong>
                                    <pre className={styles.errorDataPre}>{formatJSON(errorData)}</pre>
                                  </div>
                                )}
                                
                                {/* Show result for tool errors */}
                                {result !== null && result !== undefined && (
                                  <div className={styles.errorSection}>
                                    <strong>Tool Call Result:</strong>
                                    <pre className={styles.errorDataPre}>{formatJSON(result)}</pre>
                                  </div>
                                )}
                                
                                {err.stack && (
                                  <div className={styles.errorSection}>
                                    <strong>Stack Trace:</strong>
                                    <pre className={styles.errorDataPre}>{err.stack}</pre>
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </pre>
                      </div>
                    ) : record.output !== undefined ? (
                      <div className={styles.dataItem}>
                        <strong>Output:</strong>
                        <pre className={styles.jsonData}>{formatJSON(record.output)}</pre>
                      </div>
                    ) : (
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
        <div className={`${styles.resultItem} ${result && typeof result === 'object' && 'error' in result ? styles.errorResultItem : ''}`}>
          <div className={styles.resultHeader}>
            <div className={styles.resultTitle}>
              {result && typeof result === 'object' && 'error' in result ? (
                <>
                  <span className={styles.errorIcon}>✗</span>
                  <strong style={{ color: '#c62828' }}>Execution Error</strong>
                </>
              ) : (
                <>
                  <span className={styles.resultIcon}>✓</span>
                  <strong>Final Result</strong>
                </>
              )}
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
            {result && typeof result === 'object' && 'error' in result ? (
              <div className={styles.errorResult}>
                <pre className={styles.errorPre}>
                  {typeof result.error === 'string' 
                    ? result.error 
                    : 'Execution failed - see node errors above for details'}
                </pre>
              </div>
            ) : (
              <pre className={styles.resultPre}>{formatJSON(result)}</pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

