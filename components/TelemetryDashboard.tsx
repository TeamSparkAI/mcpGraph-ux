'use client';

import styles from './TelemetryDashboard.module.css';

export interface ExecutionTelemetry {
  totalDuration: number;
  nodeDurations: Record<string, number>;
  nodeCounts: Record<string, number>;
  errorCount: number;
}

interface TelemetryDashboardProps {
  telemetry: ExecutionTelemetry | null;
}

export default function TelemetryDashboard({ telemetry }: TelemetryDashboardProps) {
  if (!telemetry) {
    return (
      <div className={styles.container}>
        <h3 className={styles.title}>Performance Metrics</h3>
        <div className={styles.empty}>No telemetry data available</div>
      </div>
    );
  }

  const formatDuration = (ms: number) => {
    if (ms < 1) return `${(ms * 1000).toFixed(0)}μs`;
    if (ms < 1000) return `${ms.toFixed(2)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatPercentage = (value: number, total: number) => {
    if (total === 0) return '0%';
    return `${((value / total) * 100).toFixed(1)}%`;
  };

  // Calculate averages per node type
  const nodeTypeStats: Record<string, {
    totalDuration: number;
    count: number;
    averageDuration: number;
  }> = {};

  Object.entries(telemetry.nodeDurations).forEach(([nodeId, duration]) => {
    // Extract node type from nodeId (simplified - in real implementation, we'd need node metadata)
    // For now, we'll group by the pattern we see in nodeIds
    const nodeType = nodeId.split('_')[0] || 'unknown';
    
    if (!nodeTypeStats[nodeType]) {
      nodeTypeStats[nodeType] = {
        totalDuration: 0,
        count: 0,
        averageDuration: 0,
      };
    }
    
    nodeTypeStats[nodeType].totalDuration += duration;
    nodeTypeStats[nodeType].count += 1;
  });

  // Calculate averages
  Object.keys(nodeTypeStats).forEach(nodeType => {
    const stats = nodeTypeStats[nodeType];
    stats.averageDuration = stats.totalDuration / stats.count;
  });

  // Sort nodes by duration (descending)
  const sortedNodes = Object.entries(telemetry.nodeDurations)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10); // Top 10 slowest nodes

  // Sort node types by total duration
  const sortedNodeTypes = Object.entries(nodeTypeStats)
    .sort(([, a], [, b]) => b.totalDuration - a.totalDuration);

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Performance Metrics</h3>
      
      <div className={styles.metrics}>
        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>Total Duration</div>
          <div className={styles.metricValue}>{formatDuration(telemetry.totalDuration)}</div>
        </div>
        
        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>Nodes Executed</div>
          <div className={styles.metricValue}>
            {Object.values(telemetry.nodeCounts).reduce((sum, count) => sum + count, 0)}
          </div>
        </div>
        
        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>Errors</div>
          <div className={`${styles.metricValue} ${telemetry.errorCount > 0 ? styles.error : ''}`}>
            {telemetry.errorCount}
          </div>
        </div>
      </div>

      {sortedNodeTypes.length > 0 && (
        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>Duration by Node Type</h4>
          <div className={styles.nodeTypeList}>
            {sortedNodeTypes.map(([nodeType, stats]) => (
              <div key={nodeType} className={styles.nodeTypeItem}>
                <div className={styles.nodeTypeHeader}>
                  <span className={styles.nodeTypeName}>{nodeType}</span>
                  <span className={styles.nodeTypeCount}>{stats.count} nodes</span>
                </div>
                <div className={styles.progressBar}>
                  <div
                    className={styles.progressFill}
                    style={{
                      width: `${(stats.totalDuration / telemetry.totalDuration) * 100}%`,
                    }}
                  />
                </div>
                <div className={styles.nodeTypeStats}>
                  <span>Total: {formatDuration(stats.totalDuration)}</span>
                  <span>Avg: {formatDuration(stats.averageDuration)}</span>
                  <span>{formatPercentage(stats.totalDuration, telemetry.totalDuration)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {sortedNodes.length > 0 && (
        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>Slowest Nodes</h4>
          <div className={styles.slowNodesList}>
            {sortedNodes.map(([nodeId, duration]) => (
              <div key={nodeId} className={styles.slowNodeItem}>
                <span className={styles.slowNodeId}>{nodeId}</span>
                <span className={styles.slowNodeDuration}>{formatDuration(duration)}</span>
                <div className={styles.slowNodeBar}>
                  <div
                    className={styles.slowNodeFill}
                    style={{
                      width: `${(duration / telemetry.totalDuration) * 100}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

