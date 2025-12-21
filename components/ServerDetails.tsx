'use client';

import styles from './ServerDetails.module.css';


interface ServerInfo {
  name: string;
  type: string;
  command?: string;
  args?: string[];
  cwd?: string;
  url?: string;
  headers?: Record<string, string>;
}

interface ServerDetailsProps {
  config: {
    name: string;
    version: string;
    description?: string;
    servers: ServerInfo[];
  };
}

// Server config section
export function ServerConfig({ config }: ServerDetailsProps) {
  if (!config || !config.name) {
    return null;
  }

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Server</h2>
      <div className={styles.configInfo}>
        <div className={styles.configName}>{config.name}</div>
        {config.version && (
          <div className={styles.configVersion}>v{config.version}</div>
        )}
        {config.description && (
          <div className={styles.configDescription}>{config.description}</div>
        )}
      </div>
    </div>
  );
}

// MCP Servers section
export function McpServers({ config }: ServerDetailsProps) {
  if (!config || !config.servers || config.servers.length === 0) {
    return null;
  }

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>MCP Servers</h2>
      <div className={styles.servers}>
        {config.servers.map((server, index) => (
          <div key={index} className={styles.server}>
            <div className={styles.serverName}>{server.name}</div>
            <div className={styles.serverType}>
              <span className={styles.label}>Type:</span>
              <code className={styles.code}>{server.type}</code>
            </div>
            {server.command && (
              <div className={styles.serverCommand}>
                <span className={styles.label}>Command:</span>
                <code className={styles.code}>{server.command}</code>
              </div>
            )}
            {server.args && server.args.length > 0 && (
              <div className={styles.serverArgs}>
                <span className={styles.label}>Args:</span>
                <code className={styles.code}>{server.args.join(' ')}</code>
              </div>
            )}
            {server.cwd && (
              <div className={styles.serverCwd}>
                <span className={styles.label}>CWD:</span>
                <code className={styles.code}>{server.cwd}</code>
              </div>
            )}
            {server.url && (
              <div className={styles.serverUrl}>
                <span className={styles.label}>URL:</span>
                <code className={styles.code}>{server.url}</code>
              </div>
            )}
            {server.headers && Object.keys(server.headers).length > 0 && (
              <div className={styles.serverHeaders}>
                <span className={styles.label}>Headers:</span>
                <div className={styles.headers}>
                  {Object.entries(server.headers).map(([key, value]) => (
                    <div key={key} className={styles.header}>
                      <code className={styles.code}>{key}: {value}</code>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Legacy default export for backwards compatibility
export default function ServerDetails({ config }: ServerDetailsProps) {
  return (
    <>
      <ServerConfig config={config} />
      <McpServers config={config} />
    </>
  );
}

