import { memo } from 'react'
import { Handle, Position } from 'reactflow'

function EntityNode({ data }) {
  const selectedClass = data.isSelected
    ? 'border-[#f0b79d] ring-2 ring-[#f0b79d]/60 shadow-[0_0_0_2px_rgba(240,183,157,0.22)]'
    : 'border-[#6f6f6f]'

  const roleStyle = data.tableRoleStyle || {
    label: 'Support',
    chipClass: 'bg-zinc-500/20 text-zinc-100 border-zinc-300/40',
    borderColor: '#6f6f6f',
  }

  const visibleColumns = (data.columns || []).slice(0, 9)
  const hiddenColumnsCount = Math.max((data.columns || []).length - visibleColumns.length, 0)
  const hiddenHandleClass = '!h-2.5 !w-2.5 !border !border-[#222] !bg-[#f0b79d] !opacity-0'

  return (
    <div
      className={`min-w-[270px] max-w-[320px] rounded-md border bg-[#1d1d1d] text-[#f1f1f1] shadow-xl ${selectedClass}`}
      style={!data.isSelected ? { borderColor: roleStyle.borderColor } : undefined}
    >
      <div className="border-b border-[#5b5b5b] bg-[#2d2d2d] px-3 py-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-[#f0b79d]">Entite</p>
            <p className="text-sm font-semibold leading-tight">{data.name}</p>
            {data.tableName && data.tableName !== data.name && (
              <p className="mt-0.5 text-[10px] text-[#a9a9a9] font-mono">{data.tableName}</p>
            )}
            {data.description && (
              <p className="mt-1 max-w-[220px] text-[11px] text-[#cfcfcf] line-clamp-2">{data.description}</p>
            )}
          </div>
          <span className={`shrink-0 rounded border px-2 py-0.5 text-[10px] font-medium ${roleStyle.chipClass}`}>
            {roleStyle.label}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] text-[#d8d8d8]">
          <span className="rounded bg-[#3b3b3b] px-1.5 py-0.5">{(data.columns || []).length} colonnes</span>
          {data.isCoreForScenario && <span className="rounded bg-[#5c3e2f] px-1.5 py-0.5 text-[#ffd7c1]">Necessaire scenario</span>}
        </div>
      </div>

      <div className="px-3 py-2 text-xs space-y-1">
        {visibleColumns.map((col) => {
          const tags = []
          if (col.primary_key) tags.push('PK')
          if (data.foreignKeyColumns?.includes(col.name)) tags.push('FK')

          return (
            <div key={`${data.name}-${col.name}`} className="flex items-center justify-between gap-2 border-b border-[#343434] pb-1">
              <div className="min-w-0">
                <span className="font-mono text-[#f5f5f5]">{col.name}</span>
                {tags.length > 0 && (
                  <span className="ml-2 rounded bg-[#3b3b3b] px-1.5 py-0.5 text-[10px] text-[#d8d8d8]">
                    {tags.join('/')}
                  </span>
                )}
              </div>
              <span className="text-[#bdbdbd]">{col.type}</span>
            </div>
          )
        })}
        {hiddenColumnsCount > 0 && (
          <div className="pt-0.5 text-[11px] text-[#a9a9a9]">+ {hiddenColumnsCount} colonne(s) supplementaire(s)</div>
        )}
      </div>

      <Handle id="target-left" type="target" position={Position.Left} className={hiddenHandleClass} />
      <Handle id="target-right" type="target" position={Position.Right} className={hiddenHandleClass} />
      <Handle id="target-top" type="target" position={Position.Top} className={hiddenHandleClass} />
      <Handle id="target-bottom" type="target" position={Position.Bottom} className={hiddenHandleClass} />

      <Handle id="source-left" type="source" position={Position.Left} className={hiddenHandleClass} />
      <Handle id="source-right" type="source" position={Position.Right} className={hiddenHandleClass} />
      <Handle id="source-top" type="source" position={Position.Top} className={hiddenHandleClass} />
      <Handle id="source-bottom" type="source" position={Position.Bottom} className={hiddenHandleClass} />
    </div>
  )
}

export default memo(EntityNode)
