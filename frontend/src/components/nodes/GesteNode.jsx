import { memo } from 'react'
import { Handle, Position } from 'reactflow'
import { Hand } from 'lucide-react'

function GesteNode({ data }) {
  return (
    <div className="bg-white border-2 border-purple-500 rounded-lg shadow-lg min-w-[140px]">
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-purple-500 border-2 border-white"
      />
      <div className="bg-purple-500 text-white px-3 py-1.5 rounded-t-md flex items-center space-x-2">
        <Hand className="h-4 w-4" />
        <span className="text-xs font-semibold uppercase">Geste</span>
      </div>
      <div className="p-3">
        <p className="text-sm font-medium text-gray-900">{data.label}</p>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-purple-500 border-2 border-white"
      />
    </div>
  )
}

export default memo(GesteNode)
