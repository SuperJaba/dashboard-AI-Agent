import React, { useState, useEffect, useCallback } from 'react';
import { Folder, FolderPlus, ChevronUp, ChevronRight, X, Loader2, Check, HardDrive, ArrowRight } from 'lucide-react';
import { apiClient } from './shared/api-client';

interface FolderPickerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectFolder: (folderPath: string, folderName: string) => void;
}

interface DirectoryItem {
  name: string;
  path: string;
  isDrive?: boolean;
}

interface FsResponse {
  currentPath: string;
  parentPath: string | null;
  directories: DirectoryItem[];
  drives?: string[];
}

export const STORAGE_KEY_LAST_WORKSPACE_PATH = 'last_workspace_folder_path';

export const FolderPickerDialog: React.FC<FolderPickerDialogProps> = ({
  isOpen,
  onClose,
  onSelectFolder
}) => {
  const [currentPath, setCurrentPath] = useState<string>('');
  const [inputPath, setInputPath] = useState<string>('');
  const [parentPath, setParentPath] = useState<string | null>(null);
  const [directories, setDirectories] = useState<DirectoryItem[]>([]);
  const [drives, setDrives] = useState<string[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<DirectoryItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDirectory = useCallback(async function fetchDir(targetPath?: string, isFallbackCandidate = false) {
    setLoading(true);
    setError(null);
    try {
      const query = targetPath !== undefined ? `?path=${encodeURIComponent(targetPath)}` : '';
      const data = await apiClient.get<FsResponse>(`/api/fs/directories${query}`);
      const safeData = data || ({} as Partial<FsResponse>);
      const resolvedPath = safeData.currentPath || '';
      setCurrentPath(resolvedPath);
      setInputPath(resolvedPath);
      setParentPath(safeData.parentPath || null);
      setDirectories(Array.isArray(safeData.directories) ? safeData.directories : []);
      if (Array.isArray(safeData.drives) && safeData.drives.length > 0) {
        setDrives(safeData.drives);
      }
      setSelectedFolder(null);
    } catch (err: any) {
      if (isFallbackCandidate) {
        try {
          localStorage.removeItem(STORAGE_KEY_LAST_WORKSPACE_PATH);
        } catch {
          // ignore
        }
        await fetchDir();
        return;
      }
      setError(err.message || 'Nie udało się odczytać zawartości folderu');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      let savedPath: string | null = null;
      try {
        savedPath = localStorage.getItem(STORAGE_KEY_LAST_WORKSPACE_PATH);
      } catch {
        // ignore
      }
      if (savedPath && savedPath.trim()) {
        loadDirectory(savedPath.trim(), true);
      } else {
        loadDirectory();
      }
    }
  }, [isOpen, loadDirectory]);

  if (!isOpen) return null;

  const handlePathSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const target = (inputPath || '').trim();
    if (target) {
      loadDirectory(target);
    }
  };

  const handleConfirm = () => {
    const trimmedInput = (inputPath || '').trim();
    let chosenPath = '';
    let chosenName = '';

    if (selectedFolder) {
      chosenName = selectedFolder.name.replace(/^Dysk\s*\((.*)\)$/, '$1') || selectedFolder.name;
      chosenPath = selectedFolder.path;
    } else if (trimmedInput && trimmedInput !== currentPath) {
      chosenName = trimmedInput.replace(/[/\\]$/, '').split(/[/\\]/).pop() || trimmedInput;
      chosenPath = trimmedInput;
    } else if (currentPath) {
      chosenName = currentPath.replace(/[/\\]$/, '').split(/[/\\]/).pop() || currentPath;
      chosenPath = currentPath;
    }

    if (chosenPath) {
      try {
        const parent = chosenPath.replace(/[/\\][^/\\]+[/\\]?$/, '');
        const pathToSave = parent && parent !== chosenPath ? parent : chosenPath;
        localStorage.setItem(STORAGE_KEY_LAST_WORKSPACE_PATH, pathToSave);
      } catch {
        // ignore storage errors
      }
      onSelectFolder(chosenPath, chosenName);
      onClose();
    }
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
          width: '640px',
          maxWidth: '94vw',
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
        <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem', alignItems: 'center', flexWrap: 'nowrap' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => parentPath !== null && loadDirectory(parentPath)}
            disabled={parentPath === null || loading}
            style={{ padding: '0.45rem 0.65rem', display: 'flex', alignItems: 'center', gap: '0.3rem', whiteSpace: 'nowrap' }}
            title={parentPath === 'DRIVES' ? 'W górę (lista dysków)' : 'Katalog w górę'}
          >
            <ChevronUp size={16} />
            <span>W górę</span>
          </button>

          {/* Drive selector for fast switching */}
          {drives && drives.length > 0 && (
            <select
              value={drives.find(d => currentPath.toUpperCase().startsWith(d.toUpperCase())) || ''}
              onChange={(e) => {
                if (e.target.value) {
                  loadDirectory(e.target.value);
                }
              }}
              title="Zmień dysk"
              aria-label="Wybierz dysk"
              style={{
                background: 'rgba(0,0,0,0.3)',
                color: 'var(--text-main)',
                border: '1px solid var(--glass-border)',
                borderRadius: '8px',
                padding: '0.45rem 0.5rem',
                fontSize: '0.85rem',
                fontFamily: 'monospace',
                cursor: 'pointer',
                outline: 'none',
                fontWeight: 'bold'
              }}
            >
              <option value="" disabled>Dysk...</option>
              {drives.map(drive => (
                <option key={drive} value={drive} style={{ background: '#1e293b', color: '#fff' }}>
                  {drive}
                </option>
              ))}
            </select>
          )}

          {/* Editable path input */}
          <form onSubmit={handlePathSubmit} style={{ display: 'flex', flex: 1, gap: '0.35rem' }}>
            <input
              type="text"
              value={inputPath}
              onChange={(e) => setInputPath(e.target.value)}
              placeholder="Wpisz lub wklej ścieżkę (np. C:\...)"
              aria-label="Ścieżka folderu"
              style={{
                flex: 1,
                background: 'rgba(0,0,0,0.3)',
                borderRadius: '8px',
                border: '1px solid var(--glass-border)',
                padding: '0.45rem 0.75rem',
                color: 'var(--text-main)',
                fontSize: '0.85rem',
                fontFamily: 'monospace',
                outline: 'none',
                minWidth: '100px'
              }}
            />
            <button
              type="submit"
              className="btn btn-secondary"
              disabled={loading || !(inputPath || '').trim()}
              title="Przejdź do wpisanej ścieżki"
              aria-label="Przejdź do ścieżki"
              style={{ padding: '0.45rem 0.65rem', display: 'flex', alignItems: 'center', gap: '0.3rem', whiteSpace: 'nowrap' }}
            >
              <ArrowRight size={15} />
              <span>Przejdź</span>
            </button>
          </form>
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
              const isDriveItem = dir.isDrive || /^[a-zA-Z]:\\?$/.test(dir.path);
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
                  title={isDriveItem ? "Kliknij, aby wejść na dysk" : "Kliknij raz, aby zaznaczyć; dwukrotnie, aby wejść do środka"}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', overflow: 'hidden' }}>
                    {isDriveItem ? (
                      <HardDrive size={18} color={isSelected ? '#60a5fa' : '#38bdf8'} />
                    ) : (
                      <Folder size={18} color={isSelected ? '#60a5fa' : 'var(--primary)'} />
                    )}
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
          ) : currentPath ? (
            <span>Zostanie dodany bieżący katalog: <strong style={{ color: 'var(--text-main)' }}>{currentPath}</strong></span>
          ) : (
            <span>Wybierz dysk z listy lub wpisz ścieżkę powyżej</span>
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
            disabled={loading || (!selectedFolder && !currentPath && !(inputPath || '').trim())}
          >
            <Check size={18} />
            <span>Wybierz ten folder</span>
          </button>
        </div>
      </div>
    </div>
  );
};
