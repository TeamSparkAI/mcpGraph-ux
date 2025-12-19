# Graph Introspection & Debugging Implementation Plan

## Overview

This document outlines the plan for implementing graph introspection and debugging features in mcpGraph UX, leveraging the new capabilities in mcpGraph 0.1.7+.

## Current State

The application currently provides:
- Static graph visualization
- Tool listing and testing
- Basic execution with result display

## New Features to Implement

### 1. Real-time Execution Visualization

**Goal**: Show execution progress in real-time as nodes execute

**Implementation**:
- Add execution hooks (`onNodeStart`, `onNodeComplete`, `onNodeError`) to tool execution
- Update graph visualization to show:
  - Current executing node (highlighted/animated)
  - Completed nodes (green checkmark)
  - Failed nodes (red X)
  - Node execution duration
- Use Server-Sent Events (SSE) for real-time updates from server to client

**Components**:
- Extend `GraphVisualization` component to accept execution state
- Add visual indicators for node status (running, completed, error, pending)
- Add animation/transition effects for active nodes

**API Changes**:
- Modify `/api/tools/[toolName]` POST endpoint to accept execution options
- Add new endpoint `/api/execution/state` to get current execution state
- Add SSE endpoint `/api/execution/stream` for real-time execution event streaming

### 2. Execution History & Timeline

**Goal**: Display complete execution history with timing information

**Implementation**:
- Create new `ExecutionHistory` component showing:
  - Chronological list of executed nodes
  - Start/end times
  - Duration for each node
  - Input/output data for each node
  - Error information if any
- Add timeline visualization showing execution flow
- Allow clicking on history items to highlight corresponding nodes in graph

**Components**:
- `ExecutionHistory.tsx` - List/timeline view of execution
- `ExecutionTimeline.tsx` - Visual timeline component
- Extend `ToolTester` to show history after execution

**API Changes**:
- Execution result already includes `executionHistory` - no API changes needed
- May need to serialize Map objects in telemetry for JSON response

### 3. Performance Telemetry Dashboard

**Goal**: Show performance metrics and statistics

**Implementation**:
- Create `TelemetryDashboard` component displaying:
  - Total execution duration
  - Duration breakdown by node type
  - Execution count per node type
  - Error count
  - Average duration per node type
- Add charts/visualizations for metrics
- Show slowest nodes

**Components**:
- `TelemetryDashboard.tsx` - Metrics display component
- Consider using a charting library (e.g., recharts) for visualizations

**API Changes**:
- Execution result already includes `telemetry` - may need to serialize Map objects

### 4. Interactive Debugging Controls

**Goal**: Provide step-through debugging capabilities

**Implementation**:
- Add debug controls UI:
  - Play/Pause button
  - Step button (step over next node)
  - Resume button
  - Breakpoint toggle (click nodes to set/clear breakpoints)
- Show current execution state (status, current node)
- Display execution context data when paused
- Allow setting breakpoints on nodes in the graph

**Components**:
- `DebugControls.tsx` - Debug toolbar component
- Extend `GraphVisualization` to support breakpoint indicators
- Add click handlers on nodes to toggle breakpoints
- Create `ExecutionStateViewer.tsx` - Show context data when paused

**API Changes**:
- Add `/api/execution/controller` endpoint for pause/resume/step operations
- Add `/api/execution/breakpoints` endpoint for managing breakpoints
- Modify tool execution to stream events via SSE for real-time state updates

### 5. Node Data Inspection

**Goal**: Allow users to inspect input/output data for each node

**Implementation**:
- Add node detail panel that shows:
  - Node type and ID
  - Input data (when available)
  - Output data (when available)
  - Execution duration
  - Error information (if any)
- Allow clicking on nodes in graph or history to view details
- Show JSON data in formatted, expandable view

**Components**:
- `NodeInspector.tsx` - Panel for viewing node details
- Extend `GraphVisualization` to support node click events
- Add data viewer component for JSON display

**API Changes**:
- Execution history already includes input/output - no changes needed

## Implementation Phases

### Phase 1: Foundation (Real-time Visualization)
1. Upgrade to mcpGraph 0.1.7
2. Add execution hooks to tool execution
3. Implement SSE endpoint `/api/execution/stream` for real-time event streaming
4. Create client-side SSE connection abstraction (for future flexibility)
5. Update graph visualization to show execution state
6. Add visual indicators (running, completed, error)
7. Connect SSE events to graph visualization updates
8. Test with simple graphs

**Estimated Effort**: 3-4 days

### Phase 2: History & Telemetry
1. Create ExecutionHistory component
2. Create TelemetryDashboard component
3. Integrate into ToolTester
4. Add timeline visualization
5. Test with various graph types

**Estimated Effort**: 2-3 days

### Phase 3: Debugging Controls
1. Create DebugControls component
2. Add execution controller API endpoints
3. Implement pause/resume/step functionality
4. Add breakpoint management UI
5. Test step-through debugging

**Estimated Effort**: 3-4 days

### Phase 4: Data Inspection
1. Create NodeInspector component
2. Add node click handlers to graph
3. Implement data viewer with JSON formatting
4. Add context data viewing when paused
5. Polish UI/UX

**Estimated Effort**: 2-3 days

### Phase 5: Polish & Optimization
1. Add loading states
2. Error handling improvements
3. Performance optimization
4. UI/UX refinements
5. Documentation updates

**Estimated Effort**: 1-2 days

## Technical Considerations

### Real-time Updates

**Server-Sent Events (SSE)**
- Stream execution events in real-time from server to client
- Use browser's native `EventSource` API (no extra dependencies)
- Automatic reconnection on connection loss
- One-way communication (server → client) perfect for execution monitoring
- Control operations (pause/resume/step) use regular HTTP POST endpoints
- Pros: Simple, real-time, efficient, built-in browser support, automatic reconnection
- Cons: One-way only (but we don't need bidirectional for this use case)

**Implementation**:
- Server: Stream events via SSE endpoint `/api/execution/stream`
- Client: Use `EventSource` to receive events and update UI
- Events include: `nodeStart`, `nodeComplete`, `nodeError`, `pause`, `resume`, `stateUpdate`
- Abstract connection layer for easy migration if needed later

**Recommendation**: Use SSE - it's the best fit for this use case

### State Management

- Use React state for execution state
- Consider using a state management library (Zustand, Redux) if state becomes complex
- Store execution history and telemetry in component state or context

### SSE Connection Management

- Create abstraction layer for execution stream connection:
  ```typescript
  interface ExecutionStream {
    connect(callback: (event: ExecutionEvent) => void): void;
    disconnect(): void;
    isConnected(): boolean;
  }
  ```
- This allows easy migration to WebSocket or polling later if needed
- Handle connection lifecycle (connect on execution start, disconnect on completion/error)
- Implement automatic reconnection logic
- Clean up connections on component unmount

### Data Serialization

- Telemetry uses `Map` objects which don't serialize to JSON
- Need to convert Maps to objects/arrays in API responses:
  ```typescript
  const telemetryJson = {
    ...telemetry,
    nodeDurations: Object.fromEntries(telemetry.nodeDurations),
    nodeCounts: Object.fromEntries(telemetry.nodeCounts)
  };
  ```

### Execution Controller Lifecycle

- Controller is only available during execution
- Need to handle cases where execution completes before user can interact
- Show appropriate UI states (not available, available, execution complete)

## API Endpoints to Add/Modify

### New Endpoints

1. **GET /api/execution/stream** (SSE)
   - Server-Sent Events stream for real-time execution updates
   - Streams events: `nodeStart`, `nodeComplete`, `nodeError`, `pause`, `resume`, `stateUpdate`
   - Each event contains relevant execution state data
   - Connection automatically reconnects if dropped

2. **GET /api/execution/state** (optional, for initial state)
   - Returns current execution state (if execution in progress)
   - Returns null if no execution
   - May be useful for initial state before SSE connection is established

2. **POST /api/execution/controller/pause**
   - Pause current execution
   - Returns success/error

3. **POST /api/execution/controller/resume**
   - Resume paused execution
   - Returns success/error

4. **POST /api/execution/controller/step**
   - Step to next node
   - Returns success/error

5. **GET /api/execution/breakpoints**
   - Get current breakpoints

6. **POST /api/execution/breakpoints**
   - Set breakpoints (array of node IDs)

7. **DELETE /api/execution/breakpoints**
   - Clear all breakpoints

### Modified Endpoints

1. **POST /api/tools/[toolName]**
   - Accept `ExecutionOptions` in request body:
     ```typescript
     {
       args: Record<string, unknown>,
       options?: {
         hooks?: ExecutionHooks,
         breakpoints?: string[],
         enableTelemetry?: boolean
       }
     }
     ```
   - Return execution result with history and telemetry
   - Handle Map serialization for telemetry

## UI/UX Design Considerations

### Graph Visualization Updates

- **Node States**:
  - Pending: Gray/default
  - Running: Blue with pulse animation
  - Completed: Green with checkmark
  - Error: Red with X icon
  - Paused: Yellow/orange highlight

- **Breakpoints**:
  - Red dot/badge on nodes with breakpoints
  - Click node to toggle breakpoint

- **Current Node**:
  - Highlighted border
  - Pulse animation
  - Tooltip showing execution info

### Layout Changes

- Add execution history panel (sidebar or bottom panel)
- Add debug controls toolbar (top of graph area)
- Add node inspector panel (right side or modal)
- Consider collapsible panels for better space usage

### User Flow

1. User selects tool and enters parameters
2. User can optionally set breakpoints on nodes
3. User clicks "Test Tool" or "Debug Tool"
4. Execution starts, graph updates in real-time
5. If paused, user can inspect state, step, or resume
6. After completion, history and telemetry are displayed
7. User can click on history items or nodes to inspect data

## Testing Strategy

1. **Unit Tests**:
   - Test execution hooks integration
   - Test state management
   - Test data serialization

2. **Integration Tests**:
   - Test full execution flow with hooks
   - Test pause/resume/step operations
   - Test breakpoint functionality

3. **Manual Testing**:
   - Test with various graph types (simple, complex, with switches)
   - Test error scenarios
   - Test performance with large graphs
   - Test concurrent executions (should be prevented)

## Dependencies to Add

- Consider adding charting library for telemetry visualization:
  - `recharts` (React charting library)
  - Or `chart.js` with React wrapper

## Future Enhancements

- Conditional breakpoints (break when expression is true)
- Watch expressions (monitor specific values)
- Execution replay from history
- Compare multiple executions
- Export execution history/telemetry
- OpenTelemetry integration

## Success Criteria

- Users can see real-time execution progress in the graph
- Users can pause, resume, and step through execution
- Users can set breakpoints on nodes
- Users can view complete execution history with timing
- Users can inspect node input/output data
- Users can view performance telemetry
- All features work reliably with various graph types

