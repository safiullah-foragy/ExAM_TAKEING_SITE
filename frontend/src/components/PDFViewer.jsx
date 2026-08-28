import { useState, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

export default function PDFViewer({ pdfUrl }) {
  const [pdf, setPdf] = useState(null);
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [scale, setScale] = useState(1.2);
  const containerRef = useRef();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPages([]);
    setPdf(null);

    const loadPdf = async () => {
      try {
        const loadingTask = pdfjsLib.getDocument({ url: pdfUrl, withCredentials: false });
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
        if (!cancelled) {
          setError('Failed to load PDF. Please try refreshing.');
          setLoading(false);
        }
      }
    };

    loadPdf();
    return () => { cancelled = true; };
  }, [pdfUrl]);

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
          padding: '2rem', textAlign: 'center',
          color: 'var(--accent-red)'
        }}>
          ⚠️ {error}
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
