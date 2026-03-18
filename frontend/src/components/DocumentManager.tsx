import React, { useState, useEffect } from 'react';

interface Document {
  id: string;
  name: string;
  type: 'pdf' | 'docx' | 'txt' | 'markdown';
  wordCount?: number;
  chunkCount?: number;
  createdAt: number;
  status?: 'uploading' | 'processing' | 'ready' | 'error';
}

interface DocumentManagerProps {
  onDocumentsChange?: (documents: Document[]) => void;
}

const DocumentManager: React.FC<DocumentManagerProps> = ({ onDocumentsChange }) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);

  // Load documents on mount
  useEffect(() => {
    loadDocuments();
  }, []);

  useEffect(() => {
    onDocumentsChange?.(documents);
  }, [documents]);

  const loadDocuments = async () => {
    try {
      const response = await fetch('/api/documents');
      const data = await response.json();
      if (data.success) {
        setDocuments(data.documents || []);
      }
    } catch (error) {
      console.error('Failed to load documents:', error);
    }
  };

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setUploadProgress(0);

    const supportedTypes = ['text/plain', 'text/markdown', 'application/pdf', 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      if (!supportedTypes.some(type => file.type.includes(type.split('/')[1]))) {
        alert(`Unsupported file type: ${file.type}`);
        continue;
      }

      try {
        setUploadProgress((i / files.length) * 100);

        // Add to documents list with uploading status
        const newDoc: Document = {
          id: crypto.randomUUID(),
          name: file.name,
          type: getFileType(file),
          createdAt: Date.now(),
          status: 'uploading',
        };
        setDocuments(prev => [...prev, newDoc]);

        // Read file content
        const content = await readFileContent(file);

        // Update status to processing
        setDocuments(prev => prev.map(doc => 
          doc.id === newDoc.id ? { ...doc, status: 'processing' } : doc
        ));

        // Upload to backend
        const response = await fetch('/api/documents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: file.name,
            type: getFileType(file),
            content,
            metadata: {
              size: file.size,
              wordCount: content.split(/\s+/).length,
            },
          }),
        });

        const result = await response.json();

        if (result.success) {
          setDocuments(prev => prev.map(doc =>
            doc.id === newDoc.id
              ? {
                  ...doc,
                  id: result.document.id,
                  status: 'ready',
                  chunkCount: result.document.chunkCount,
                  wordCount: result.document.metadata?.wordCount,
                }
              : doc
          ));
        } else {
          throw new Error(result.error || 'Upload failed');
        }

        setUploadProgress(((i + 1) / files.length) * 100);
      } catch (error) {
        console.error('Upload error:', error);
        setDocuments(prev => prev.map(doc =>
          doc.id === newDoc.id ? { ...doc, status: 'error' } : doc
        ));
      }
    }

    setIsUploading(false);
    setUploadProgress(100);
    setTimeout(() => setUploadProgress(0), 2000);
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/documents/${id}`, {
        method: 'DELETE',
      });

      const result = await response.json();
      if (result.success) {
        setDocuments(prev => prev.filter(doc => doc.id !== id));
      }
    } catch (error) {
      console.error('Delete error:', error);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const getFileType = (file: File): Document['type'] => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return 'pdf';
    if (ext === 'docx') return 'docx';
    if (ext === 'md' || ext === 'markdown') return 'markdown';
    return 'txt';
  };

  const readFileContent = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatDateTime = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Knowledge Base
      </h2>

      {/* Upload Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`mb-6 border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
          dragOver
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
            : 'border-gray-300 dark:border-gray-600 hover:border-blue-400'
        }`}
      >
        <svg
          className="mx-auto h-12 w-12 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          />
        </svg>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          {isUploading ? 'Uploading...' : 'Drag & drop files here, or click to select'}
        </p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
          Supports: TXT, MD, PDF, DOCX
        </p>

        <input
          type="file"
          id="file-upload"
          multiple
          accept=".txt,.md,.markdown,.pdf,.docx"
          onChange={(e) => handleFileSelect(e.target.files)}
          className="hidden"
        />
        <label
          htmlFor="file-upload"
          className="mt-4 inline-flex items-center px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg cursor-pointer transition-colors"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Select Files
        </label>

        {/* Progress Bar */}
        {uploadProgress > 0 && (
          <div className="mt-4">
            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">{Math.round(uploadProgress)}%</p>
          </div>
        )}
      </div>

      {/* Document List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Documents ({documents.length})
          </h3>
          {documents.length > 0 && (
            <button
              onClick={() => setDocuments([])}
              className="text-xs text-red-500 hover:text-red-600"
            >
              Clear All
            </button>
          )}
        </div>

        {documents.length === 0 ? (
          <div className="text-center py-8 text-gray-400 dark:text-gray-500">
            <svg className="mx-auto h-10 w-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p className="mt-2 text-sm">No documents uploaded yet</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  <div className={`w-8 h-8 rounded flex items-center justify-center ${
                    doc.type === 'pdf' ? 'bg-red-100 text-red-600' :
                    doc.type === 'docx' ? 'bg-blue-100 text-blue-600' :
                    doc.type === 'markdown' ? 'bg-green-100 text-green-600' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    <span className="text-xs font-bold uppercase">{doc.type}</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {doc.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {doc.wordCount ? `${doc.wordCount.toLocaleString()} words` : 'Processing'} •{' '}
                      {formatDateTime(doc.createdAt)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {/* Status Indicator */}
                  {doc.status === 'uploading' && (
                    <span className="text-xs text-blue-500">Uploading...</span>
                  )}
                  {doc.status === 'processing' && (
                    <span className="text-xs text-yellow-500">Processing...</span>
                  )}
                  {doc.status === 'ready' && (
                    <span className="text-xs text-green-500">✓ Ready</span>
                  )}
                  {doc.status === 'error' && (
                    <span className="text-xs text-red-500">Error</span>
                  )}

                  {/* Delete Button */}
                  <button
                    onClick={() => handleDelete(doc.id)}
                    className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                    title="Delete document"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <p className="text-xs text-blue-700 dark:text-blue-300">
          <strong>Tip:</strong> Upload your resume, project documents, or technical notes to help
          the AI generate more personalized responses.
        </p>
      </div>
    </div>
  );
};

export default DocumentManager;
