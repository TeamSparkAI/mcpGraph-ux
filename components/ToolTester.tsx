'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import styles from './ToolTester.module.css';
import { SSEExecutionStream, generateExecutionId, type ExecutionEvent } from '../lib/executionStream';
import type { NodeExecutionStatus } from './GraphVisualization';
import ExecutionHistory, { type NodeExecutionRecord } from './ExecutionHistory';
import DebugControls, { type ExecutionStatus } from './DebugControls';

// Type definitions for SSE event data
interface NodeCompleteEventData {
  nodeId: string;
  nodeType: string;
  executionIndex: number;
  input: unknown;
  output: unknown;
  duration: number;
  timestamp: number;
}

interface NodeErrorEventData {
  nodeId: string;
  nodeType: string;
  executionIndex: number;
  input: unknown; // mcpGraph 0.1.19+ provides actual context
  error: {
    message: string;
    stack?: string;
  };
  timestamp: number;
}

interface PauseEventData {
  nodeId: string;
  nodeType: string;
  executionIndex: number;
  context: Record<string, unknown>;
  timestamp: number;
}

interface NodeStartEventData {
  nodeId: string;
  nodeType: string;
  executionIndex: number;
  context: Record<string, unknown>;
  timestamp: number;
}

export interface ExecutionTelemetry {
  totalDuration: number;
  nodeDurations: Record<string, number>;
  nodeCounts: Record<string, number>;
  errorCount: number;
}

// Re-export ExecutionStatus for consistency
export type { ExecutionStatus };

interface ToolTesterProps {
  toolName: string;
  onExecutionStateChange?: (state: Map<string, NodeExecutionStatus>) => void;
  onNodeHighlight?: (nodeId: string | null) => void;
  onCurrentNodeChange?: (nodeId: string | null) => void;
  breakpoints?: Set<string>;
  onBreakpointsChange?: (breakpoints: Set<string>) => void;
  onExecutionHistoryChange?: (history: NodeExecutionRecord[]) => void;
  onResultChange?: (result: unknown, telemetry: ExecutionTelemetry | null) => void;
  showExecutionHistory?: boolean; // Option to show/hide execution history in ToolTester
  onExecutionStatusChange?: (status: ExecutionStatus) => void;
  onExecutionIdChange?: (executionId: string | null) => void;
  showDebugControls?: boolean; // Option to show/hide debug controls in ToolTester
  onRunRequest?: (handler: () => void) => void; // Callback to expose run handler
  onStepRequest?: (handler: () => void) => void; // Callback to expose step handler
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
  onExecutionHistoryChange,
  onResultChange,
  showExecutionHistory = true, // Default to true for backward compatibility
  onExecutionStatusChange,
  onExecutionIdChange,
  showDebugControls = true, // Default to true for backward compatibility
  onRunRequest,
  onStepRequest,
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

  // Notify parent of execution status changes
  useEffect(() => {
    onExecutionStatusChange?.(executionStatus);
  }, [executionStatus, onExecutionStatusChange]);

  // Notify parent of execution ID changes
  useEffect(() => {
    onExecutionIdChange?.(currentExecutionId);
  }, [currentExecutionId, onExecutionIdChange]);

  // Store handleSubmit in a ref so handlers always call the latest version
  const handleSubmitRef = useRef<((e?: React.FormEvent, startPaused?: boolean) => Promise<void>) | null>(null);
  
  // Expose run and step handlers to parent - only once
  const handlersExposedRef = useRef(false);
  
  // Expose handlers immediately after component mounts
  useEffect(() => {
    if (!handlersExposedRef.current && (onRunRequest || onStepRequest)) {
      if (onRunRequest) {
        onRunRequest(() => {
          if (handleSubmitRef.current) {
            handleSubmitRef.current(undefined, false);
          }
        });
      }
      if (onStepRequest) {
        onStepRequest(() => {
          if (handleSubmitRef.current) {
            handleSubmitRef.current(undefined, true);
          }
        });
      }
      handlersExposedRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount
  
  // Fetch execution history from controller
  const fetchExecutionHistory = async (execId: string) => {
    try {
      // Use history-with-indices to get executionIndex for each record
      const response = await fetch(`/api/execution/history-with-indices?executionId=${encodeURIComponent(execId)}`);
      if (response.ok) {
        const data = await response.json();
        if (data.history && Array.isArray(data.history)) {
          // Update history and fetch input for any records missing it
          setExecutionHistory(data.history);
          onExecutionHistoryChange?.(data.history);
          
          // Fetch input for any records that don't have it yet
          data.history.forEach((record: NodeExecutionRecord & { executionIndex?: number }) => {
            if (record.executionIndex !== undefined && !record.input) {
              fetchNodeInput(execId, record.nodeId, record.executionIndex);
            }
          });
        }
      }
    } catch (err) {
      console.error('Error fetching execution history:', err);
    }
  };
  
  // Fetch input context for a specific node using executionIndex
  const fetchNodeInput = async (execId: string, nodeId: string, executionIndex: number) => {
    try {
      console.log(`[ToolTester] Fetching input for nodeId=${nodeId}, executionIndex=${executionIndex}`);
      const response = await fetch(`/api/execution/context?executionId=${encodeURIComponent(execId)}&nodeId=${encodeURIComponent(nodeId)}&sequenceId=${executionIndex}`);
      if (response.ok) {
        const data = await response.json();
        console.log(`[ToolTester] Got context response for ${nodeId}:`, data);
        if (data.context) {
          // Update the history record with the proper input
          // Match by executionIndex if available, otherwise by nodeId
          setExecutionHistory(prev => {
            const newHistory = prev.map(record => {
              // Match by executionIndex if available (from final history)
              const recordWithIndex = record as NodeExecutionRecord & { executionIndex?: number };
              if (recordWithIndex.executionIndex === executionIndex) {
                console.log(`[ToolTester] Updating input for record with executionIndex=${executionIndex}`);
                return { ...record, input: data.context };
              }
              // Fallback: match by nodeId if no executionIndex (progressive history)
              if (!recordWithIndex.executionIndex && record.nodeId === nodeId && !record.input) {
                return { ...record, input: data.context };
              }
              return record;
            });
            onExecutionHistoryChange?.(newHistory);
            return newHistory;
          });
        } else {
          console.warn(`[ToolTester] No context returned for ${nodeId} at executionIndex=${executionIndex}`);
        }
      } else {
        console.error(`[ToolTester] Failed to fetch context for ${nodeId}: ${response.status} ${response.statusText}`);
      }
    } catch (err) {
      console.error('Error fetching node input context:', err);
    }
  };
  
  // Fetch input context for a node after it completes
  // This gets the executionIndex by fetching the execution history from the API
  const fetchNodeInputAfterComplete = async (execId: string, nodeId: string) => {
    try {
      // Fetch the execution history which should have executionIndex for each record
      // We'll find the most recent record for this nodeId and use its executionIndex
      const response = await fetch(`/api/execution/history-with-indices?executionId=${encodeURIComponent(execId)}`);
      if (response.ok) {
        const data = await response.json();
        if (data.history && Array.isArray(data.history)) {
          // Find the most recent record for this nodeId
          // The history is in execution order, so the last matching record is the most recent
          const records = data.history as Array<{ nodeId: string; executionIndex: number }>;
          let matchingRecord: { nodeId: string; executionIndex: number } | undefined;
          
          // Find the last (most recent) record for this nodeId
          for (let i = records.length - 1; i >= 0; i--) {
            if (records[i].nodeId === nodeId) {
              matchingRecord = records[i];
              break;
            }
          }
          
          if (matchingRecord) {
            await fetchNodeInput(execId, nodeId, matchingRecord.executionIndex);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching node input after complete:', err);
    }
  };
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
        case 'nodeStart': {
          const nodeStartData = event.data as NodeStartEventData;
          const existing = state.get(nodeStartData.nodeId);
          state.set(nodeStartData.nodeId, {
            nodeId: nodeStartData.nodeId,
            state: 'running',
            startTime: existing?.startTime || nodeStartData.timestamp,
            endTime: undefined,
            duration: undefined,
          });
          if (nodeStartData.nodeId) {
            setCurrentNodeId(nodeStartData.nodeId);
            onCurrentNodeChange?.(nodeStartData.nodeId);
          }
          
          // Update or create history record for this node with input from context
          // If we already created a pending record from pause event, update it with nodeType
          // Otherwise, create a new running record
          const executionIndex = nodeStartData.executionIndex;
          setExecutionHistory(prev => {
            const existingIndex = prev.findIndex(
              r => r.nodeId === nodeStartData.nodeId && r.executionIndex === executionIndex
            );
            
            if (existingIndex >= 0) {
              // Update existing record (created from pause event)
              const updated = [...prev];
              updated[existingIndex] = {
                ...updated[existingIndex],
                nodeType: nodeStartData.nodeType,
                startTime: nodeStartData.timestamp,
                input: nodeStartData.context, // Update with context from nodeStart (more accurate)
              };
              onExecutionHistoryChange?.(updated);
              return updated;
            } else {
              // Create new running record
              const newHistory = [...prev, {
                nodeId: nodeStartData.nodeId,
                nodeType: nodeStartData.nodeType,
                startTime: nodeStartData.timestamp,
                endTime: undefined, // Not completed yet
                duration: undefined, // Not completed yet
                input: nodeStartData.context, // Use context as input
                output: undefined, // Not completed yet
                executionIndex,
              }];
              onExecutionHistoryChange?.(newHistory);
              return newHistory;
            }
          });
          break;
        }
        case 'nodeComplete': {
          const existing = state.get(event.data.nodeId);
          state.set(event.data.nodeId, {
            nodeId: event.data.nodeId,
            state: 'completed',
            startTime: existing?.startTime || event.data.timestamp,
            endTime: event.data.timestamp,
            duration: event.data.duration,
          });
          // Build history record immediately for progressive display
          // Use input from the event if available, otherwise fetch it
          const eventData = event.data as NodeCompleteEventData;
          const startTime = existing?.startTime || eventData.timestamp;
          const executionIndex = eventData.executionIndex;
          const inputFromEvent = eventData.input;
          
          setExecutionHistory(prev => {
            // Check if we already have a record for this node (created from pause/nodeStart)
            const existingIndex = prev.findIndex(
              r => r.nodeId === eventData.nodeId && r.executionIndex === executionIndex
            );
            
            if (existingIndex >= 0) {
              // Update existing record (created from pause/nodeStart)
              const updated = [...prev];
              updated[existingIndex] = {
                ...updated[existingIndex],
                nodeType: eventData.nodeType,
                startTime,
                endTime: eventData.timestamp,
                duration: eventData.duration,
                input: inputFromEvent, // Use input from event
                output: eventData.output,
                executionIndex,
              };
              onExecutionHistoryChange?.(updated);
              return updated;
            } else {
              // Create new record
              const newHistory = [...prev, {
                nodeId: eventData.nodeId,
                nodeType: eventData.nodeType,
                startTime,
                endTime: eventData.timestamp,
                duration: eventData.duration,
                input: inputFromEvent, // Use input from event
                output: eventData.output,
                executionIndex,
              }];
              onExecutionHistoryChange?.(newHistory);
              return newHistory;
            }
          });
          
          // If input wasn't in the event, fetch it using executionIndex
          if (currentExecutionId && inputFromEvent === undefined) {
            fetchNodeInput(currentExecutionId, eventData.nodeId, executionIndex);
          }
          break;
        }
        case 'nodeError': {
          const existingError = state.get(event.data.nodeId);
          state.set(event.data.nodeId, {
            nodeId: event.data.nodeId,
            state: 'error',
            startTime: existingError?.startTime || event.data.timestamp,
            endTime: event.data.timestamp,
            error: event.data.error?.message || 'Unknown error',
          });
          // Build history record immediately for progressive display
          // Use input from the event (mcpGraph 0.1.19+ provides actual context)
          const eventData = event.data as NodeErrorEventData;
          const errorStartTime = existingError?.startTime || eventData.timestamp;
          const executionIndex = eventData.executionIndex;
          const inputFromEvent = eventData.input; // Context is now always provided
          
          setExecutionHistory(prev => {
            const newHistory = [...prev, {
              nodeId: eventData.nodeId,
              nodeType: eventData.nodeType,
              startTime: errorStartTime,
              endTime: eventData.timestamp,
              duration: eventData.timestamp - errorStartTime,
              input: inputFromEvent, // Use input from event
              output: undefined,
              error: {
                message: eventData.error.message,
                stack: eventData.error.stack,
              } as Error,
              executionIndex,
            }];
            onExecutionHistoryChange?.(newHistory);
            return newHistory;
          });
          
          // If input wasn't in the event, fetch it using executionIndex
          if (currentExecutionId && inputFromEvent === undefined) {
            fetchNodeInput(currentExecutionId, eventData.nodeId, executionIndex);
          }
          break;
        }
        case 'executionComplete':
          console.log(`[ToolTester] Execution complete, result:`, event.data.result);
          setResult(event.data.result);
          // The execution history from the API should already have input populated
          // since we fetch it before unregistering the controller
          if (event.data.executionHistory) {
            const finalHistory = event.data.executionHistory as Array<NodeExecutionRecord & { executionIndex?: number }>;
            setExecutionHistory(finalHistory);
            onExecutionHistoryChange?.(finalHistory);
          }
          if (event.data.telemetry) {
            setTelemetry(event.data.telemetry);
            onResultChange?.(event.data.result, event.data.telemetry);
          } else {
            onResultChange?.(event.data.result, null);
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
        case 'pause': {
          const pauseData = event.data as PauseEventData;
          console.log(`[ToolTester] Pause event received for node: ${pauseData.nodeId}`);
          setExecutionStatus('paused');
          if (pauseData.nodeId) {
            setCurrentNodeId(pauseData.nodeId);
            onCurrentNodeChange?.(pauseData.nodeId);
          }
          
          // Create a pending history record for the node we're paused on
          // This allows the user to see the node's input even though it hasn't completed yet
          const executionIndex = pauseData.executionIndex;
          const existingRecord = executionHistory.find(
            r => r.nodeId === pauseData.nodeId && r.executionIndex === executionIndex
          );
          
          if (!existingRecord && pauseData.context) {
            // Extract input from context - the context contains all available data at this point
            // For the node about to execute, we need to determine what its input would be
            // The context is the execution context, which includes outputs from previous nodes
            // For now, we'll use the context as the input (it represents what's available to this node)
            setExecutionHistory(prev => {
              const newHistory = [...prev, {
                nodeId: pauseData.nodeId,
                nodeType: pauseData.nodeType, // Use nodeType from pause event
                startTime: pauseData.timestamp,
                endTime: undefined, // Not completed yet
                duration: undefined, // Not completed yet
                input: pauseData.context, // Use context as input (what's available to this node)
                output: undefined, // Not completed yet
                executionIndex,
              }];
              onExecutionHistoryChange?.(newHistory);
              return newHistory;
            });
          }
          
          // Fetch execution history from controller on pause to get any completed nodes
          if (currentExecutionId) {
            fetchExecutionHistory(currentExecutionId);
          }
          break;
        }
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
  
  // Update ref immediately when handleSubmit is defined
  handleSubmitRef.current = handleSubmit;
  
  // Expose handlers immediately after handleSubmit is defined
  useEffect(() => {
    if (!handlersExposedRef.current && handleSubmitRef.current && (onRunRequest || onStepRequest)) {
      if (onRunRequest) {
        onRunRequest(() => {
          if (handleSubmitRef.current) {
            handleSubmitRef.current(undefined, false);
          }
        });
      }
      if (onStepRequest) {
        onStepRequest(() => {
          if (handleSubmitRef.current) {
            handleSubmitRef.current(undefined, true);
          }
        });
      }
      handlersExposedRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount

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

      {showDebugControls && (
        <DebugControls
          executionId={currentExecutionId}
          status={executionStatus}
          currentNodeId={currentNodeId}
          onStatusChange={setExecutionStatus}
          onRun={() => handleSubmit(undefined, false)}
          onStepFromStart={() => handleSubmit(undefined, true)}
          disabled={loading}
        />
      )}

      {error && (
        <div className={styles.error}>
          <strong>Error:</strong> {error}
        </div>
      )}


      {showExecutionHistory && executionHistory.length > 0 && (
        <div className={styles.introspection}>
          <div className={styles.historySection}>
            <ExecutionHistory
              history={executionHistory}
              onNodeClick={(nodeId) => {
                onNodeHighlight?.(nodeId);
                setTimeout(() => onNodeHighlight?.(null), 2000); // Clear highlight after 2 seconds
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

