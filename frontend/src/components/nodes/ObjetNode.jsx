import { memo } from 'react'
import { Handle, Position } from 'reactflow'
import { Wrench, Box, Cable } from 'lucide-react'

function ObjetNode({ data }) {
  const getIcon = () => {
    switch (data.typeObjet) {
      case 'outil':
        return <Wrench className="h-4 w-4" />
      case 'accessoire':
        return <Cable className="h-4 w-4" />
      default:
        return <Box className="h-4 w-4" />
    }
  }

  return (
    <div className="bg-white border-2 border-amber-500 rounded-lg shadow-lg min-w-[140px]">
      <div className="bg-amber-500 text-white px-3 py-1.5 rounded-t-md flex items-center space-x-2">
        {getIcon()}
        <span className="text-xs font-semibold uppercase">Objet</span>
      </div>
      <div className="p-3">
        <p className="text-sm font-medium text-gray-900">{data.label}</p>
        {data.typeObjet && (
          <span className="inline-block mt-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full">
            {data.typeObjet}
          </span>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-amber-500 border-2 border-white"
      />
    </div>
  )
}

export default memo(ObjetNode)
