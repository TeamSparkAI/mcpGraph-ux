'use client';

import { useState, useEffect } from 'react';
import styles from './DebugControls.module.css';

export type ExecutionStatus = 'not_started' | 'running' | 'paused' | 'finished' | 'error' | 'stopped';

interface DebugControlsProps {
  executionId: string | null;
  status: ExecutionStatus;
  currentNodeId: string | null;
  onStatusChange?: (status: ExecutionStatus) => void;
  onRun?: () => void;
  onStepFromStart?: () => void;
  disabled?: boolean;
}

export default function DebugControls({
  executionId,
  status,
  currentNodeId,
  onStatusChange,
  onRun,
  onStepFromStart,
  disabled,
}: DebugControlsProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePause = async () => {
    if (!executionId || status !== 'running') return;
    
    setIsProcessing(true);
    try {
      const response = await fetch('/api/execution/controller', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ executionId, action: 'pause' }),
      });
      
      const data = await response.json();
      if (data.error) {
        console.error('Error pausing:', data.error);
      }
      // Don't set status here - onPause hook will send stateUpdate with actual state
    } catch (error) {
      console.error('Error pausing execution:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleResume = async () => {
    if (!executionId || status !== 'paused') return;
    
    setIsProcessing(true);
    try {
      const response = await fetch('/api/execution/controller', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ executionId, action: 'resume' }),
      });
      
      const data = await response.json();
      if (data.error) {
        console.error('Error resuming:', data.error);
      }
      // Don't set status here - hooks will tell us the actual state
    } catch (error) {
      console.error('Error resuming execution:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStep = async () => {
    if (!executionId || status !== 'paused') return;
    
    setIsProcessing(true);
    try {
      const response = await fetch('/api/execution/controller', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ executionId, action: 'step' }),
      });
      
      const data = await response.json();
      if (data.error) {
        console.error('Error stepping:', data.error);
      }
      // Don't set status here - onPause hook will send stateUpdate with actual state after step
    } catch (error) {
      console.error('Error stepping execution:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRun = () => {
    if (onRun) {
      onRun();
    }
  };

  const handleStop = async () => {
    if (!executionId || (status !== 'running' && status !== 'paused')) return;
    
    setIsProcessing(true);
    try {
      const response = await fetch('/api/execution/controller', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ executionId, action: 'stop' }),
      });
      
      const data = await response.json();
      if (data.error) {
        console.error('Error stopping:', data.error);
      }
      // Don't set status here - executionStopped event will be sent and handled in ToolTester
    } catch (error) {
      console.error('Error stopping execution:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.controlsRow}>
        <div className={styles.controls}>
        <button
          onClick={handleRun}
          disabled={disabled || isProcessing || status === 'running' || status === 'paused'}
          className={styles.button}
          title="Run execution"
        >
          ▶ Run
        </button>
        <button
          onClick={status === 'paused' ? handleStep : (onStepFromStart || handleRun)}
          disabled={isProcessing || (status !== 'paused' && status !== 'not_started' && status !== 'finished' && status !== 'error' && status !== 'stopped') || (status === 'not_started' && disabled)}
          className={styles.button}
          title={status === 'paused' ? 'Step to next node' : 'Start execution and pause at first node'}
        >
          ⏭ Step
        </button>
        <button
          onClick={handlePause}
          disabled={isProcessing || status !== 'running'}
          className={styles.button}
          title="Pause execution"
        >
          ⏸ Pause
        </button>
        <button
          onClick={handleResume}
          disabled={isProcessing || status !== 'paused'}
          className={styles.button}
          title="Resume execution"
        >
          ▶ Resume
        </button>
        <button
          onClick={handleStop}
          disabled={isProcessing || (status !== 'running' && status !== 'paused')}
          className={styles.button}
          title="Stop/cancel execution"
        >
          ⏹ Stop
        </button>
        </div>
        
        {(status === 'running' || status === 'paused' || status === 'finished' || status === 'error' || status === 'stopped') && (
          <div className={styles.statusInfo}>
            {currentNodeId && (
              <>
                <span className={styles.currentNode}>
                  Current: <code>{currentNodeId}</code>
                </span>
                <span className={styles.separator}>•</span>
              </>
            )}
            <span className={styles.statusLabel}>Status:</span>
            <span className={`${styles.statusBadge} ${styles[status]}`}>
              {status.toUpperCase()}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

