import React, { memo, useState, useCallback, useRef } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  addEdge,
  Position,
  MarkerType,
  Handle,
  getBezierPath,
  Background,
  Controls,
  MiniMap,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

/* -------------------------
 * 1. Custom Node Component
 * -------------------------
 * - Local state for the text field so typing doesn't
 *   lose focus or cause rerenders of the entire flow.
 * - Has a top "target" handle and bottom "source" handle
 *   for vertical connections.
 */
const TextNode = memo(({ id, data }) => {
  const { updateNodeData } = useReactFlow();
  const [localText, setLocalText] = useState(data?.text || '');

  // Only commit to global flow on blur or Enter
  const commitChange = useCallback(() => {
    updateNodeData(id, { text: localText });
  }, [id, localText, updateNodeData]);

  // Prevent node-drag events while clicking/typing inside the input
  const stopPropagation = (e) => e.stopPropagation();

  return (
    <div
      style={{
        padding: 10,
        border: '1px solid #333',
        borderRadius: 4,
        backgroundColor: '#fafafa',
        minWidth: 120,
        textAlign: 'center',
      }}
    >
      {/* Target handle on top (incoming connections) */}
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: '#555' }}
      />

      <input
        style={{
          width: '100%',
          border: 'none',
          background: 'transparent',
          outline: 'none',
          fontSize: '14px',
          textAlign: 'center',
        }}
        value={localText}
        onChange={(e) => setLocalText(e.target.value)}
        onBlur={commitChange}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.target.blur(); // triggers onBlur -> commitChange
          }
        }}
        onMouseDown={stopPropagation}
        onClick={stopPropagation}
      />

      {/* Source handle on bottom (outgoing connections) */}
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: '#555' }}
      />
    </div>
  );
});

/* -------------------------
 * 2. Custom Edge Component
 * -------------------------
 * - Uses a <foreignObject> to place an <input> directly on the edge
 *   so the user can edit the label in place.
 * - Local state to avoid losing focus while typing.
 */
const TextEdge = memo(({ id, sourceX, sourceY, targetX, targetY, data, markerEnd, selected }) => {
  const { updateEdgeData } = useReactFlow();
  const [localLabel, setLocalLabel] = useState(data?.label || '');

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
  });

  // Commit changes to global flow on blur or Enter
  const commitChange = useCallback(() => {
    updateEdgeData(id, { label: localLabel });
  }, [id, localLabel, updateEdgeData]);

  // Prevent edge-drag events while clicking/typing inside the input
  const stopPropagation = (e) => e.stopPropagation();

  return (
    <>
      <path
        id={id}
        d={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: selected ? '#FF0072' : '#222',
          strokeWidth: 2,
        }}
        className="react-flow__edge-path"
      />
      <foreignObject
        x={labelX - 50}
        y={labelY - 15}
        width={100}
        height={30}
        style={{ overflow: 'visible' }}
        requiredExtensions="http://www.w3.org/1999/xhtml"
      >
        <div
          style={{
            background: 'white',
            border: '1px solid #ccc',
            borderRadius: 4,
            padding: 2,
          }}
          onMouseDown={stopPropagation}
          onClick={stopPropagation}
        >
          <input
            style={{ width: 90 }}
            value={localLabel}
            onChange={(e) => setLocalLabel(e.target.value)}
            onBlur={commitChange}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.target.blur();
              }
            }}
          />
        </div>
      </foreignObject>
    </>
  );
});

/* -------------------------
 * 3. Initial Data
 * -------------------------
 * - Two nodes with empty text (node labels)
 * - One arrowed edge with a label
 */
const initialNodes = [
  {
    id: '1',
    type: 'textNode',
    position: { x: 150, y: 50 },
    data: { text: '' },
  },
  {
    id: '2',
    type: 'textNode',
    position: { x: 150, y: 250 },
    data: { text: '' },
  },
];
const initialEdges = [
  {
    id: '1->2',
    source: '1',
    target: '2',
    type: 'textEdge',
    markerEnd: { type: MarkerType.ArrowClosed },
    data: { label: 'My Edge' },
  },
];

/* -------------------------
 * 4. Main Flow Component
 * -------------------------
 */
function FlowchartEditor() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const nodeCountRef = useRef(2);

  // For adding new nodes
  const addNode = useCallback(() => {
    nodeCountRef.current += 1;
    const newId = nodeCountRef.current.toString();
    const newNode = {
      id: newId,
      type: 'textNode',
      position: { x: 150, y: 100 + nodeCountRef.current * 50 },
      data: { text: '' },
    };
    setNodes((nds) => nds.concat(newNode));
  }, [setNodes]);

  // Export to JSON
  const exportToJson = useCallback(() => {
    const flowchartData = { nodes, edges };
    const json = JSON.stringify(flowchartData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'flowchart.json';
    link.click();
  }, [nodes, edges]);

  // Connect nodes with arrow edges
  const onConnect = useCallback(
    (params) =>
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            type: 'textEdge',
            markerEnd: { type: MarkerType.ArrowClosed },
            data: { label: '' },
          },
          eds
        )
      ),
    [setEdges]
  );

  // Register our custom node + edge components
  const nodeTypes = { textNode: TextNode };
  const edgeTypes = { textEdge: TextEdge };

  return (
    <div style={{ width: '100%', height: '100vh' }}>
      <button
        onClick={addNode}
        style={{
          position: 'absolute',
          zIndex: 10,
          left: 10,
          top: 10,
          padding: '8px 16px',
        }}
      >
        Add Node
      </button>
      <button
        onClick={exportToJson}
        style={{
          position: 'absolute',
          zIndex: 10,
          left: 110,
          top: 10,
          padding: '8px 16px',
        }}
      >
        Export to JSON
      </button>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
      >
        <Background variant="dots" gap={12} size={1} />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}

/* -------------------------
 * 5. Wrap in Provider
 * -------------------------
 */
export default function App() {
  return (
    <ReactFlowProvider>
      <FlowchartEditor />
    </ReactFlowProvider>
  );
}
