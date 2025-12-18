'use client';

import { useState, useEffect } from 'react';
import styles from './ToolTester.module.css';

interface ToolTesterProps {
  toolName: string;
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

export default function ToolTester({ toolName }: ToolTesterProps) {
  const [toolInfo, setToolInfo] = useState<ToolInfo | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(`/api/tools/${toolName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ args: formData }),
      });

      const data = await response.json();
      
      if (data.error) {
        setError(data.error);
      } else {
        setResult(data.result);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
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

        <button
          type="submit"
          disabled={loading}
          className={styles.submitButton}
        >
          {loading ? 'Testing...' : 'Test Tool'}
        </button>
      </form>

      {error && (
        <div className={styles.error}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {result && (
        <div className={styles.result}>
          <h3>Result:</h3>
          <pre className={styles.resultContent}>
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

