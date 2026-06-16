import { useCallback, useEffect, useMemo, useRef } from 'react'
import ReactFlow, { Background, Controls, MarkerType, Panel, useNodesState } from 'reactflow'
import 'reactflow/dist/style.css'

import EntityNode from './nodes/EntityNode'

const nodeTypes = {
  entity: EntityNode,
}

const TABLE_ROLE_STYLES = {
  core: {
    label: 'Controle scenario',
    dotColor: '#fcd34d',
    chipClass: 'bg-amber-500/20 text-amber-100 border-amber-300/40',
    borderColor: '#f0b79d',
  },
  support: {
    label: 'Contexte technique',
    dotColor: '#d4d4d8',
    chipClass: 'bg-zinc-500/20 text-zinc-100 border-zinc-300/40',
    borderColor: '#d1d5db',
  },
}

const CORE_SCENARIO_TABLES = new Set([
  'fichier',
  'procedure',
  'etape',
  'etapes',
  'parametre',
  'composant3d',
  'scene',
  'resultatetape',
])

const EDGE_BASE_STYLE = {
  stroke: '#d8d8d8',
  strokeWidth: 1.6,
}

const FORBIDDEN_RELATION_PAIRS = new Set([])

function normalizeTableName(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

function toSingularCanonical(name) {
  const normalized = normalizeTableName(name)
  if (normalized.endsWith('ies')) return `${normalized.slice(0, -3)}y`
  if (normalized.endsWith('s')) return normalized.slice(0, -1)
  return normalized
}

function getTableRole(tableName) {
  const name = toSingularCanonical(tableName)

  if (CORE_SCENARIO_TABLES.has(name)) return 'core'
  return 'support'
}

function getRolePriority(tableName) {
  const role = getTableRole(tableName)
  if (role === 'core') return 0
  return 1
}

function cardinalityLabel(relationship) {
  const type = (relationship?.relationship || '').toLowerCase()
  if (type === 'many-to-one') return 'n:1'
  if (type === 'one-to-many') return '1:n'
  if (type === 'one-to-one') return '1:1'
  return type || 'rel'
}

function getEdgeStyle(source, target) {
  const sourceRole = getTableRole(source)
  const targetRole = getTableRole(target)
  const touchesCore = sourceRole === 'core' || targetRole === 'core'

  if (touchesCore) {
    return {
      edgeStyle: {
        stroke: '#f0b79d',
        strokeWidth: 2.1,
      },
      markerColor: '#f0b79d',
      labelStyle: { fill: '#ffe4d6', fontSize: 10 },
      labelBgStyle: { fill: '#3a2c26', fillOpacity: 0.95 },
    }
  }

  return {
    edgeStyle: EDGE_BASE_STYLE,
    markerColor: '#d8d8d8',
    labelStyle: { fill: '#e6e6e6', fontSize: 10 },
    labelBgStyle: { fill: '#2b2b2b', fillOpacity: 0.9 },
  }
}

function normalizeRelationshipDirection(rel) {
  // Backend relation = FK_table(from) -> PK_table(to).
  // For UX flow, render PK(out) -> FK(in) so arrows exit parent and enter child.
  return {
    sourceTable: rel.to_table,
    targetTable: rel.from_table,
    sourceColumn: rel.to_column,
    targetColumn: rel.from_column,
    relationship: rel.relationship,
  }
}

function canonicalPairKey(a, b) {
  const left = toSingularCanonical(a)
  const right = toSingularCanonical(b)
  return [left, right].sort().join('|')
}

function isForbiddenRelationship(sourceTable, targetTable) {
  return FORBIDDEN_RELATION_PAIRS.has(canonicalPairKey(sourceTable, targetTable))
}

function getDisplayRelationships(relationships) {
  return (relationships || []).filter((rel) => {
    const normalized = normalizeRelationshipDirection(rel)
    return !isForbiddenRelationship(normalized.sourceTable, normalized.targetTable)
  })
}

function buildGlobalOrderMap(levelBuckets, sortedLevels) {
  const map = new Map()
  let rank = 0
  for (const level of sortedLevels) {
    for (const name of levelBuckets[level] || []) {
      map.set(name, rank++)
    }
  }
  return map
}

function getBarycenter(neighbors, orderMap, predicate) {
  const ranks = (neighbors || [])
    .filter(predicate)
    .map((name) => orderMap.get(name))
    .filter((value) => typeof value === 'number')

  if (ranks.length === 0) return null
  return ranks.reduce((sum, value) => sum + value, 0) / ranks.length
}

function sortBucketByBarycenter(bucket, getNeighbors, orderMap, predicate) {
  const previousOrder = new Map(bucket.map((name, index) => [name, index]))
  return [...bucket].sort((a, b) => {
    const scoreA = getBarycenter(getNeighbors(a), orderMap, predicate)
    const scoreB = getBarycenter(getNeighbors(b), orderMap, predicate)

    if (scoreA === null && scoreB === null) {
      return (previousOrder.get(a) || 0) - (previousOrder.get(b) || 0)
    }
    if (scoreA === null) return 1
    if (scoreB === null) return -1
    if (scoreA !== scoreB) return scoreA - scoreB
    return (previousOrder.get(a) || 0) - (previousOrder.get(b) || 0)
  })
}

function buildLayout(tables, relationships) {
  const xGap = 380
  const yGap = 240
  const nodesByName = new Map((tables || []).map((t) => [t.name, t]))

  if (!tables || tables.length === 0) return []

  const incomingCount = {}
  const outgoing = {}
  const incoming = {}
  for (const table of tables) {
    incomingCount[table.name] = 0
    outgoing[table.name] = []
    incoming[table.name] = []
  }

  for (const rel of getDisplayRelationships(relationships)) {
    const normalized = normalizeRelationshipDirection(rel)
    if (!nodesByName.has(normalized.sourceTable) || !nodesByName.has(normalized.targetTable)) continue
    outgoing[normalized.sourceTable].push(normalized.targetTable)
    incoming[normalized.targetTable].push(normalized.sourceTable)
    incomingCount[normalized.targetTable] += 1
  }

  const roots = tables
    .filter((t) => incomingCount[t.name] === 0)
    .map((t) => t.name)

  if (roots.length === 0) {
    const fallbackCore = tables.find((table) => getTableRole(table.name) === 'core')
    roots.push(fallbackCore?.name || tables[0].name)
  }

  const levelByName = {}
  const queue = [...roots]
  for (const root of roots) levelByName[root] = 0

  while (queue.length > 0) {
    const current = queue.shift()
    const currentLevel = levelByName[current] ?? 0
    for (const next of outgoing[current] || []) {
      const candidateLevel = currentLevel + 1
      if (levelByName[next] === undefined || candidateLevel > levelByName[next]) {
        levelByName[next] = candidateLevel
        queue.push(next)
      }
    }
  }

  const maxLevel = Math.max(...Object.values(levelByName), 0)
  for (const table of tables) {
    if (levelByName[table.name] === undefined) {
      levelByName[table.name] = maxLevel + 1
    }
  }

  const levelBuckets = {}
  for (const table of tables) {
    const level = levelByName[table.name]
    if (!levelBuckets[level]) levelBuckets[level] = []
    levelBuckets[level].push(table.name)
  }

  const sortedLevels = Object.keys(levelBuckets)
    .map((key) => Number(key))
    .sort((a, b) => a - b)

  for (const level of sortedLevels) {
    levelBuckets[level] = (levelBuckets[level] || []).sort((a, b) => {
      const roleDelta = getRolePriority(a) - getRolePriority(b)
      if (roleDelta !== 0) return roleDelta

      const outgoingDelta = (outgoing[b] || []).length - (outgoing[a] || []).length
      if (outgoingDelta !== 0) return outgoingDelta

      return a.localeCompare(b)
    })
  }

  // Reduce crossings with layered barycenter sweeps.
  for (let iteration = 0; iteration < 4; iteration += 1) {
    let globalOrder = buildGlobalOrderMap(levelBuckets, sortedLevels)
    for (const level of sortedLevels.slice(1)) {
      levelBuckets[level] = sortBucketByBarycenter(
        levelBuckets[level] || [],
        (name) => incoming[name],
        globalOrder,
        (neighbor) => (levelByName[neighbor] ?? -1) < level,
      )
    }

    globalOrder = buildGlobalOrderMap(levelBuckets, sortedLevels)
    for (const level of [...sortedLevels].reverse().slice(1)) {
      levelBuckets[level] = sortBucketByBarycenter(
        levelBuckets[level] || [],
        (name) => outgoing[name],
        globalOrder,
        (neighbor) => (levelByName[neighbor] ?? Number.MAX_SAFE_INTEGER) > level,
      )
    }
  }

  const nodes = []
  for (const level of sortedLevels) {
    const bucket = levelBuckets[level] || []
    bucket.forEach((tableName, index) => {
      const table = nodesByName.get(tableName)
      if (!table) return

      nodes.push({
        id: table.name,
        type: 'entity',
        position: {
          x: 40 + level * xGap,
          y: 40 + index * yGap,
        },
        data: {
          name: table.display_name || table.name,
          tableName: table.name,
          description: table.description || '',
          columns: table.columns || [],
          foreignKeyColumns: (table.foreign_keys || []).map((fk) => fk.column),
          tableRole: getTableRole(table.name),
          tableRoleStyle: TABLE_ROLE_STYLES[getTableRole(table.name)] || TABLE_ROLE_STYLES.support,
          isCoreForScenario: CORE_SCENARIO_TABLES.has(toSingularCanonical(table.name)),
        },
      })
    })
  }

  return nodes
}

function buildLayoutStorageKey(tables, relationships) {
  const signature = (tables || [])
    .map((table) => table.name)
    .sort()
    .join('|')

  const relationSignature = getDisplayRelationships(relationships)
    .map((rel) => {
      const normalized = normalizeRelationshipDirection(rel)
      return `${normalized.sourceTable}->${normalized.targetTable}:${normalized.sourceColumn}->${normalized.targetColumn}`
    })
    .sort()
    .join('|')

  return `db-model-layout:v3:${signature}::${relationSignature}`
}

function restoreNodePositions(nodes, storageKey) {
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return nodes
    const saved = JSON.parse(raw)
    if (!saved || typeof saved !== 'object') return nodes

    return nodes.map((node) => {
      const pos = saved[node.id]
      if (!pos || typeof pos.x !== 'number' || typeof pos.y !== 'number') return node
      return { ...node, position: { x: pos.x, y: pos.y } }
    })
  } catch {
    return nodes
  }
}

function persistNodePositions(nodes, storageKey) {
  try {
    const payload = {}
    for (const node of nodes || []) {
      payload[node.id] = node.position
    }
    window.localStorage.setItem(storageKey, JSON.stringify(payload))
  } catch {
    // Ignore localStorage errors silently to keep rendering resilient.
  }
}

function resolveEdgeHandles(sourcePosition, targetPosition) {
  const dx = (targetPosition?.x || 0) - (sourcePosition?.x || 0)
  const dy = (targetPosition?.y || 0) - (sourcePosition?.y || 0)

  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? { sourceHandle: 'source-right', targetHandle: 'target-left' }
      : { sourceHandle: 'source-left', targetHandle: 'target-right' }
  }

  return dy >= 0
    ? { sourceHandle: 'source-bottom', targetHandle: 'target-top' }
    : { sourceHandle: 'source-top', targetHandle: 'target-bottom' }
}

function buildEdges(relationships, tables, nodes) {
  const tableNames = new Set((tables || []).map((table) => table.name))
  const positions = new Map((nodes || []).map((node) => [node.id, node.position || { x: 0, y: 0 }]))
  const edges = []

  for (const [index, rel] of getDisplayRelationships(relationships).entries()) {
    const normalized = normalizeRelationshipDirection(rel)
    const source = normalized.sourceTable
    const target = normalized.targetTable

    if (!tableNames.has(source) || !tableNames.has(target)) continue
    if (source === target) continue

    const sourcePosition = positions.get(source)
    const targetPosition = positions.get(target)
    const handles = resolveEdgeHandles(sourcePosition, targetPosition)
    const visual = getEdgeStyle(source, target)

    edges.push({
      id: `rel-${index}-${source}-${target}`,
      source,
      target,
      sourceHandle: handles.sourceHandle,
      targetHandle: handles.targetHandle,
      type: 'smoothstep',
      pathOptions: {
        borderRadius: 14,
        offset: 26,
      },
      label: `${normalized.sourceColumn} vers ${normalized.targetColumn} (${cardinalityLabel(normalized)})`,
      labelStyle: visual.labelStyle,
      labelBgStyle: visual.labelBgStyle,
      labelBgPadding: [5, 3],
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: visual.markerColor,
      },
      style: visual.edgeStyle,
      animated: false,
    })
  }

  return edges
}

function DatabaseModelCanvas({ tables, relationships, isLayoutLocked = false, selectedTableName = '', onSelectTable }) {
  const flowInstanceRef = useRef(null)

  const layoutStorageKey = useMemo(
    () => buildLayoutStorageKey(tables || [], relationships || []),
    [tables, relationships],
  )

  const defaultFitViewOptions = useMemo(
    () => ({ padding: 0.42, maxZoom: 0.72, minZoom: 0.18, duration: 350 }),
    [],
  )

  const initialNodes = useMemo(() => {
    const computed = buildLayout(tables || [], relationships || [])
    return restoreNodePositions(computed, layoutStorageKey)
  }, [tables, relationships, layoutStorageKey])

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const edges = useMemo(() => buildEdges(relationships || [], tables || [], nodes || []), [relationships, tables, nodes])

  const renderedNodes = useMemo(() => {
    return (nodes || []).map((node) => ({
      ...node,
      data: {
        ...node.data,
        isSelected: node.id === selectedTableName,
      },
    }))
  }, [nodes, selectedTableName])

  useEffect(() => {
    setNodes(initialNodes)
  }, [initialNodes, setNodes])

  useEffect(() => {
    if (!nodes || nodes.length === 0) return
    persistNodePositions(nodes, layoutStorageKey)
  }, [nodes, layoutStorageKey])

  useEffect(() => {
    if (!flowInstanceRef.current || !nodes || nodes.length === 0) return

    const timer = window.setTimeout(() => {
      flowInstanceRef.current?.fitView(defaultFitViewOptions)
    }, 80)

    return () => window.clearTimeout(timer)
  }, [layoutStorageKey, nodes, defaultFitViewOptions])

  const resetLayout = useCallback(() => {
    const computed = buildLayout(tables || [], relationships || [])
    try {
      window.localStorage.removeItem(layoutStorageKey)
    } catch {
      // no-op
    }
    setNodes(computed)

    window.setTimeout(() => {
      flowInstanceRef.current?.fitView(defaultFitViewOptions)
    }, 120)
  }, [defaultFitViewOptions, layoutStorageKey, relationships, setNodes, tables])

  return (
    <div className="h-full w-full rounded-lg border border-[#2f2f2f] bg-[#161616]">
      <ReactFlow
        onInit={(instance) => {
          flowInstanceRef.current = instance
          instance.fitView(defaultFitViewOptions)
        }}
        nodes={renderedNodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onNodeClick={(_, node) => onSelectTable?.(node.id)}
        nodesDraggable={!isLayoutLocked}
        nodesConnectable={false}
        elementsSelectable
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={defaultFitViewOptions}
        proOptions={{ hideAttribution: true }}
        className="!bg-[#161616]"
      >
        <Background color="#2e2e2e" gap={20} size={1} />
        <Controls className="!bg-[#252525] !border-[#3a3a3a]" />
        <Panel position="top-left" className="!m-2 !space-y-2 !rounded !border !border-[#3a3a3a] !bg-[#202020] !px-3 !py-2 text-xs text-[#e8e8e8]">
          <p className="font-semibold text-[#f6f6f6]">Lecture du schema</p>
          <div className="space-y-1 text-[11px]">
            {[
              { key: 'core', detail: 'donnees a controler pour generer le scenario' },
              { key: 'support', detail: 'contexte technique relie au scenario' },
            ].map((item) => {
              const style = TABLE_ROLE_STYLES[item.key]
              return (
                <div key={item.key} className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: style.dotColor }} />
                  <span>{style.label}: {item.detail}</span>
                </div>
              )
            })}
            <div className="text-[#bdbdbd]">Fleche: table parente vers table enfant (PK vers FK)</div>
          </div>
        </Panel>
        <Panel position="top-right" className="!m-2 !rounded !border !border-[#3a3a3a] !bg-[#202020] !px-2 !py-1 text-xs text-[#e8e8e8]">
          <button type="button" onClick={resetLayout} disabled={isLayoutLocked} className="hover:text-white disabled:opacity-40">
            Reinitialiser la disposition
          </button>
        </Panel>
      </ReactFlow>
    </div>
  )
}

export default DatabaseModelCanvas
