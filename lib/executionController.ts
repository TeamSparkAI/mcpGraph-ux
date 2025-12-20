/**
 * Execution controller management
 * Stores active execution controllers for pause/resume/step operations
 * Uses the same module scope as the API instance
 */

import type { ExecutionController } from 'mcpgraph';
import { getControllersMap } from './mcpGraphApi';

/**
 * Register an execution controller for an execution
 */
export function registerController(executionId: string, controller: ExecutionController): void {
  getControllersMap().set(executionId, controller);
  console.log(`[Controller] Registered controller for executionId: ${executionId}`);
}

/**
 * Unregister an execution controller
 */
export function unregisterController(executionId: string): void {
  getControllersMap().delete(executionId);
  console.log(`[Controller] Unregistered controller for executionId: ${executionId}`);
}

/**
 * Get an execution controller by executionId
 */
export function getController(executionId: string): ExecutionController | null {
  return getControllersMap().get(executionId) || null;
}

/**
 * Check if an execution is active
 */
export function isExecutionActive(executionId: string): boolean {
  return getControllersMap().has(executionId);
}

/**
 * Get all registered execution IDs (for debugging)
 */
export function getAllExecutionIds(): string[] {
  return Array.from(getControllersMap().keys());
}

