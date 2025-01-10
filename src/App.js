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
 * - Editable text field (local state).
 * - Top "target" handle, bottom "source" handle.
 */
const TextNode = memo(({ id, data }) => {
  const { updateNodeData } = useReactFlow();
  const [localText, setLocalText] = useState(data?.text || '');

  const commitChange = useCallback(() => {
    updateNodeData(id, { text: localText });
  }, [id, localText, updateNodeData]);

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
      {/* Top handle (incoming) */}
      <Handle type="target" position={Position.Top} style={{ background: '#555' }} />

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
          if (e.key === 'Enter') e.target.blur();
        }}
        onMouseDown={stopPropagation}
        onClick={stopPropagation}
      />

      {/* Bottom handle (outgoing) */}
      <Handle type="source" position={Position.Bottom} style={{ background: '#555' }} />
    </div>
  );
});

/* -------------------------
 * 2. Custom Edge Component
 * -------------------------
 * - Editable label in a <foreignObject>.
 * - Right-click to toggle direction (optional).
 */
const TextEdge = memo(({ id, sourceX, sourceY, targetX, targetY, data, markerEnd, selected }) => {
  const { updateEdgeData, setEdges, getNode } = useReactFlow();

  // local state so we can type without losing focus
  const [localLabel, setLocalLabel] = useState(data?.label || '');

  // calculate a bezier path for the arrow
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
  });

  // commit label changes on blur / enter
  const commitChange = () => {
    updateEdgeData(id, { label: localLabel });
  };

  // prevent edge dragging while typing
  const stopPropagation = (e) => e.stopPropagation();

  // (Optional) toggle direction on right-click
  const handleContextMenu = (e) => {
    e.preventDefault(); // default browser context menu
    // Flip the edge: source -> target becomes target -> source
    setEdges((eds) =>
      eds.map((edge) => {
        if (edge.id === id) {
          return {
            ...edge,
            source: edge.target,
            target: edge.source,
          };
        }
        return edge;
      })
    );
  };

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
        onContextMenu={handleContextMenu} // right-click => flip direction
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
          onContextMenu={stopPropagation}
        >
          <input
            style={{ width: '90px' }}
            value={localLabel}
            onChange={(e) => setLocalLabel(e.target.value)}
            onBlur={commitChange}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.target.blur();
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
 */
const initialNodes = [
  { id: '1', type: 'textNode', position: { x: 150, y: 50 }, data: { text: '' } },
  { id: '2', type: 'textNode', position: { x: 150, y: 250 }, data: { text: '' } },
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
  const [essay, setEssay] = useState('');
  const nodeCountRef = useRef(2);
  const { getNode } = useReactFlow();

  // Add node button
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
  // const exportToJson = useCallback(() => {
  //   const flowchartData = { nodes, edges };
  //   const json = JSON.stringify(flowchartData, null, 2);
  //   const blob = new Blob([json], { type: 'application/json' });
  //   const link = document.createElement('a');
  //   link.href = URL.createObjectURL(blob);
  //   link.download = 'flowchart.json';
  //   link.click();
  // }, [nodes, edges]);

  const generateEssay = useCallback(async () => {
    const flowchartData = { nodes, edges };
    const flowchartJson = JSON.stringify(flowchartData, null, 2);
    const prompt = `
  Here's a JSON flowchart for an essay. Each node contains a point, and the edges show the logical connections between them. Write the essay in full prose form without referring to the flowchart or describing the nodes or connections.

  ${flowchartJson}

  `;
  
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.REACT_APP_OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500,
      }),
    });
  
    if (!response.ok) {
      const errorData = await response.json();
      console.error('API Error:', errorData);
      throw new Error(errorData.error || `API request failed with status ${response.status}`);
    }
  
    const result = await response.json();
    const essayText = result.choices[0]?.message.content;
  
    if (!essayText) {
      throw new Error('Unexpected response format');
    }
  
    setEssay(essayText);
  }, [nodes, edges]);

  /**
   * 5. Auto-Generate Arrow Direction Based on Node Positions
   *
   * When the user draws a new edge, we compare the y-coordinates
   * of the two connected nodes. If the "target" node is higher
   * (y < y), we flip the source & target so that arrows always
   * flow top -> bottom. (You can adjust logic for left->right, etc.)
   */
  const onConnect = useCallback(
    (connection) => {
      // check node positions
      const sourceNode = getNode(connection.source);
      const targetNode = getNode(connection.target);

      let finalSource = connection.source;
      let finalTarget = connection.target;

      if (sourceNode && targetNode) {
        // if we want arrows from top to bottom:
        // whichever node has the smaller y is the source
        if (sourceNode.position.y > targetNode.position.y) {
          // swap them
          finalSource = connection.target;
          finalTarget = connection.source;
        }
      }

      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            source: finalSource,
            target: finalTarget,
            type: 'textEdge',
            markerEnd: { type: MarkerType.ArrowClosed },
            data: { label: '' },
          },
          eds
        )
      );
    },
    [getNode, setEdges]
  );

  // Register custom node/edge
  const nodeTypes = { textNode: TextNode };
  const edgeTypes = { textEdge: TextEdge };

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <div style={{ flex: 1 }}>
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
        {/* <button
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
        </button> */}
        <button
          onClick={generateEssay}
          style={{
            position: 'absolute',
            zIndex: 10,
            left: 210,
            top: 10,
            padding: '8px 16px',
          }}
        >
          Generate Essay
        </button>

        <ReactFlow
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          fitView
        >
          <Background variant="dots" gap={12} size={1} />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </div>
      <div style={{ width: '300px', padding: '10px', borderLeft: '1px solid #ccc' }}>
        <h3>Generated Essay</h3>
        <textarea
          style={{ width: '100%', height: '100%', resize: 'none' }}
          value={essay}
          readOnly
        />
      </div>
    </div>
  );
}

// Wrap in the provider
export default function App() {
  return (
    <ReactFlowProvider>
      <FlowchartEditor />
    </ReactFlowProvider>
  );
}
