'use client';

import { useState, useEffect, useRef } from 'react';
import styles from './ToolTester.module.css';
import { SSEExecutionStream, generateExecutionId, type ExecutionEvent } from '../lib/executionStream';
import type { NodeExecutionStatus } from './GraphVisualization';
import ExecutionHistory, { type NodeExecutionRecord } from './ExecutionHistory';
import DebugControls, { type ExecutionStatus } from './DebugControls';

export interface ExecutionTelemetry {
  totalDuration: number;
  nodeDurations: Record<string, number>;
  nodeCounts: Record<string, number>;
  errorCount: number;
}
import type { NodeInspectionData } from './NodeInspector';

// Re-export ExecutionStatus for consistency
export type { ExecutionStatus };

interface ToolTesterProps {
  toolName: string;
  onExecutionStateChange?: (state: Map<string, NodeExecutionStatus>) => void;
  onNodeHighlight?: (nodeId: string | null) => void;
  onCurrentNodeChange?: (nodeId: string | null) => void;
  breakpoints?: Set<string>;
  onBreakpointsChange?: (breakpoints: Set<string>) => void;
  onNodeInspect?: (data: NodeInspectionData) => void;
  onExecutionHistoryChange?: (history: NodeExecutionRecord[]) => void;
}


interface ToolInfo {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties?: Record<string, any>;
    required?: string[];
  };
  outputSchema?: {
    type: string;
    properties?: Record<string, any>;
  };
}


export default function ToolTester({ 
  toolName, 
  onExecutionStateChange, 
  onNodeHighlight,
  onCurrentNodeChange,
  breakpoints: externalBreakpoints,
  onBreakpointsChange,
  onNodeInspect,
  onExecutionHistoryChange,
}: ToolTesterProps) {
  const [toolInfo, setToolInfo] = useState<ToolInfo | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [executionHistory, setExecutionHistory] = useState<NodeExecutionRecord[]>([]);
  const [telemetry, setTelemetry] = useState<ExecutionTelemetry | null>(null);
  const [executionStatus, setExecutionStatus] = useState<ExecutionStatus>('not_started');
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);

  // Debug: Log execution status changes
  useEffect(() => {
    console.log(`[ToolTester] Execution status changed to: ${executionStatus}, currentNodeId: ${currentNodeId}`);
  }, [executionStatus, currentNodeId]);
  const [currentExecutionId, setCurrentExecutionId] = useState<string | null>(null);
  const [breakpoints, setBreakpoints] = useState<Set<string>>(new Set());
  const executionStreamRef = useRef<SSEExecutionStream | null>(null);
  const executionStateRef = useRef<Map<string, NodeExecutionStatus>>(new Map());

  useEffect(() => {
    // Load tool info
    fetch(`/api/tools/${toolName}`)
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setError(data.error);
          return;
        }
        setToolInfo(data.tool);
        // Initialize form data with default values
        const defaults: Record<string, any> = {};
        if (data.tool.inputSchema.properties) {
          Object.entries(data.tool.inputSchema.properties).forEach(([key, prop]: [string, any]) => {
            if (prop.type === 'string') {
              defaults[key] = '';
            } else if (prop.type === 'number') {
              defaults[key] = 0;
            } else if (prop.type === 'boolean') {
              defaults[key] = false;
            } else if (prop.type === 'array') {
              defaults[key] = [];
            } else if (prop.type === 'object') {
              defaults[key] = {};
            }
          });
        }
        setFormData(defaults);
      })
      .catch(err => {
        setError(err.message);
      });
  }, [toolName]);

  const handleInputChange = (key: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSubmit = async (e?: React.FormEvent, startPaused: boolean = false) => {
    if (e) {
      e.preventDefault();
    }
    setLoading(true);
    setError(null);
    setResult(null);
    setExecutionHistory([]);
    setTelemetry(null);
    setExecutionStatus('not_started');
    setCurrentNodeId(null);
    
    // Reset execution state
    executionStateRef.current.clear();
    onExecutionStateChange?.(new Map());
    onExecutionHistoryChange?.([]); // Clear history in parent

    // Generate execution ID and set up SSE stream
    const executionId = generateExecutionId();
    setCurrentExecutionId(executionId);
    // Don't set status here - wait for first event (pause or nodeStart) to tell us actual state
    const stream = new SSEExecutionStream(executionId);
    executionStreamRef.current = stream;

    // Track if SSE connection is ready (event-driven)
    let sseReady = false;
    let sseReadyResolve: (() => void) | null = null;

    // Set up event handler
    stream.connect((event: ExecutionEvent) => {
      console.log(`[ToolTester] Received SSE event: ${event.type}`, event);
      const state = executionStateRef.current;
      
      switch (event.type) {
        case 'connected':
          console.log(`[ToolTester] SSE connected for execution: ${executionId}`);
          sseReady = true;
          if (sseReadyResolve) {
            sseReadyResolve();
            sseReadyResolve = null;
          }
          break;
        case 'nodeStart':
          setCurrentNodeId(event.data.nodeId);
          onCurrentNodeChange?.(event.data.nodeId);
          state.set(event.data.nodeId, {
            nodeId: event.data.nodeId,
            state: 'running',
            startTime: event.data.timestamp,
          });
          break;
        case 'nodeComplete':
          const existing = state.get(event.data.nodeId);
          state.set(event.data.nodeId, {
            nodeId: event.data.nodeId,
            state: 'completed',
            startTime: existing?.startTime || event.data.timestamp,
            endTime: event.data.timestamp,
            duration: event.data.duration,
          });
          break;
        case 'nodeError':
          const existingError = state.get(event.data.nodeId);
          state.set(event.data.nodeId, {
            nodeId: event.data.nodeId,
            state: 'error',
            startTime: existingError?.startTime || event.data.timestamp,
            endTime: event.data.timestamp,
            error: event.data.error?.message || 'Unknown error',
          });
          break;
        case 'executionComplete':
          console.log(`[ToolTester] Execution complete, result:`, event.data.result);
          setResult(event.data.result);
          if (event.data.executionHistory) {
            setExecutionHistory(event.data.executionHistory);
            onExecutionHistoryChange?.(event.data.executionHistory);
          }
          if (event.data.telemetry) {
            setTelemetry(event.data.telemetry);
          }
          setExecutionStatus('finished');
          setCurrentNodeId(null);
          onCurrentNodeChange?.(null);
          setLoading(false);
          stream.disconnect();
          executionStreamRef.current = null;
          break;
        case 'executionError':
          console.log(`[ToolTester] Execution error:`, event.data.error);
          setError(event.data.error);
          setExecutionStatus('error');
          setCurrentNodeId(null);
          onCurrentNodeChange?.(null);
          setLoading(false);
          stream.disconnect();
          executionStreamRef.current = null;
          setCurrentExecutionId(null);
          break;
        case 'executionStopped':
          console.log(`[ToolTester] Execution stopped by user`);
          setExecutionStatus('stopped');
          setCurrentNodeId(null);
          onCurrentNodeChange?.(null);
          setLoading(false);
          stream.disconnect();
          executionStreamRef.current = null;
          setCurrentExecutionId(null);
          break;
        case 'pause':
          console.log(`[ToolTester] Pause event received for node: ${event.data.nodeId}`);
          setExecutionStatus('paused');
          if (event.data.nodeId) {
            setCurrentNodeId(event.data.nodeId);
            onCurrentNodeChange?.(event.data.nodeId);
          }
          break;
        case 'resume':
          // Don't set status here - stateUpdate is the authoritative source
          // The resume event is just informational, stateUpdate will follow with the actual status
          break;
        case 'stateUpdate':
          console.log(`[ToolTester] stateUpdate event:`, event.data);
          if (event.data.status) {
            console.log(`[ToolTester] Setting execution status to: ${event.data.status}`);
            setExecutionStatus(event.data.status);
          }
          if (event.data.currentNodeId !== undefined) {
            setCurrentNodeId(event.data.currentNodeId);
            onCurrentNodeChange?.(event.data.currentNodeId);
          } else if (event.data.status === 'running' || event.data.status === 'finished' || event.data.status === 'error' || event.data.status === 'stopped') {
            // Clear currentNodeId when execution is no longer paused
            setCurrentNodeId(null);
            onCurrentNodeChange?.(null);
          }
          break;
      }
      
      // Notify parent component of state change
      onExecutionStateChange?.(new Map(state));
    });

    // Wait for SSE connection to be ready (event-driven)
    const waitForSSE = new Promise<void>((resolve) => {
      if (sseReady) {
        resolve();
      } else {
        sseReadyResolve = resolve;
        // Safety timeout in case connected event never arrives
        setTimeout(() => {
          if (!sseReady && sseReadyResolve) {
            console.warn(`[ToolTester] SSE connection not ready after 2s, proceeding anyway`);
            sseReadyResolve = null;
            resolve();
          }
        }, 2000);
      }
    });

    try {
      await waitForSSE;
      console.log(`[ToolTester] Starting execution for tool: ${toolName}, executionId: ${executionId}`);

      const response = await fetch(`/api/tools/${toolName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          args: formData,
          executionId,
          options: {
            enableTelemetry: true,
            breakpoints: Array.from(externalBreakpoints || []),
            startPaused: startPaused, // mcpGraph 0.1.12+ supports starting paused
          },
        }),
      });

      const data = await response.json();
      
      if (data.error) {
        setError(data.error);
        setLoading(false);
        stream.disconnect();
        executionStreamRef.current = null;
      }
      // Result will be set via SSE executionComplete event
    } catch (err) {
      console.error(`[ToolTester] Error executing tool:`, err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setLoading(false);
      stream.disconnect();
      executionStreamRef.current = null;
    }
  };

  // Toggle breakpoint handler
  const handleToggleBreakpoint = async (nodeId: string) => {
    const newBreakpoints = new Set(breakpoints);
    if (newBreakpoints.has(nodeId)) {
      newBreakpoints.delete(nodeId);
    } else {
      newBreakpoints.add(nodeId);
    }
    setBreakpoints(newBreakpoints);
    
    // Update breakpoints on server if execution is active
    if (currentExecutionId) {
      try {
        await fetch('/api/execution/breakpoints', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            executionId: currentExecutionId,
            breakpoints: Array.from(newBreakpoints),
          }),
        });
      } catch (err) {
        console.error('Error updating breakpoints:', err);
      }
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (executionStreamRef.current) {
        executionStreamRef.current.disconnect();
      }
    };
  }, []);

  const formatDuration = (ms: number) => {
    if (ms < 1) return '<1ms';
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const renderInputField = (key: string, prop: any) => {
    const isRequired = toolInfo?.inputSchema.required?.includes(key);
    const value = formData[key] ?? '';

    switch (prop.type) {
      case 'string':
        return (
          <div key={key} className={styles.field}>
            <label className={styles.label}>
              {key}
              {isRequired && <span className={styles.required}>*</span>}
            </label>
            <input
              type="text"
              value={value}
              onChange={e => handleInputChange(key, e.target.value)}
              className={styles.input}
              placeholder={prop.description || `Enter ${key}`}
            />
            {prop.description && (
              <div className={styles.hint}>{prop.description}</div>
            )}
          </div>
        );
      case 'number':
        return (
          <div key={key} className={styles.field}>
            <label className={styles.label}>
              {key}
              {isRequired && <span className={styles.required}>*</span>}
            </label>
            <input
              type="number"
              value={value}
              onChange={e => handleInputChange(key, parseFloat(e.target.value) || 0)}
              className={styles.input}
              placeholder={prop.description || `Enter ${key}`}
            />
            {prop.description && (
              <div className={styles.hint}>{prop.description}</div>
            )}
          </div>
        );
      case 'boolean':
        return (
          <div key={key} className={styles.field}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={value}
                onChange={e => handleInputChange(key, e.target.checked)}
                className={styles.checkbox}
              />
              {key}
              {isRequired && <span className={styles.required}>*</span>}
            </label>
            {prop.description && (
              <div className={styles.hint}>{prop.description}</div>
            )}
          </div>
        );
      case 'array':
        return (
          <div key={key} className={styles.field}>
            <label className={styles.label}>
              {key}
              {isRequired && <span className={styles.required}>*</span>}
            </label>
            <textarea
              value={Array.isArray(value) ? JSON.stringify(value, null, 2) : '[]'}
              onChange={e => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  handleInputChange(key, parsed);
                } catch {
                  // Invalid JSON, ignore
                }
              }}
              className={styles.textarea}
              placeholder={prop.description || `Enter ${key} as JSON array`}
              rows={3}
            />
            {prop.description && (
              <div className={styles.hint}>{prop.description}</div>
            )}
          </div>
        );
      case 'object':
        return (
          <div key={key} className={styles.field}>
            <label className={styles.label}>
              {key}
              {isRequired && <span className={styles.required}>*</span>}
            </label>
            <textarea
              value={typeof value === 'object' ? JSON.stringify(value, null, 2) : '{}'}
              onChange={e => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  handleInputChange(key, parsed);
                } catch {
                  // Invalid JSON, ignore
                }
              }}
              className={styles.textarea}
              placeholder={prop.description || `Enter ${key} as JSON object`}
              rows={5}
            />
            {prop.description && (
              <div className={styles.hint}>{prop.description}</div>
            )}
          </div>
        );
      default:
        return (
          <div key={key} className={styles.field}>
            <label className={styles.label}>
              {key}
              {isRequired && <span className={styles.required}>*</span>}
            </label>
            <textarea
              value={typeof value === 'string' ? value : JSON.stringify(value)}
              onChange={e => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  handleInputChange(key, parsed);
                } catch {
                  handleInputChange(key, e.target.value);
                }
              }}
              className={styles.textarea}
              placeholder={prop.description || `Enter ${key}`}
              rows={3}
            />
            {prop.description && (
              <div className={styles.hint}>{prop.description}</div>
            )}
          </div>
        );
    }
  };

  if (!toolInfo) {
    return <div className={styles.loading}>Loading tool information...</div>;
  }

  return (
    <div className={styles.container}>
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.inputs}>
          {toolInfo.inputSchema.properties &&
            Object.entries(toolInfo.inputSchema.properties).map(([key, prop]) =>
              renderInputField(key, prop)
            )}
        </div>

      </form>

      <DebugControls
        executionId={currentExecutionId}
        status={executionStatus}
        currentNodeId={currentNodeId}
        onStatusChange={setExecutionStatus}
        onRun={() => handleSubmit(undefined, false)}
        onStepFromStart={() => handleSubmit(undefined, true)}
        disabled={loading}
      />

      {error && (
        <div className={styles.error}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {result && (
        <div className={styles.result}>
          <div className={styles.resultHeader}>
            <h3>Result</h3>
            {telemetry && (
              <div className={styles.resultStats}>
                <span className={styles.statItem}>
                  <strong>Elapsed Time:</strong> {formatDuration(telemetry.totalDuration)}
                </span>
                <span className={styles.statItem}>
                  <strong>Nodes Executed:</strong> {Object.values(telemetry.nodeCounts).reduce((sum, count) => sum + count, 0)}
                </span>
                {telemetry.errorCount > 0 && (
                  <span className={`${styles.statItem} ${styles.errorStat}`}>
                    <strong>Errors:</strong> {telemetry.errorCount}
                  </span>
                )}
              </div>
            )}
          </div>
          <pre className={styles.resultContent}>
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}

      {executionHistory.length > 0 && (
        <div className={styles.introspection}>
          <div className={styles.historySection}>
            <ExecutionHistory
              history={executionHistory}
              onNodeClick={(nodeId) => {
                onNodeHighlight?.(nodeId);
                setTimeout(() => onNodeHighlight?.(null), 2000); // Clear highlight after 2 seconds
                
                // Find the node in execution history and show inspector
                const record = executionHistory.find(r => r.nodeId === nodeId);
                if (record && onNodeInspect) {
                  onNodeInspect({
                    nodeId: record.nodeId,
                    nodeType: record.nodeType,
                    input: record.input,
                    output: record.output,
                    duration: record.duration,
                    startTime: record.startTime,
                    endTime: record.endTime,
                    error: record.error ? { message: record.error.message || 'Unknown error', stack: record.error.stack } : undefined,
                  });
                }
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

