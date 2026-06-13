"use client";

import { useMemo, useState } from "react";

const MIN_ZOOM = 60;
const MAX_ZOOM = 140;
const STEP = 10;
const DEFAULT_ZOOM = 100;

interface ArgoEmbedPanelProps {
  embedUrl: string;
  showHeader?: boolean;
}

function clampZoom(value: number): number {
  if (value < MIN_ZOOM) {
    return MIN_ZOOM;
  }
  if (value > MAX_ZOOM) {
    return MAX_ZOOM;
  }
  return value;
}

function EmbedHeader({ showHeader }: { showHeader: boolean }) {
  if (!showHeader) {
    return null;
  }
  return (
    <div className="embed-header">
      <h2 className="section-header-brand">ArgoCD Dashboard</h2>
      <span>Read-only mode</span>
    </div>
  );
}

export function ArgoEmbedPanel({ embedUrl, showHeader = true }: ArgoEmbedPanelProps) {
  const [zoomPercent, setZoomPercent] = useState<number>(DEFAULT_ZOOM);
  const [loaded, setLoaded] = useState<boolean>(false);

  const hasEmbed = useMemo(() => embedUrl.trim().length > 0, [embedUrl]);

  const scale = useMemo(() => zoomPercent / 100, [zoomPercent]);
  const frameStyle = useMemo(
    () => ({
      zoom: scale,
      width: `${100 / scale}%`,
      height: `${100 / scale}%`
    }),
    [scale]
  );

  // No embed URL configured (e.g. the cluster-free demo, where there is no live ArgoCD).
  if (!hasEmbed) {
    return (
      <section className="embed-panel">
        <EmbedHeader showHeader={showHeader} />
        <div className="argocd-frame-viewport argocd-embed-empty">
          <p className="embed-empty-title">Live ArgoCD is not available in this demo</p>
          <p className="embed-empty-sub">
            This portal is running in config mode (no connected cluster). Service status is derived
            from <code>SVCS.yaml</code>. Connect an ArgoCD instance to enable the live dashboard.
          </p>
        </div>
      </section>
    );
  }

  // Embed is available but loaded on demand. The embedded ArgoCD UI opens long-lived
  // streaming connections; auto-mounting it on every page view degrades the tab (and
  // churns the shared tunnel connector) over time, so it is gated behind an explicit click.
  if (!loaded) {
    return (
      <section className="embed-panel">
        <EmbedHeader showHeader={showHeader} />
        <div className="argocd-frame-viewport argocd-embed-empty">
          <p className="embed-empty-title">Live ArgoCD dashboard</p>
          <p className="embed-empty-sub">
            The embedded dashboard streams live updates from ArgoCD. It is loaded on demand to keep
            the portal responsive. Live sync &amp; health for each service are already shown in the
            catalog.
          </p>
          <div className="embed-actions">
            <button type="button" className="open-link" onClick={() => setLoaded(true)}>
              Load embedded ArgoCD
            </button>
            <a className="open-link" href={embedUrl} target="_blank" rel="noreferrer">
              Open in new tab ↗
            </a>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="embed-panel">
      <EmbedHeader showHeader={showHeader} />

      <div className="embed-toolbar" role="group" aria-label="argocd-zoom-controls">
        <button type="button" onClick={() => setZoomPercent((current) => clampZoom(current - STEP))}>
          -
        </button>
        <span>{zoomPercent}%</span>
        <button type="button" onClick={() => setZoomPercent((current) => clampZoom(current + STEP))}>
          +
        </button>
        <button type="button" onClick={() => setZoomPercent(DEFAULT_ZOOM)}>
          Reset
        </button>
        <button type="button" onClick={() => setLoaded(false)}>
          Unload
        </button>
      </div>

      <div className="argocd-frame-viewport">
        <iframe className="argocd-frame" style={frameStyle} src={embedUrl} title="Embedded ArgoCD" loading="lazy" />
      </div>
    </section>
  );
}
