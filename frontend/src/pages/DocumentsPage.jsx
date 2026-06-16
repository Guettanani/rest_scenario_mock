import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  CheckCircle,
  FileText,
  Flag,
  ListChecks,
  Loader2,
  Plus,
  Save,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import DropZone from '../components/DropZone'
import { componentCatalogService, dbModelService, fileService } from '../services/dataService'

const FLAGGED_FILES_KEY = 'scenia_flagged_files_v1'

function formatSize(bytes) {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

function formatDate(value) {
  if (!value) return '-'
  try {
    return new Date(value).toLocaleString()
  } catch {
    return '-'
  }
}

function resolveStatusLabel(status) {
  if (!status) return { label: 'Indefini', className: 'border-black/10 bg-white text-black/60' }

  const normalized = String(status).toLowerCase()
  if (normalized === 'processed') {
    return { label: 'Traite', className: 'border-green-200 bg-green-50 text-green-700' }
  }
  if (normalized === 'processing') {
    return { label: 'En cours', className: 'border-blue-200 bg-blue-50 text-blue-700' }
  }
  if (normalized === 'pending') {
    return { label: 'En attente', className: 'border-yellow-200 bg-yellow-50 text-yellow-700' }
  }
  if (normalized === 'error') {
    return { label: 'Erreur', className: 'border-red-200 bg-red-50 text-red-700' }
  }
  return { label: status, className: 'border-black/10 bg-white text-black/60' }
}

function buildBlankRow(columns) {
  const row = {}
  for (const column of columns || []) {
    row[column.name] = ''
  }
  return row
}

function normalizeComponentNameKey(value) {
  return String(value || '').trim().toLowerCase()
}

function normalizeReviewStates(value) {
  return Array.isArray(value)
    ? value
    : String(value || '')
      .split(',')
      .map((state) => state.trim())
      .filter(Boolean)
}

function attachCatalogIdsToRows(rows, catalogComponents) {
  const catalogByName = new Map(
    (catalogComponents || []).map((component) => [
      normalizeComponentNameKey(component?.name || component?.nom_composant),
      component,
    ]),
  )

  return (rows || []).map((row) => {
    const catalogComponent = catalogByName.get(normalizeComponentNameKey(row?.nom_composant))
    if (!catalogComponent) {
      return {
        ...row,
        id_composant: null,
      }
    }

    return {
      ...row,
      id_composant: catalogComponent.id,
      etats_possibles: row?.etats_possibles ?? catalogComponent.states ?? [],
    }
  })
}

function buildCatalogReviewRows(catalogComponents) {
  return (catalogComponents || []).map((component) => ({
    id_composant: component.id,
    nom_composant: component.name,
    etats_possibles: component.states || [],
  }))
}

function mergeCatalogAndImportedRows(catalogComponents, importedRows) {
  const rowsByName = new Map()

  buildCatalogReviewRows(catalogComponents).forEach((row) => {
    rowsByName.set(normalizeComponentNameKey(row.nom_composant), row)
  })

  ;(importedRows || []).forEach((row) => {
    const name = String(row?.nom_composant || '').trim()
    if (!name) return

    const key = normalizeComponentNameKey(name)
    const existing = rowsByName.get(key)
    rowsByName.set(key, {
      id_composant: existing?.id_composant ?? row?.id_composant ?? null,
      nom_composant: existing?.nom_composant || name,
      etats_possibles: normalizeReviewStates(row?.etats_possibles).length > 0
        ? normalizeReviewStates(row?.etats_possibles)
        : existing?.etats_possibles || [],
    })
  })

  return Array.from(rowsByName.values()).sort((a, b) =>
    String(a.nom_composant || '').localeCompare(String(b.nom_composant || ''), 'fr', { sensitivity: 'base' }),
  )
}

function buildCatalogPayloadRows(rows) {
  return (rows || [])
    .map((row) => ({
      id: row?.id_composant ?? null,
      name: String(row?.nom_composant ?? '').trim(),
      states: normalizeReviewStates(row?.etats_possibles),
    }))
    .filter((row) => row.name)
}

function DocumentsPage() {
  const [sourceFiles, setSourceFiles] = useState([])
  const [isUploading, setIsUploading] = useState(false)
  const [notice, setNotice] = useState({ type: '', text: '' })
  const [flaggedIds, setFlaggedIds] = useState(new Set())

  const [isDataReviewOpen, setIsDataReviewOpen] = useState(false)
  const [isReviewLoading, setIsReviewLoading] = useState(false)
  const [isReviewSaving, setIsReviewSaving] = useState(false)
  const [dataReviewError, setDataReviewError] = useState('')
  const [selectedReviewTable, setSelectedReviewTable] = useState('')
  const [reviewBaselineRows, setReviewBaselineRows] = useState([])
  const [dataReviewModel, setDataReviewModel] = useState({
    tables: [],
    relationships: [],
    stats: { source_files: 0, tables: 0, relationships: 0 },
  })

  useEffect(() => {
    const stored = localStorage.getItem(FLAGGED_FILES_KEY)
    if (!stored) return

    try {
      const parsed = JSON.parse(stored)
      if (Array.isArray(parsed)) {
        setFlaggedIds(new Set(parsed))
      }
    } catch {
      localStorage.removeItem(FLAGGED_FILES_KEY)
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(FLAGGED_FILES_KEY, JSON.stringify(Array.from(flaggedIds)))
  }, [flaggedIds])

  useEffect(() => {
    let mounted = true

    const loadSources = async () => {
      try {
        const sources = await fileService.getSources()
        if (mounted) {
          setSourceFiles(sources)
        }
      } catch {
        if (mounted) {
          setNotice({ type: 'error', text: 'Impossible de charger les documents existants.' })
        }
      }
    }

    loadSources()
    return () => {
      mounted = false
    }
  }, [])

  const stats = useMemo(() => {
    const total = sourceFiles.length
    const processed = sourceFiles.filter((file) => String(file.statut || '').toLowerCase() === 'processed').length
    const errors = sourceFiles.filter((file) => String(file.statut || '').toLowerCase() === 'error').length
    const flagged = sourceFiles.filter((file) => flaggedIds.has(file.id)).length
    return { total, processed, errors, flagged }
  }, [sourceFiles, flaggedIds])

  const selectedReviewTableData = useMemo(
    () => (dataReviewModel.tables || []).find((table) => table.name === selectedReviewTable) || null,
    [dataReviewModel.tables, selectedReviewTable],
  )

  const reviewRowsDirty = useMemo(() => {
    const currentRows = selectedReviewTableData?.sample_rows || []
    return JSON.stringify(currentRows) !== JSON.stringify(reviewBaselineRows || [])
  }, [selectedReviewTableData, reviewBaselineRows])

  const editableReviewColumns = useMemo(() => {
    const allowedColumns = new Set(['nom_composant', 'etats_possibles'])
    return (selectedReviewTableData?.columns || []).filter((column) =>
      allowedColumns.has(String(column?.name || '').toLowerCase()),
    )
  }, [selectedReviewTableData])

  useEffect(() => {
    if (!isDataReviewOpen) return undefined

    const onEscape = (event) => {
      if (event.key === 'Escape') {
        setIsDataReviewOpen(false)
      }
    }

    window.addEventListener('keydown', onEscape)
    return () => window.removeEventListener('keydown', onEscape)
  }, [isDataReviewOpen])

  const updateDataReviewModel = (mutator) => {
    setDataReviewModel((previous) => {
      const draft = JSON.parse(JSON.stringify(previous || {}))
      mutator(draft)
      return draft
    })
  }

  const openDataReviewModal = async () => {
    if (sourceFiles.length === 0) {
      setNotice({
        type: 'error',
        text: 'Ajoutez au moins un document avant de verifier les donnees importees.',
      })
      return
    }

    setIsDataReviewOpen(true)
    setIsReviewLoading(true)
    setDataReviewError('')

    try {
      const sourceIds = sourceFiles.map((file) => file.id)
      const model = await dbModelService.generateDatabaseModel(sourceIds, [])
      const tables = Array.isArray(model?.tables) ? model.tables : []
      const composantTables = tables.filter(
        (table) => String(table?.name || '').toLowerCase() === 'composant3d',
      )
      const catalog = await componentCatalogService.getAvailable()
      const catalogComponents = Array.isArray(catalog?.components) ? catalog.components : []
      const nextComposantTables = composantTables.map((table) => ({
        ...table,
        sample_rows: mergeCatalogAndImportedRows(
          catalogComponents,
          attachCatalogIdsToRows(table.sample_rows || [], catalogComponents),
        ),
      }))

      if (nextComposantTables.length === 0) {
        setDataReviewError('La table Composant3D est introuvable dans les donnees importees.')
      }

      const nextSelectedTable = nextComposantTables[0]?.name || ''
      const selectedRows = nextComposantTables[0]?.sample_rows || []
      const syncedCatalog = selectedRows.length > 0
        ? await componentCatalogService.saveCatalog({
          rows: buildCatalogPayloadRows(selectedRows),
          deletedIds: [],
        })
        : null
      const syncedRows = syncedCatalog
        ? buildCatalogReviewRows(syncedCatalog.components || [])
        : selectedRows
      const syncedComposantTables = nextComposantTables.map((table, index) => (
        index === 0
          ? {
            ...table,
            sample_rows: syncedRows,
            estimated_rows: syncedRows.length,
          }
          : table
      ))

      setDataReviewModel({
        tables: syncedComposantTables,
        relationships: model?.relationships || [],
        sql_ddl: model?.sql_ddl || '',
        stats: model?.stats || { source_files: sourceIds.length, tables: syncedComposantTables.length, relationships: 0 },
      })
      setSelectedReviewTable(nextSelectedTable)
      setReviewBaselineRows(JSON.parse(JSON.stringify(syncedComposantTables[0]?.sample_rows || [])))
      if (syncedCatalog) {
        window.dispatchEvent(new CustomEvent('scenia:component-catalog-updated'))
      }
    } catch (error) {
      const detail =
        error?.response?.data?.detail ||
        error?.response?.data?.message ||
        error?.message ||
        'Impossible de verifier les donnees importees.'
      setDataReviewError(detail)
    } finally {
      setIsReviewLoading(false)
    }
  }

  const handleSaveDataReview = async () => {
    if (!selectedReviewTableData || isReviewSaving) return

    const currentRows = Array.isArray(selectedReviewTableData.sample_rows) ? selectedReviewTableData.sample_rows : []
    const baselineIds = new Set((reviewBaselineRows || []).map((row) => row?.id_composant).filter((value) => value != null))
    const currentIds = new Set(currentRows.map((row) => row?.id_composant).filter((value) => value != null))
    const deletedIds = Array.from(baselineIds).filter((id) => !currentIds.has(id))

    setIsReviewSaving(true)
    setDataReviewError('')

    try {
      const payloadRows = buildCatalogPayloadRows(currentRows)

      const savedCatalog = await componentCatalogService.saveCatalog({ rows: payloadRows, deletedIds })
      const refreshedRows = buildCatalogReviewRows(savedCatalog.components || [])
      const refreshedSelectedTable = {
        ...selectedReviewTableData,
        sample_rows: refreshedRows,
        estimated_rows: refreshedRows.length,
      }

      setDataReviewModel((previous) => ({
        ...(previous || {}),
        tables: [refreshedSelectedTable],
        stats: {
          ...(previous?.stats || {}),
          tables: 1,
        },
      }))
      setSelectedReviewTable(refreshedSelectedTable?.name || '')
      setReviewBaselineRows(JSON.parse(JSON.stringify(refreshedSelectedTable?.sample_rows || [])))
      window.dispatchEvent(new CustomEvent('scenia:component-catalog-updated'))
      setNotice({ type: 'success', text: 'Catalogue Composant3D mis a jour.' })
    } catch (error) {
      const detail = error?.response?.data?.detail || error?.message || 'Impossible d enregistrer les modifications.'
      setDataReviewError(detail)
    } finally {
      setIsReviewSaving(false)
    }
  }

  const handleReviewCellChange = (rowIndex, columnName, value) => {
    if (!selectedReviewTable) return

    updateDataReviewModel((draft) => {
      const table = (draft.tables || []).find((item) => item.name === selectedReviewTable)
      if (!table) return

      table.sample_rows = table.sample_rows || []
      while (table.sample_rows.length <= rowIndex) {
        table.sample_rows.push(buildBlankRow(table.columns || []))
      }

      table.sample_rows[rowIndex] = {
        ...(table.sample_rows[rowIndex] || {}),
        [columnName]: value,
      }
    })
  }

  const addReviewRow = () => {
    if (!selectedReviewTable) return

    updateDataReviewModel((draft) => {
      const table = (draft.tables || []).find((item) => item.name === selectedReviewTable)
      if (!table) return
      table.sample_rows = table.sample_rows || []
      table.sample_rows.push(buildBlankRow(table.columns || []))
    })
  }

  const deleteReviewRow = (rowIndex) => {
    if (!selectedReviewTable) return

    updateDataReviewModel((draft) => {
      const table = (draft.tables || []).find((item) => item.name === selectedReviewTable)
      if (!table || !Array.isArray(table.sample_rows)) return
      table.sample_rows = table.sample_rows.filter((_, index) => index !== rowIndex)
    })
  }

  const handleSourceDrop = async (acceptedFiles) => {
    if (!acceptedFiles || acceptedFiles.length === 0) return

    setIsUploading(true)
    setNotice({ type: '', text: '' })

    for (const file of acceptedFiles) {
      try {
        const uploadedFile = await fileService.uploadSource(file)
        setSourceFiles((previous) => [...previous, uploadedFile])
      } catch (error) {
        const detail = error?.response?.data?.detail || error?.message || `Erreur lors de l import de ${file.name}.`
        setNotice({ type: 'error', text: detail })
      }
    }

    setIsUploading(false)
  }

  const handleDeleteSource = async (fileId) => {
    try {
      await fileService.deleteSource(fileId)
      setSourceFiles((previous) => previous.filter((file) => file.id !== fileId))
      setNotice({ type: 'success', text: 'Document supprime.' })
    } catch (error) {
      const detail = error?.response?.data?.detail || error?.message || 'Suppression impossible.'
      setNotice({ type: 'error', text: detail })
    }
  }

  const toggleFlagged = (fileId) => {
    setFlaggedIds((previous) => {
      const next = new Set(previous)
      if (next.has(fileId)) {
        next.delete(fileId)
      } else {
        next.add(fileId)
      }
      return next
    })
  }

  return (
    <section className="space-y-6 page-enter">
      <header className="panel-surface p-6 border border-black/10">
        <div className="flex items-center gap-3">
          <span className="h-10 w-10 rounded-lg bg-red-50 border border-red-200 inline-flex items-center justify-center text-red-600">
            <FileText className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-xl font-semibold">Documents de formation</h2>
            <p className="section-caption">
              Consultez, importez et signalez les documents qui alimentent la generation de scenarios.
            </p>
          </div>
        </div>
      </header>

      {notice.text && (
        <div
          className={`border p-3 text-sm flex items-start gap-2 ${
            notice.type === 'success'
              ? 'border-green-200 bg-green-50 text-green-700'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {notice.type === 'success' ? <CheckCircle className="h-4 w-4 mt-0.5" /> : <AlertCircle className="h-4 w-4 mt-0.5" />}
          <span>{notice.text}</span>
        </div>
      )}

      <div className="grid grid-cols-12 gap-6">
        <aside className="col-span-5 panel-surface p-5 border border-black/10 flex flex-col">
          <div className="flex items-center justify-between border-b border-black/10 pb-3">
            <h3 className="text-lg font-display inline-flex items-center gap-2">
              <Upload className="h-5 w-5 text-red-600" />
              Importer des documents
            </h3>
            <button
              type="button"
              onClick={openDataReviewModal}
              className="btn-secondary inline-flex items-center gap-2"
            >
              <ListChecks className="h-4 w-4" />
              Vérifier l'import
            </button>
          </div>

          <div className="mt-4">
            <DropZone
              onDrop={handleSourceDrop}
              type="source"
              acceptedTypes={{
                'application/pdf': ['.pdf'],
                'application/msword': ['.doc'],
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
                'application/vnd.ms-excel': ['.xls'],
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
                'text/csv': ['.csv'],
                'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.svg'],
                'text/*': ['.txt'],
              }}
              title="Importer des fichiers"
              description="PDF, Word, Excel, images et texte"
            />
          </div>

          {isUploading && (
            <p className="text-sm text-black/60 mt-3 inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Import des documents en cours...
            </p>
          )}

          <div className="mt-6 grid gap-3 text-sm text-black/70">
            <div className="flex items-center justify-between">
              <span>Total de documents</span>
              <span className="font-semibold text-black">{stats.total}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Documents traites</span>
              <span className="font-semibold text-black">{stats.processed}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Documents en erreur</span>
              <span className="font-semibold text-black">{stats.errors}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Documents signales</span>
              <span className="font-semibold text-black">{stats.flagged}</span>
            </div>
          </div>
        </aside>

        <section className="col-span-7 panel-surface p-5 border border-black/10">
          <div className="flex items-center justify-between border-b border-black/10 pb-3">
            <h3 className="text-lg font-display">Documents importes</h3>
            <span className="text-sm text-black/60">{stats.total} element(s)</span>
          </div>

          <div className="mt-4 space-y-3">
            {sourceFiles.length === 0 ? (
              <div className="text-sm text-black/60 text-center py-12">
                Aucun document importe pour le moment.
              </div>
            ) : (
              sourceFiles.map((file) => {
                const isFlagged = flaggedIds.has(file.id)
                const statusConfig = resolveStatusLabel(file.statut)
                return (
                  <article key={file.id} className={`border border-black/10 rounded-xl p-4 bg-white ${isFlagged ? 'ring-1 ring-red-200' : ''}`}>
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-black/70" />
                          <h4 className="text-sm font-medium text-black truncate">{file.titre}</h4>
                          {isFlagged && (
                            <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border border-red-200 bg-red-50 text-red-600">
                              <Flag className="h-3 w-3" />
                              Signale
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-black/60 mt-1">
                          {file.type_contenu || 'document'} • {(file.format || '').toUpperCase() || '-'} • {formatSize(file.taille)} • {formatDate(file.date_ajout)}
                        </p>
                        {file.erreur && (
                          <p className="text-xs text-red-600 mt-1">{file.erreur}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`text-[11px] px-2 py-1 rounded-full border ${statusConfig.className}`}>
                          {statusConfig.label}
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleFlagged(file.id)}
                          className={`text-xs inline-flex items-center gap-1 px-2 py-1 rounded-md border ${
                            isFlagged
                              ? 'border-red-200 text-red-600 bg-red-50'
                              : 'border-black/10 text-black/60 bg-white hover:border-black/20'
                          }`}
                        >
                          <Flag className="h-3 w-3" />
                          {isFlagged ? 'Retirer' : 'Signaler'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteSource(file.id)}
                          className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded-md border border-black/10 text-black/60 bg-white hover:border-red-200 hover:text-red-600"
                        >
                          <Trash2 className="h-3 w-3" />
                          Supprimer
                        </button>
                      </div>
                    </div>
                  </article>
                )
              })
            )}
          </div>
        </section>
      </div>

      {isDataReviewOpen && (
        <div className="fixed inset-0 z-[95] bg-black/35 flex items-center justify-center p-6">
          <div className="panel-surface w-[min(1200px,96vw)] h-[min(86vh,860px)] overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-black/10 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-black/60">Verification des donnees</p>
                <h3 className="text-xl font-display mt-1">Importation et edition des elements</h3>
                <p className="text-sm text-black/65 mt-1">
                  Consultez les tables importees, modifiez les cellules et ajustez les gestes possibles par element.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsDataReviewOpen(false)}
                className="h-10 w-10 border border-black/20 bg-white inline-flex items-center justify-center hover:bg-[#f4f4f4]"
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-12 flex-1 min-h-0">
              <aside className="col-span-4 border-r border-black/10 p-4 overflow-auto">
                <div className="panel-surface p-3 bg-white">
                  <p className="text-xs uppercase tracking-[0.14em] text-black/60">Edition autorisee</p>
                  <p className="text-sm mt-2">Table editable: Composant3D</p>
                  <p className="text-sm text-black/70 mt-1">
                    Les tables non modifiables (fichier, etapes, parametre, scene...) sont masquees.
                  </p>
                </div>

                <div className="mt-4 border border-black/15 p-3 bg-white text-sm text-black/75">
                  <p>Champs modifiables:</p>
                  <p className="mt-1">- nom_composant</p>
                  <p>- etats_possibles</p>
                </div>
              </aside>

              <section className="col-span-8 p-4 flex flex-col min-h-0">
                {isReviewLoading ? (
                  <div className="flex-1 flex items-center justify-center text-sm text-black/70">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Chargement des donnees importees...
                  </div>
                ) : dataReviewError ? (
                  <div className="border border-red-200 bg-red-50 text-red-700 p-3 text-sm">{dataReviewError}</div>
                ) : !selectedReviewTableData ? (
                  <div className="flex-1 flex items-center justify-center text-sm text-black/65">
                    Aucune table disponible pour verification.
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-3 border-b border-black/10 pb-3">
                      <div>
                        <h4 className="text-lg font-display">Tableur: Composant</h4>
                        <p className="text-sm text-black/65">
                          Modifiez uniquement les composants VR et leurs etats possibles.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={addReviewRow}
                        className="btn-secondary inline-flex items-center gap-2"
                      >
                        <Plus className="h-4 w-4" />
                        Ajouter une ligne
                      </button>
                    </div>

                    <div className="mt-3 border border-black/15 flex-1 overflow-auto">
                      <table className="min-w-full text-sm bg-white">
                        <thead className="sticky top-0 bg-[#f7f7f7] border-b border-black/10">
                          <tr>
                            <th className="px-2 py-2 text-left font-medium text-black/70">#</th>
                            {editableReviewColumns.map((column) => (
                              <th key={`col-${column.name}`} className="px-2 py-2 text-left font-medium text-black/70 whitespace-nowrap">
                                {column.name}
                              </th>
                            ))}
                            <th className="px-2 py-2 text-left font-medium text-black/70">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(selectedReviewTableData.sample_rows || []).length === 0 ? (
                            <tr>
                              <td colSpan={editableReviewColumns.length + 2} className="px-3 py-4 text-black/55">
                                Aucune ligne disponible. Ajoutez une ligne pour commencer l edition.
                              </td>
                            </tr>
                          ) : (
                            (selectedReviewTableData.sample_rows || []).map((row, rowIndex) => (
                              <tr key={`row-${rowIndex}`} className="border-t border-black/10 align-top">
                                <td className="px-2 py-2 text-black/60">{rowIndex + 1}</td>
                                {editableReviewColumns.map((column) => (
                                  <td key={`${rowIndex}-${column.name}`} className="px-2 py-2 min-w-[160px]">
                                    <input
                                      type="text"
                                      value={row?.[column.name] ?? ''}
                                      onChange={(event) => handleReviewCellChange(rowIndex, column.name, event.target.value)}
                                      className="input-field min-h-[34px] py-1.5"
                                    />
                                  </td>
                                ))}
                                <td className="px-2 py-2">
                                  <button
                                    type="button"
                                    onClick={() => deleteReviewRow(rowIndex)}
                                    className="text-red-600 inline-flex items-center gap-1 text-sm"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                    Supprimer
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3">
                      <p className="text-xs text-black/60">
                        {reviewRowsDirty ? 'Modifications non enregistrees.' : 'Aucune modification locale.'}
                      </p>
                      <button
                        type="button"
                        onClick={handleSaveDataReview}
                        disabled={!reviewRowsDirty || isReviewSaving}
                        className="btn-primary inline-flex items-center gap-2 disabled:opacity-50"
                      >
                        {isReviewSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Enregistrer les modifications
                      </button>
                    </div>
                  </>
                )}
              </section>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

export default DocumentsPage
