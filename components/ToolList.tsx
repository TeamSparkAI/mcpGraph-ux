'use client';

import styles from './ToolList.module.css';

interface Tool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
}

interface ToolListProps {
  tools: Tool[];
  selectedTool: string | null;
  onSelectTool: (toolName: string) => void;
}

export default function ToolList({
  tools,
  selectedTool,
  onSelectTool,
}: ToolListProps) {
  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Tools</h2>
      <div className={styles.toolList}>
        {tools.map(tool => (
          <div
            key={tool.name}
            className={`${styles.toolItem} ${
              selectedTool === tool.name ? styles.selected : ''
            }`}
            onClick={() => onSelectTool(tool.name)}
          >
            <div className={styles.toolName}>{tool.name}</div>
            <div className={styles.toolDescription}>{tool.description}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

