import { memo } from 'react'
import { Handle, Position } from 'reactflow'
import { MousePointerClick } from 'lucide-react'

function InteractionNode({ data }) {
  return (
    <div className="bg-white border-2 border-emerald-500 rounded-lg shadow-lg min-w-[150px]">
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-emerald-500 border-2 border-white"
      />
      <div className="bg-emerald-500 text-white px-3 py-1.5 rounded-t-md flex items-center space-x-2">
        <MousePointerClick className="h-4 w-4" />
        <span className="text-xs font-semibold uppercase">Interaction</span>
      </div>
      <div className="p-3">
        <p className="text-sm font-medium text-gray-900">{data.label}</p>
      </div>
    </div>
  )
}

export default memo(InteractionNode)
