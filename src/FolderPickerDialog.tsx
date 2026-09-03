import React, { useState, useEffect } from 'react';
import { Folder, FolderPlus, ChevronUp, ChevronRight, X, Loader2, Check } from 'lucide-react';
import { apiClient } from './shared/api-client';

interface FolderPickerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectFolder: (folderPath: string, folderName: string) => void;
}

interface DirectoryItem {
  name: string;
  path: string;
}

interface FsResponse {
  currentPath: string;
  parentPath: string | null;
  directories: DirectoryItem[];
}

export const FolderPickerDialog: React.FC<FolderPickerDialogProps> = ({
  isOpen,
  onClose,
  onSelectFolder
}) => {
  const [currentPath, setCurrentPath] = useState<string>('');
  const [parentPath, setParentPath] = useState<string | null>(null);
  const [directories, setDirectories] = useState<DirectoryItem[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<DirectoryItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDirectory = async (targetPath?: string) => {
    setLoading(true);
    setError(null);
    try {
      const query = targetPath ? `?path=${encodeURIComponent(targetPath)}` : '';
      const data = await apiClient.get<FsResponse>(`/api/fs/directories${query}`);
      setCurrentPath(data.currentPath);
      setParentPath(data.parentPath);
      setDirectories(data.directories || []);
      setSelectedFolder(null);
    } catch (err: any) {
      setError(err.message || 'Nie udało się odczytać zawartości folderu');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadDirectory();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (selectedFolder) {
      onSelectFolder(selectedFolder.path, selectedFolder.name);
    } else if (currentPath) {
      const name = currentPath.split('/').pop() || currentPath.split('\\').pop() || 'Project';
      onSelectFolder(currentPath, name);
    }
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="folder-picker-title"
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 150
      }}
    >
      <div
        className="glass-card"
        style={{
          width: '580px',
          maxWidth: '92vw',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
          border: '1px solid var(--glass-border)'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <FolderPlus size={22} color="var(--primary)" />
            <h2 id="folder-picker-title" style={{ fontSize: '1.2rem', margin: 0 }}>Wybierz folder projektu</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              padding: '0.2rem'
            }}
            aria-label="Zamknij"
          >
            <X size={20} />
          </button>
        </div>

        {/* Current Path Bar & Parent folder button */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => parentPath && loadDirectory(parentPath)}
            disabled={!parentPath || loading}
            style={{ padding: '0.45rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
            title="Katalog w górę"
          >
            <ChevronUp size={16} />
            <span>W górę</span>
          </button>
          <div
            style={{
              flex: 1,
              background: 'rgba(0,0,0,0.3)',
              borderRadius: '8px',
              border: '1px solid var(--glass-border)',
              padding: '0.45rem 0.75rem',
              color: 'var(--text-main)',
              fontSize: '0.85rem',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontFamily: 'monospace'
            }}
            title={currentPath}
          >
            {currentPath || 'Wczytywanie...'}
          </div>
        </div>

        {/* Directory List Container */}
        <div
          style={{
            flex: 1,
            minHeight: '260px',
            maxHeight: '380px',
            overflowY: 'auto',
            background: 'rgba(0,0,0,0.2)',
            borderRadius: '8px',
            border: '1px solid var(--glass-border)',
            padding: '0.4rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.2rem'
          }}
        >
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '0.5rem', color: 'var(--text-muted)' }}>
              <Loader2 className="animate-spin" size={20} />
              <span>Wczytywanie folderów...</span>
            </div>
          ) : error ? (
            <div style={{ color: '#ef4444', padding: '1rem', textAlign: 'center', fontSize: '0.9rem' }}>
              {error}
            </div>
          ) : directories.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', padding: '2rem', textAlign: 'center', fontSize: '0.9rem' }}>
              Brak widocznych podkatalogów w tym folderze.
            </div>
          ) : (
            directories.map((dir) => {
              const isSelected = selectedFolder?.path === dir.path;
              return (
                <div
                  key={dir.path}
                  onClick={() => setSelectedFolder(dir)}
                  onDoubleClick={() => loadDirectory(dir.path)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    background: isSelected ? 'rgba(59, 130, 246, 0.25)' : 'transparent',
                    border: isSelected ? '1px solid rgba(59, 130, 246, 0.5)' : '1px solid transparent',
                    color: isSelected ? '#fff' : 'var(--text-main)',
                    userSelect: 'none'
                  }}
                  title="Kliknij raz, aby zaznaczyć; dwukrotnie, aby wejść do środka"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', overflow: 'hidden' }}>
                    <Folder size={18} color={isSelected ? '#60a5fa' : 'var(--primary)'} />
                    <span style={{ fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {dir.name}
                    </span>
                  </div>
                  <ChevronRight size={16} color="var(--text-muted)" />
                </div>
              );
            })
          )}
        </div>

        {/* Selected target info */}
        <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {selectedFolder ? (
            <span>Wybrano do dodania: <strong style={{ color: '#60a5fa' }}>{selectedFolder.path}</strong></span>
          ) : (
            <span>Zostanie dodany bieżący katalog: <strong style={{ color: 'var(--text-main)' }}>{currentPath}</strong></span>
          )}
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ flex: 1, padding: '0.6rem' }}
            onClick={onClose}
          >
            Anuluj
          </button>
          <button
            type="button"
            className="btn btn-primary"
            style={{ flex: 1.5, padding: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
            onClick={handleConfirm}
            disabled={loading || !currentPath}
          >
            <Check size={18} />
            <span>Wybierz ten folder</span>
          </button>
        </div>
      </div>
    </div>
  );
};
