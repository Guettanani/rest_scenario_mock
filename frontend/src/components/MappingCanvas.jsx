import { useCallback, useEffect, useMemo } from 'react'
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  MarkerType,
} from 'reactflow'
import 'reactflow/dist/style.css'

import ActionNode from './nodes/ActionNode'
import GesteNode from './nodes/GesteNode'
import ObjetNode from './nodes/ObjetNode'
import InteractionNode from './nodes/InteractionNode'

const nodeTypes = {
  action: ActionNode,
  geste: GesteNode,
  objet: ObjetNode,
  interaction: InteractionNode,
}

const DEFAULT_EDGE_OPTIONS = {
  animated: true,
  markerEnd: {
    type: MarkerType.ArrowClosed,
    color: '#6b7280',
  },
  style: {
    stroke: '#6b7280',
    strokeWidth: 2,
  },
}

function MappingCanvas({ initialNodes, initialEdges }) {
  // Convertir les nœuds initiaux en format ReactFlow avec positions
  const formattedNodes = useMemo(() => {
    if (!initialNodes || initialNodes.length === 0) return []
    
    const actionNodes = initialNodes.filter(n => n.type === 'action')
    const gesteNodes = initialNodes.filter(n => n.type === 'geste')
    const objetNodes = initialNodes.filter(n => n.type === 'objet')
    const interactionNodes = initialNodes.filter(n => n.type === 'interaction')

    const positionedNodes = []

    // Actions (colonne 1)
    actionNodes.forEach((node, index) => {
      positionedNodes.push({
        ...node,
        position: { x: 50, y: 50 + index * 120 },
      })
    })

    // Gestes (colonne 2)
    gesteNodes.forEach((node, index) => {
      positionedNodes.push({
        ...node,
        position: { x: 300, y: 50 + index * 100 },
      })
    })

    // Objets (colonne 3)
    objetNodes.forEach((node, index) => {
      positionedNodes.push({
        ...node,
        position: { x: 550, y: 50 + index * 100 },
      })
    })

    // Interactions (colonne 4)
    interactionNodes.forEach((node, index) => {
      positionedNodes.push({
        ...node,
        position: { x: 800, y: 50 + index * 100 },
      })
    })

    return positionedNodes
  }, [initialNodes])

  const [nodes, setNodes, onNodesChange] = useNodesState(formattedNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges || [])

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge({ ...params, ...DEFAULT_EDGE_OPTIONS }, eds)),
    [setEdges]
  )

  // Mettre à jour les nœuds quand initialNodes change
  useEffect(() => {
    if (formattedNodes.length > 0 && nodes.length === 0) {
      setNodes(formattedNodes)
    }
  }, [formattedNodes, nodes.length, setNodes])

  useEffect(() => {
    if (initialEdges && initialEdges.length > 0 && edges.length === 0) {
      setEdges(initialEdges.map(edge => ({ ...edge, ...DEFAULT_EDGE_OPTIONS })))
    }
  }, [initialEdges, edges.length, setEdges])

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={DEFAULT_EDGE_OPTIONS}
        fitView
        attributionPosition="bottom-left"
        className="bg-gray-50"
      >
        <Background color="#e5e7eb" gap={20} />
        <Controls className="bg-white shadow-lg rounded-lg" />
        <MiniMap
          nodeColor={(node) => {
            switch (node.type) {
              case 'action':
                return '#3b82f6'
              case 'geste':
                return '#8b5cf6'
              case 'objet':
                return '#f59e0b'
              case 'interaction':
                return '#10b981'
              default:
                return '#6b7280'
            }
          }}
          maskColor="rgba(0, 0, 0, 0.1)"
          className="bg-white shadow-lg rounded-lg"
        />
      </ReactFlow>
    </div>
  )
}

export default MappingCanvas
