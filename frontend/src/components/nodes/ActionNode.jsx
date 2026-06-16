import { memo } from 'react'
import { Handle, Position } from 'reactflow'
import { Zap } from 'lucide-react'

function ActionNode({ data }) {
  return (
    <div className="bg-white border-2 border-blue-500 rounded-lg shadow-lg min-w-[160px]">
      <div className="bg-blue-500 text-white px-3 py-1.5 rounded-t-md flex items-center space-x-2">
        <Zap className="h-4 w-4" />
        <span className="text-xs font-semibold uppercase">Action</span>
      </div>
      <div className="p-3">
        <p className="text-sm font-medium text-gray-900">{data.label}</p>
        {data.score && (
          <div className="mt-1 flex items-center space-x-1">
            <span className="text-xs text-gray-500">Score:</span>
            <span className="text-xs font-medium text-blue-600">{data.score}</span>
          </div>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-blue-500 border-2 border-white"
      />
    </div>
  )
}

export default memo(ActionNode)
