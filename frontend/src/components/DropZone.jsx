import { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, FileText, Video, Image, Box, Code } from 'lucide-react'

function DropZone({ onDrop, type, acceptedTypes, title, description }) {
  const handleDrop = useCallback((acceptedFiles) => {
    onDrop(acceptedFiles)
  }, [onDrop])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleDrop,
    accept: acceptedTypes,
    multiple: true,
  })

  const getIcon = () => {
    if (type === 'vr') {
      return <Box className="h-12 w-12 text-primary-400" />
    }
    return <Upload className="h-12 w-12 text-primary-400" />
  }

  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed p-8 text-center cursor-pointer transition-all duration-150 ${
        isDragActive
          ? 'border-black/30 bg-[#f1f1f1]'
          : 'border-black/20 bg-white hover:border-black/25 hover:bg-[#f7f7f7]'
      }`}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center">
        {getIcon()}
        <h3 className="mt-4 text-lg font-medium text-gray-900">{title}</h3>
        <p className="mt-1 text-sm text-gray-500">{description}</p>
        <p className="mt-2 text-xs text-gray-400">
          Glissez-déposez ou cliquez pour parcourir
        </p>
      </div>
    </div>
  )
}

export function FileList({ files, onDelete }) {
  const getFileIcon = (file) => {
    const format = file.format?.toLowerCase() || ''
    const typeContenu = file.type_contenu || file.type_element || ''

    if (typeContenu === 'video' || ['mp4', 'avi', 'mov', 'webm'].includes(format)) {
      return <Video className="h-5 w-5 text-purple-500" />
    }
    if (typeContenu === 'image' || ['jpg', 'jpeg', 'png', 'gif', 'svg'].includes(format)) {
      return <Image className="h-5 w-5 text-green-500" />
    }
    if (typeContenu === 'modele_3d' || ['fbx', 'obj', '3ds'].includes(format)) {
      return <Box className="h-5 w-5 text-orange-500" />
    }
    if (typeContenu === 'script' || format === 'cs') {
      return <Code className="h-5 w-5 text-blue-500" />
    }
    return <FileText className="h-5 w-5 text-gray-500" />
  }

  const formatSize = (bytes) => {
    if (!bytes) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  if (files.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <p className="text-sm">Aucun fichier importé</p>
      </div>
    )
  }

  return (
    <div className="space-y-2 max-h-64 overflow-y-auto">
      {files.map((file) => (
        <div
          key={file.id}
          className="flex items-center justify-between p-3 bg-white border border-black/15 hover:bg-[#f4f4f4] transition-colors duration-150 group"
        >
          <div className="flex items-center space-x-3 min-w-0">
            {getFileIcon(file)}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900 truncate">{file.titre}</p>
              <p className="text-xs text-gray-500">
                {file.format} • {formatSize(file.taille)}
              </p>
            </div>
          </div>
          <button
            onClick={() => onDelete(file.id)}
            className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  )
}

export default DropZone
