'use client';

import { useState, useEffect, useRef } from 'react';
import styles from './ToolTester.module.css';
import { SSEExecutionStream, generateExecutionId, type ExecutionEvent } from '../lib/executionStream';
import type { NodeExecutionStatus } from './GraphVisualization';
import ExecutionHistory, { type NodeExecutionRecord } from './ExecutionHistory';
import DebugControls, { type ExecutionStatus } from './DebugControls';
import GraphVisualization from './GraphVisualization';

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
  graphData: { nodes: any[]; edges: any[] } | null;
  inputFormRef: React.RefObject<{ submit: (startPaused: boolean) => void }>;
  onFormSubmit: (handler: (formData: Record<string, any>, startPaused: boolean) => void) => void;
}


export default function ToolTester({ 
  toolName,
  graphData,
  inputFormRef,
  onFormSubmit,
}: ToolTesterProps) {
  // Expose form submit handler to parent (so InputForm can call it)
  // This needs to be after handleSubmit is defined, so we'll do it in a useEffect
  const formSubmitHandlerRef = useRef<((formData: Record<string, any>, startPaused: boolean) => void) | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [executionHistory, setExecutionHistory] = useState<NodeExecutionRecord[]>([]);
  const [telemetry, setTelemetry] = useState<ExecutionTelemetry | null>(null);
  const [executionStatus, setExecutionStatus] = useState<ExecutionStatus>('not_started');
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);
  const [currentExecutionId, setCurrentExecutionId] = useState<string | null>(null);
  const [executionState, setExecutionState] = useState<Map<string, NodeExecutionStatus>>(new Map());
  const [highlightedNode, setHighlightedNode] = useState<string | null>(null);
  const [breakpoints, setBreakpoints] = useState<Set<string>>(new Set());
  // Use a ref to always get the latest breakpoints when handleSubmit executes
  const breakpointsRef = useRef<Set<string>>(breakpoints);
  const [executionResult, setExecutionResult] = useState<unknown>(null);

  
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
  const executionStreamRef = useRef<SSEExecutionStream | null>(null);
  const executionStateRef = useRef<Map<string, NodeExecutionStatus>>(new Map());

  const handleSubmit = async (formData: Record<string, any>, startPaused: boolean = false) => {
    // Read current breakpoints from ref (always up-to-date)
    const currentBreakpoints = breakpointsRef.current;
    
    setLoading(true);
    setError(null);
    setExecutionResult(null);
    setExecutionHistory([]);
    setTelemetry(null);
    setExecutionStatus('not_started');
    setCurrentNodeId(null);
    
    // Reset execution state
    executionStateRef.current.clear();
    setExecutionState(new Map());

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
          setExecutionResult(event.data.result);
          // The execution history from the API should already have input populated
          // since we fetch it before unregistering the controller
          if (event.data.executionHistory) {
            const finalHistory = event.data.executionHistory as Array<NodeExecutionRecord & { executionIndex?: number }>;
            setExecutionHistory(finalHistory);
          }
          if (event.data.telemetry) {
            setTelemetry(event.data.telemetry);
          }
          setExecutionStatus('finished');
          setCurrentNodeId(null);
          setLoading(false);
          stream.disconnect();
          executionStreamRef.current = null;
          break;
        case 'executionError':
          console.log(`[ToolTester] Execution error:`, event.data.error);
          setError(event.data.error);
          setExecutionStatus('error');
          setCurrentNodeId(null);
          setLoading(false);
          stream.disconnect();
          executionStreamRef.current = null;
          setCurrentExecutionId(null);
          break;
        case 'executionStopped':
          console.log(`[ToolTester] Execution stopped by user`);
          setExecutionStatus('stopped');
          setCurrentNodeId(null);
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
          } else if (event.data.status === 'running' || event.data.status === 'finished' || event.data.status === 'error' || event.data.status === 'stopped') {
            // Clear currentNodeId when execution is no longer paused
            setCurrentNodeId(null);
          }
          break;
      }
      
      // Update execution state
      setExecutionState(new Map(state));
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

      const breakpointsArray = Array.from(currentBreakpoints);
      
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
            breakpoints: breakpointsArray,
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
  
  // Expose handlers for DebugControls - trigger form submission
  const handleRun = () => {
    if (inputFormRef.current) {
      inputFormRef.current.submit(false);
    } else {
      console.warn('[ToolTester] inputFormRef.current is null, cannot submit form');
    }
  };
  const handleStep = () => {
    if (inputFormRef.current) {
      inputFormRef.current.submit(true);
    } else {
      console.warn('[ToolTester] inputFormRef.current is null, cannot submit form');
    }
  };

  const handleClear = () => {
    // Reset all execution-related state
    setLoading(false);
    setError(null);
    setExecutionResult(null);
    setExecutionHistory([]);
    setTelemetry(null);
    setExecutionStatus('not_started');
    setCurrentNodeId(null);
    setCurrentExecutionId(null);
    setExecutionState(new Map());
    setHighlightedNode(null);
    const emptyBreakpoints = new Set<string>();
    setBreakpoints(emptyBreakpoints);
    // Update ref immediately
    breakpointsRef.current = emptyBreakpoints;
    
    // Clear execution state ref
    executionStateRef.current.clear();
    
    // Disconnect any active stream
    if (executionStreamRef.current) {
      executionStreamRef.current.disconnect();
      executionStreamRef.current = null;
    }
  };
  
  // Keep breakpointsRef in sync with breakpoints state
  useEffect(() => {
    breakpointsRef.current = breakpoints;
  }, [breakpoints]);

  // Expose form submit handler to parent (so InputForm can call it)
  useEffect(() => {
    // Update the ref with the current handleSubmit
    // The handleSubmit function will read breakpoints from breakpointsRef when called
    formSubmitHandlerRef.current = handleSubmit;
    
    // Expose the handler to parent
    if (onFormSubmit) {
      onFormSubmit((formData: Record<string, any>, startPaused: boolean) => {
        if (formSubmitHandlerRef.current) {
          formSubmitHandlerRef.current(formData, startPaused);
        } else {
          console.warn('[ToolTester] formSubmitHandlerRef.current is null');
        }
      });
    } else {
      console.warn('[ToolTester] onFormSubmit is not provided');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (executionStreamRef.current) {
        executionStreamRef.current.disconnect();
      }
    };
  }, []);

  const handleToggleBreakpoint = (nodeId: string) => {
    const newBreakpoints = new Set(breakpoints);
    if (newBreakpoints.has(nodeId)) {
      newBreakpoints.delete(nodeId);
    } else {
      newBreakpoints.add(nodeId);
    }
    setBreakpoints(newBreakpoints);
    // Update ref immediately so handleSubmit always has the latest value
    breakpointsRef.current = newBreakpoints;
  };

  const handleNodeClick = (nodeId: string) => {
    setHighlightedNode(nodeId);
    setTimeout(() => setHighlightedNode(null), 2000);
  };

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <strong>Error:</strong> {error}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.debugControlsHeader}>
        <DebugControls
          executionId={currentExecutionId}
          status={executionStatus}
          currentNodeId={currentNodeId}
          onRun={handleRun}
          onStepFromStart={handleStep}
          onClear={handleClear}
        />
      </div>
      <div className={styles.graphHistoryContainer}>
        <div className={styles.graphSection}>
          {graphData && (
            <GraphVisualization
              nodes={graphData.nodes}
              edges={graphData.edges}
              selectedTool={toolName}
              executionState={executionState}
              highlightedNode={highlightedNode}
              currentNodeId={currentNodeId}
              breakpoints={breakpoints}
              onToggleBreakpoint={handleToggleBreakpoint}
              onNodeClick={handleNodeClick}
            />
          )}
        </div>
        <div className={styles.historySection}>
          <ExecutionHistory
            history={executionHistory}
            result={executionResult}
            telemetry={telemetry || undefined}
            onNodeClick={handleNodeClick}
          />
        </div>
      </div>
    </div>
  );
}

