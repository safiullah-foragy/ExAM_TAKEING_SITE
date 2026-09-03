import { useState, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// Set up PDF.js worker
if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString();
  } catch {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version || '4.10.38'}/build/pdf.worker.min.mjs`;
  }
}

export default function PDFViewer({ pdfUrl }) {
  const [pdf, setPdf] = useState(null);
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [scale, setScale] = useState(1.2);
  const [reloadCount, setReloadCount] = useState(0);
  const containerRef = useRef();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPages([]);
    setPdf(null);

    if (!pdfUrl) {
      setError('No PDF URL specified for this exam.');
      setLoading(false);
      return;
    }

    const loadPdf = async () => {
      try {
        const token = localStorage.getItem('token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        const loadingTask = pdfjsLib.getDocument({
          url: pdfUrl,
          httpHeaders: headers,
          withCredentials: false,
          cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version || '4.10.38'}/cmaps/`,
          cMapPacked: true,
        });

        const pdfDoc = await loadingTask.promise;
        if (cancelled) return;
        setPdf(pdfDoc);

        // Render all pages as canvases
        const pageArr = [];
        for (let i = 1; i <= pdfDoc.numPages; i++) {
          const page = await pdfDoc.getPage(i);
          pageArr.push(page);
        }
        if (!cancelled) {
          setPages(pageArr);
          setLoading(false);
        }
      } catch (err) {
        console.error('PDFViewer loading error:', err);
        if (!cancelled) {
          setError(
            err.name === 'MissingPDFException' || err.status === 404
              ? 'Question PDF file could not be found on the server (404).'
              : 'Failed to load PDF in viewer.'
          );
          setLoading(false);
        }
      }
    };

    loadPdf();
    return () => { cancelled = true; };
  }, [pdfUrl, reloadCount]);

  return (
    <div ref={containerRef} style={{ minHeight: '100%' }}>
      {/* Toolbar */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 5,
        background: 'rgba(20,20,40,0.95)', backdropFilter: 'blur(10px)',
        padding: '0.5rem 1rem',
        display: 'flex', alignItems: 'center', gap: '0.75rem',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        marginBottom: '0.75rem',
      }}>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          📄 {pdf ? `${pdf.numPages} page${pdf.numPages !== 1 ? 's' : ''}` : ''}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {pdfUrl && (
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline btn-sm"
              title="Open PDF in new tab"
              style={{ fontSize: '0.75rem', textDecoration: 'none', padding: '4px 8px' }}
            >
              ↗ Open
            </a>
          )}
          <button
            className="btn btn-outline btn-sm"
            onClick={() => setScale((s) => Math.max(0.5, s - 0.2))}
            title="Zoom Out"
          >−</button>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', minWidth: 40, textAlign: 'center' }}>
            {Math.round(scale * 100)}%
          </span>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => setScale((s) => Math.min(3, s + 0.2))}
            title="Zoom In"
          >+</button>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => setScale(1.2)}
            title="Reset Zoom"
          >↺</button>
        </div>
      </div>

      {loading && (
        <div className="loader-wrap">
          <div>
            <div className="spinner" style={{ margin: '0 auto 1rem' }} />
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', fontSize: '0.85rem' }}>
              Loading PDF…
            </p>
          </div>
        </div>
      )}

      {error && (
        <div style={{
          padding: '2rem 1rem', textAlign: 'center',
          background: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid rgba(239, 68, 68, 0.25)',
          borderRadius: '8px', margin: '1rem',
          color: 'var(--text-primary)'
        }}>
          <div style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>⚠️</div>
          <div style={{ color: 'var(--accent-red)', fontWeight: 600, marginBottom: '0.5rem' }}>
            {error}
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '1.25rem', maxWidth: '400px', margin: '0 auto 1.25rem' }}>
            The exam question PDF could not be rendered inside the page. You can retry loading or open the document directly.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setReloadCount((c) => c + 1)}
            >
              🔄 Retry Loading
            </button>
            {pdfUrl && (
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary btn-sm"
                style={{ textDecoration: 'none' }}
              >
                📄 Open PDF File
              </a>
            )}
          </div>
        </div>
      )}

      {!loading && !error && pages.map((page, idx) => (
        <PageCanvas key={idx} page={page} scale={scale} pageNumber={idx + 1} />
      ))}
    </div>
  );
}

function PageCanvas({ page, scale, pageNumber }) {
  const canvasRef = useRef();

  useEffect(() => {
    let renderTask = null;
    const renderPage = async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const viewport = page.getViewport({ scale });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      renderTask = page.render({ canvasContext: ctx, viewport });
      try { await renderTask.promise; } catch { /* cancelled */ }
    };
    renderPage();
    return () => { renderTask?.cancel(); };
  }, [page, scale]);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      marginBottom: '1rem',
    }}>
      <div style={{
        fontSize: '0.7rem', color: 'var(--text-muted)',
        marginBottom: '0.25rem', letterSpacing: '0.05em'
      }}>
        Page {pageNumber}
      </div>
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
          borderRadius: '4px',
          maxWidth: '100%',
        }}
      />
    </div>
  );
}
