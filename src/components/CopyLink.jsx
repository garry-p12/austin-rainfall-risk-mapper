import { useEffect, useState } from 'react';

function legacyCopy(text) {
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    area.remove();
  }
}

// Copies the page address, which always matches the current view (see lib/url.js).
export default function CopyLink() {
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (!status) return undefined;
    const t = setTimeout(() => setStatus(''), 2500);
    return () => clearTimeout(t);
  }, [status]);

  const copy = async () => {
    const url = window.location.href;
    // The copy command runs synchronously inside the click, which every browser allows.
    // The Clipboard API is the fallback; some embedded browsers leave it pending forever,
    // so give up after a moment rather than show nothing.
    if (legacyCopy(url)) { setStatus('Link copied'); return; }
    try {
      await Promise.race([
        navigator.clipboard.writeText(url),
        new Promise((_, reject) => { setTimeout(() => reject(new Error('timeout')), 1500); }),
      ]);
      setStatus('Link copied');
    } catch {
      setStatus('Could not copy. Copy the address bar instead.');
    }
  };

  return (
    <div className="copy-link">
      <button type="button" className="toggle" onClick={copy}>Copy link to this view</button>
      <span className="copy-status" role="status">{status}</span>
    </div>
  );
}
