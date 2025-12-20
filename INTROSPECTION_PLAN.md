# Graph Introspection & Debugging Implementation Plan

## Overview

This document outlines the plan for implementing graph introspection and debugging features in mcpGraph UX, leveraging the new capabilities in mcpGraph 0.1.7+.

## Current State (As-Built)

The application currently provides:
- ✅ Static graph visualization with automatic layout (dagre)
- ✅ Tool listing and testing
- ✅ Real-time execution visualization with SSE
- ✅ Execution history display
- ✅ Interactive debugging controls (pause, resume, step, stop)
- ✅ Breakpoint management
- ✅ Node data inspection
- ✅ Execution summary stats (elapsed time, nodes executed, errors)

## Implementation Status

### ✅ Phase 1: Foundation (Real-time Visualization) - COMPLETED

**Status**: Fully implemented and working

**Completed Items**:
1. ✅ Upgraded to mcpGraph 0.1.9
2. ✅ Added execution hooks (`onNodeStart`, `onNodeComplete`, `onNodeError`, `onPause`, `onResume`) to tool execution
3. ✅ Implemented SSE endpoint `/api/execution/stream` for real-time event streaming
4. ✅ Created client-side SSE connection abstraction (`lib/executionStream.ts`)
5. ✅ Updated graph visualization to show execution state
6. ✅ Added visual indicators (running, completed, error, paused, stopped)
7. ✅ Connected SSE events to graph visualization updates
8. ✅ Added node type icons (MCP, Entry, Exit, Transform, Switch)

**Components**:
- `lib/executionStream.ts` - SSE abstraction layer
- `lib/executionStreamServer.ts` - Server-side SSE stream management
- `app/api/execution/stream/route.ts` - SSE endpoint
- `components/GraphVisualization.tsx` - Extended with execution state visualization

**API Endpoints**:
- ✅ `GET /api/execution/stream` - SSE stream for real-time execution updates

### ✅ Phase 2: History & Telemetry - COMPLETED (with modifications)

**Status**: Implemented with design changes

**Completed Items**:
1. ✅ Created `ExecutionHistory` component
2. ✅ Integrated into `ToolTester`
3. ✅ Execution history displays chronological list with input/output data
4. ✅ Clicking history items highlights nodes in graph and opens inspector

**Design Changes from Original Plan**:
- ❌ **TelemetryDashboard component removed** - Performance metrics dashboard was removed per user request
- ✅ **Telemetry stats moved to results display** - Elapsed time, nodes executed, and error count now appear in the result header
- ❌ **Timeline visualization deferred** - Visual timeline component was explicitly left as a future task

**Components**:
- `components/ExecutionHistory.tsx` - Chronological execution history display
- `components/ToolTester.tsx` - Integrated history and telemetry stats in results

**API Changes**:
- ✅ Execution result includes `executionHistory` and `telemetry`
- ✅ Map objects serialized to JSON in API responses

### ✅ Phase 3: Debugging Controls - COMPLETED

**Status**: Fully implemented and working

**Completed Items**:
1. ✅ Created `DebugControls` component
2. ✅ Added execution controller API endpoints
3. ✅ Implemented pause/resume/step/stop functionality
4. ✅ Added breakpoint management UI
5. ✅ Breakpoints displayed on graph nodes with clickable indicators
6. ✅ All debug controls always visible (enabled/disabled based on state)

**Components**:
- `components/DebugControls.tsx` - Debug toolbar with Run, Step, Pause, Resume, Stop
- `components/GraphVisualization.tsx` - Breakpoint indicators and toggle handlers
- `lib/executionController.ts` - Server-side controller management
- `app/api/execution/controller/route.ts` - Controller API endpoint
- `app/api/execution/breakpoints/route.ts` - Breakpoint management API

**API Endpoints**:
- ✅ `POST /api/execution/controller` - Pause, resume, step, stop operations
- ✅ `GET /api/execution/breakpoints` - Get current breakpoints
- ✅ `POST /api/execution/breakpoints` - Set breakpoints
- ✅ `DELETE /api/execution/breakpoints` - Clear all breakpoints

**Features**:
- Breakpoint indicators on graph nodes (red dot, clickable with larger hit target)
- Step mode (start execution and pause at first node)
- Stop functionality to cancel ongoing executions
- Execution status display (running, paused, finished, error, stopped)

### ✅ Phase 4: Data Inspection - MOSTLY COMPLETED

**Status**: Core functionality implemented, one feature deferred

**Completed Items**:
1. ✅ Created `NodeInspector` component
2. ✅ Added node click handlers to graph visualization
3. ✅ Implemented data viewer with JSON formatting
4. ✅ Inspector displays node ID, type, duration, timestamps
5. ✅ Inspector displays input/output data from execution history
6. ✅ Inspector displays error information with stack traces
7. ✅ Inspector accessible from both graph nodes and execution history
8. ✅ Execution history lifted to main page for cross-component access

**Components**:
- `components/NodeInspector.tsx` - Node detail panel
- `components/GraphVisualization.tsx` - Node click handlers
- `app/page.tsx` - Execution history state management

**Remaining Item**:
- ⏳ **Context data viewing when paused** - Not yet implemented (requires API support for fetching execution context from controller when paused)

### ⏳ Phase 5: Polish & Optimization - PARTIALLY COMPLETED

**Status**: Some items completed, others remain

**Completed Items**:
1. ✅ Loading states for tool execution
2. ✅ Error handling for execution failures
3. ✅ UI/UX refinements (consistent styling, layout improvements)
4. ✅ Server details display
5. ✅ Execution history state management across components

**Remaining Items**:
- ⏳ Performance optimization for large graphs
- ⏳ Additional error handling improvements
- ⏳ Documentation updates

## Technical Implementation Details

### Real-time Updates

**Server-Sent Events (SSE)** - ✅ Implemented
- Stream execution events in real-time from server to client
- Uses browser's native `EventSource` API
- Automatic reconnection on connection loss
- One-way communication (server → client) for execution monitoring
- Control operations (pause/resume/step/stop) use regular HTTP POST endpoints

**Implementation**:
- Server: Stream events via SSE endpoint `/api/execution/stream`
- Client: `SSEExecutionStream` class wraps `EventSource` for abstraction
- Events: `connected`, `nodeStart`, `nodeComplete`, `nodeError`, `pause`, `resume`, `executionComplete`, `executionError`, `executionStopped`, `stateUpdate`

### State Management

- ✅ React state for execution state
- ✅ Execution history lifted to main page component for cross-component access
- ✅ Execution state managed in `ToolTester` and synced to parent via callbacks

### Data Serialization

- ✅ Telemetry `Map` objects converted to plain objects in API responses
- ✅ Execution history serialized correctly with input/output data

### Execution Controller Lifecycle

- ✅ Controller registered after execution starts
- ✅ Controller available during execution for pause/resume/step/stop
- ✅ Controller unregistered on execution completion or stop

## API Endpoints (As-Built)

### Implemented Endpoints

1. **GET /api/execution/stream** (SSE) ✅
   - Server-Sent Events stream for real-time execution updates
   - Streams events: `nodeStart`, `nodeComplete`, `nodeError`, `pause`, `resume`, `executionComplete`, `executionError`, `executionStopped`, `stateUpdate`

2. **POST /api/execution/controller** ✅
   - Unified endpoint for pause, resume, step, and stop operations
   - Actions: `pause`, `resume`, `step`, `stop`

3. **GET /api/execution/breakpoints** ✅
   - Get current breakpoints for an execution

4. **POST /api/execution/breakpoints** ✅
   - Set breakpoints (array of node IDs)

5. **DELETE /api/execution/breakpoints** ✅
   - Clear all breakpoints

### Modified Endpoints

1. **POST /api/tools/[toolName]** ✅
   - Accepts `ExecutionOptions` in request body:
     ```typescript
     {
       args: Record<string, unknown>,
       executionId?: string,
       options?: {
         breakpoints?: string[],
         enableTelemetry?: boolean
       }
     }
     ```
   - Returns execution result with history and telemetry
   - Handles Map serialization for telemetry
   - Streams events via SSE if `executionId` provided

## UI/UX Implementation (As-Built)

### Graph Visualization

- **Node States**:
  - ✅ Pending: Gray/default
  - ✅ Running: Yellow with pulse animation
  - ✅ Completed: Green with checkmark
  - ✅ Error: Red with X icon
  - ✅ Paused: Cyan highlight
  - ✅ Stopped: Gray

- **Breakpoints**:
  - ✅ Red dot indicator on nodes with breakpoints
  - ✅ Clickable breakpoint toggle (larger hit target, fixed position)
  - ✅ Visual feedback on hover

- **Node Types**:
  - ✅ Icons displayed next to node labels (MCP, Entry, Exit, Transform, Switch)

- **Node Interaction**:
  - ✅ Click nodes to open inspector
  - ✅ Click history items to highlight nodes and open inspector

### Layout

- ✅ Execution history panel below tool tester
- ✅ Debug controls toolbar integrated into tool tester
- ✅ Node inspector panel below tool tester (when node selected)
- ✅ Server details displayed in sidebar above tools list

### User Flow

1. ✅ User selects tool and enters parameters
2. ✅ User can optionally set breakpoints on nodes
3. ✅ User clicks "Run" or "Step" button
4. ✅ Execution starts, graph updates in real-time
5. ✅ If paused, user can inspect state, step, or resume
6. ✅ After completion, history and summary stats are displayed
7. ✅ User can click on history items or nodes to inspect data

## Remaining Tasks

### High Priority

1. **Context Data Viewing When Paused** ⏳
   - Fetch execution context from controller when execution is paused
   - Display context data in NodeInspector when paused
   - May require new API endpoint or extension to existing controller endpoint
   - **Status**: Deferred - requires investigation of mcpGraph API capabilities

### Medium Priority

2. **Visual Timeline Component** ⏳
   - Create visual timeline showing execution flow over time
   - Display as alternative view to execution history list
   - **Status**: Explicitly deferred as future task per user request

3. **Performance Optimization** ⏳
   - Optimize rendering for large graphs
   - Optimize SSE event handling for high-frequency updates
   - **Status**: Not yet addressed

### Low Priority / Future Enhancements

4. **Conditional Breakpoints**
   - Break when expression evaluates to true
   - Requires expression evaluation engine

5. **Watch Expressions**
   - Monitor specific values during execution
   - Display in debug panel

6. **Execution Replay**
   - Replay execution from history
   - Step through historical execution

7. **Compare Multiple Executions**
   - Side-by-side comparison of execution results
   - Diff view for execution history

8. **Export Execution History/Telemetry**
   - Export to JSON/CSV
   - Share execution traces

9. **OpenTelemetry Integration**
   - Export telemetry to OpenTelemetry format
   - Integration with observability platforms

10. **Documentation Updates**
    - Update README with new features
    - Add usage examples
    - Document API endpoints

## Success Criteria

- ✅ Users can see real-time execution progress in the graph
- ✅ Users can pause, resume, and step through execution
- ✅ Users can set breakpoints on nodes
- ✅ Users can view complete execution history with timing
- ✅ Users can inspect node input/output data
- ✅ Users can view execution summary (elapsed time, nodes, errors)
- ✅ All features work reliably with various graph types
- ⏳ Users can view execution context when paused (deferred)

## Notes

- **TelemetryDashboard removed**: The detailed performance metrics dashboard was removed per user request. Summary stats (elapsed time, nodes executed, errors) are now displayed in the results header.
- **Timeline visualization deferred**: Visual timeline component was explicitly left as a future task.
- **Context viewing deferred**: Execution context viewing when paused requires investigation of mcpGraph API capabilities.
- **mcpGraph version**: Currently using mcpGraph 0.1.9
- **Build status**: All implemented features compile and build successfully
