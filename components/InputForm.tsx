'use client';

import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import styles from './InputForm.module.css';

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

export interface InputFormHandle {
  submit: (startPaused: boolean) => void;
}

interface InputFormProps {
  toolName: string;
  onSubmit: (formData: Record<string, any>, startPaused: boolean) => void;
  disabled?: boolean;
}

const InputForm = forwardRef<InputFormHandle, InputFormProps>(({ toolName, onSubmit, disabled }, ref) => {
  const [toolInfo, setToolInfo] = useState<ToolInfo | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const pendingStartPausedRef = useRef<boolean>(false);

  useEffect(() => {
    // Fetch tool information
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

  // Expose submit method to parent via ref
  useImperativeHandle(ref, () => ({
    submit: (startPaused: boolean) => {
      pendingStartPausedRef.current = startPaused;
      if (formRef.current) {
        formRef.current.requestSubmit();
      } else {
        console.warn('[InputForm] formRef.current is null, cannot submit form');
      }
    },
  }));

  const handleInputChange = (key: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const startPaused = pendingStartPausedRef.current;
    pendingStartPausedRef.current = false;
    
    // Validate required fields
    if (toolInfo?.inputSchema.required) {
      for (const field of toolInfo.inputSchema.required) {
        if (!formData[field] || (typeof formData[field] === 'string' && formData[field].trim() === '')) {
          setError(`Field "${field}" is required`);
          return;
        }
      }
    }
    
    setError(null);
    onSubmit(formData, startPaused);
  };

  const renderInputField = (key: string, prop: any) => {
    const value = formData[key];
    const isRequired = toolInfo?.inputSchema.required?.includes(key);

    switch (prop.type) {
      case 'string':
        if (prop.format === 'multiline' || (typeof value === 'string' && value.includes('\n'))) {
          return (
            <div key={key} className={styles.field}>
              <label htmlFor={key} className={styles.label}>
                {key}
                {isRequired && <span className={styles.required}>*</span>}
              </label>
              <textarea
                id={key}
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
                disabled={disabled}
              />
              {prop.description && (
                <div className={styles.hint}>{prop.description}</div>
              )}
            </div>
          );
        }
        return (
          <div key={key} className={styles.field}>
            <label htmlFor={key} className={styles.label}>
              {key}
              {isRequired && <span className={styles.required}>*</span>}
            </label>
            <input
              id={key}
              type="text"
              value={typeof value === 'string' ? value : JSON.stringify(value)}
              onChange={e => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  handleInputChange(key, parsed);
                } catch {
                  handleInputChange(key, e.target.value);
                }
              }}
              className={styles.input}
              placeholder={prop.description || `Enter ${key}`}
              disabled={disabled}
            />
            {prop.description && (
              <div className={styles.hint}>{prop.description}</div>
            )}
          </div>
        );
      case 'number':
        return (
          <div key={key} className={styles.field}>
            <label htmlFor={key} className={styles.label}>
              {key}
              {isRequired && <span className={styles.required}>*</span>}
            </label>
            <input
              id={key}
              type="number"
              value={typeof value === 'number' ? value : ''}
              onChange={e => handleInputChange(key, e.target.value ? Number(e.target.value) : 0)}
              className={styles.input}
              placeholder={prop.description || `Enter ${key}`}
              disabled={disabled}
            />
            {prop.description && (
              <div className={styles.hint}>{prop.description}</div>
            )}
          </div>
        );
      case 'boolean':
        return (
          <div key={key} className={styles.field}>
            <label htmlFor={key} className={styles.checkboxLabel}>
              <input
                id={key}
                type="checkbox"
                checked={value === true}
                onChange={e => handleInputChange(key, e.target.checked)}
                className={styles.checkbox}
                disabled={disabled}
              />
              {key}
              {isRequired && <span className={styles.required}>*</span>}
            </label>
            {prop.description && (
              <div className={styles.hint}>{prop.description}</div>
            )}
          </div>
        );
      default:
        // For complex types (object, array), use textarea with JSON
        return (
          <div key={key} className={styles.field}>
            <label htmlFor={key} className={styles.label}>
              {key}
              {isRequired && <span className={styles.required}>*</span>}
            </label>
            <textarea
              id={key}
              value={typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
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
              disabled={disabled}
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

  if (error) {
    return (
      <div className={styles.error}>
        <strong>Error:</strong> {error}
      </div>
    );
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className={styles.form}>
      <div className={styles.inputs}>
        {toolInfo.inputSchema.properties &&
          Object.entries(toolInfo.inputSchema.properties).map(([key, prop]) =>
            renderInputField(key, prop)
          )}
      </div>
    </form>
  );
});

InputForm.displayName = 'InputForm';

export default InputForm;

