'use client';

import React from 'react';
import styles from './NodeInspector.module.css';

export interface NodeInspectionData {
  nodeId: string;
  nodeType: string;
  input?: unknown;
  output?: unknown;
  duration?: number;
  startTime?: number;
  endTime?: number;
  error?: { message: string; stack?: string };
  context?: Record<string, unknown>;
}

interface NodeInspectorProps {
  data: NodeInspectionData | null;
  onClose?: () => void;
}

const formatTimestamp = (timestamp: number) => {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
  });
};

const formatDuration = (ms: number) => {
  if (ms < 1) return '<1ms';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
};

export default function NodeInspector({ data, onClose }: NodeInspectorProps) {
  if (!data) {
    return null;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Node Inspector</h3>
        {onClose && (
          <button className={styles.closeButton} onClick={onClose} title="Close">
            ×
          </button>
        )}
      </div>

      <div className={styles.content}>
        <div className={styles.section}>
          <div className={styles.sectionHeader}>Node Information</div>
          <div className={styles.infoRow}>
            <span className={styles.label}>ID:</span>
            <code className={styles.code}>{data.nodeId}</code>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.label}>Type:</span>
            <span className={styles.value}>{data.nodeType}</span>
          </div>
          {data.duration !== undefined && (
            <div className={styles.infoRow}>
              <span className={styles.label}>Duration:</span>
              <span className={styles.value}>{formatDuration(data.duration)}</span>
            </div>
          )}
          {data.startTime && (
            <div className={styles.infoRow}>
              <span className={styles.label}>Start Time:</span>
              <span className={styles.value}>{formatTimestamp(data.startTime)}</span>
            </div>
          )}
          {data.endTime && (
            <div className={styles.infoRow}>
              <span className={styles.label}>End Time:</span>
              <span className={styles.value}>{formatTimestamp(data.endTime)}</span>
            </div>
          )}
        </div>

        {data.input !== undefined && (
          <div className={styles.section}>
            <div className={styles.sectionHeader}>Input</div>
            <pre className={styles.jsonViewer}>
              {JSON.stringify(data.input, null, 2)}
            </pre>
          </div>
        )}

        {data.output !== undefined && (
          <div className={styles.section}>
            <div className={styles.sectionHeader}>Output</div>
            <pre className={styles.jsonViewer}>
              {JSON.stringify(data.output, null, 2)}
            </pre>
          </div>
        )}

        {data.context && Object.keys(data.context).length > 0 && (
          <div className={styles.section}>
            <div className={styles.sectionHeader}>Execution Context</div>
            <pre className={styles.jsonViewer}>
              {JSON.stringify(data.context, null, 2)}
            </pre>
          </div>
        )}

        {data.error && (
          <div className={`${styles.section} ${styles.errorSection}`}>
            <div className={styles.sectionHeader}>Error</div>
            <div className={styles.errorMessage}>{data.error.message}</div>
            {data.error.stack && (
              <pre className={styles.errorStack}>{data.error.stack}</pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

