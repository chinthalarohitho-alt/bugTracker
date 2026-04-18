"use client";
import { useState, useMemo, useEffect } from 'react';
import { GitPullRequest, X, ArrowRight, ClipboardPaste, RotateCcw, Loader2 } from 'lucide-react';
import CustomDropdown from './CustomDropdown';

const CONVENTIONAL_PREFIXES = /^(feat|fix|chore|refactor|docs|style|test|perf|build|ci|revert|hotfix|wip)(\([^)]*\))?!?\s*:\s*/i;
const GITHUB_PR_REGEX = /github\.com\/[^/]+\/[^/]+\/pull\/\d+/i;

function cleanPRTitle(raw) {
  if (!raw) return '';
  let t = String(raw).split('\n')[0].trim();
  t = t.replace(/^:+\s*/, '');
  t = t.replace(CONVENTIONAL_PREFIXES, '');
  t = t.replace(/\s*#\d+\s*$/, '');
  t = t.replace(/[…]+$/, '').replace(/\.{3,}$/, '');
  return t.trim();
}

function extractGitHubUrl(text) {
  const match = String(text || '').match(/https?:\/\/github\.com\/[^\s]+\/pull\/\d+/i);
  return match ? match[0] : null;
}

function assigneeName(v) {
  return typeof v === 'object' ? v?.name : v;
}

export default function PRToBugModal({ onClose, onCreate, settings, currentReporter, saving }) {
  const [step, setStep] = useState('loading'); // 'loading' | 'paste' | 'configure'
  const [prUrl, setPrUrl] = useState('');
  const [rawTitle, setRawTitle] = useState('');
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState('');

  const [title, setTitle] = useState('');
  const [assignee, setAssignee] = useState('');
  const [priority, setPriority] = useState('');
  const [severity, setSeverity] = useState('');
  const [formError, setFormError] = useState('');

  const assigneeOptions = useMemo(
    () => (settings?.assignees || [])
      .map(a => assigneeName(a))
      .filter(n => n && n !== 'Not Assigned' && n !== 'Unassigned'),
    [settings]
  );
  const priorityOptions = settings?.priorities || ['Critical', 'High', 'Medium', 'Low'];
  const severityOptions = ['Blocker', 'Major', 'Minor', 'Trivial'];

  const handlePasted = async (text) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const url = extractGitHubUrl(trimmed);

    if (url) {
      setPrUrl(url);
      setFetching(true);
      setFetchError('');
      try {
        const res = await fetch('/api/github/pr-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ urls: [url] })
        });
        const data = await res.json();
        const info = data?.statuses?.[0];
        if (info?.title) {
          const cleaned = cleanPRTitle(info.title);
          setRawTitle(info.title);
          setTitle(cleaned);
          setStep('configure');
        } else {
          setFetchError("Couldn't fetch PR title. Paste the title text instead.");
        }
      } catch {
        setFetchError('Network error while fetching PR. Try again.');
      } finally {
        setFetching(false);
      }
    } else {
      // Treat the paste as a raw title (no URL detected)
      const cleaned = cleanPRTitle(trimmed);
      setPrUrl('');
      setRawTitle(trimmed);
      setTitle(cleaned);
      setStep('configure');
    }
  };

  // Auto-read clipboard on open
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (typeof navigator === 'undefined' || !navigator.clipboard?.readText) {
          if (!cancelled) setStep('paste');
          return;
        }
        const text = await navigator.clipboard.readText();
        if (cancelled) return;
        if (text && text.trim()) {
          await handlePasted(text);
        } else {
          setStep('paste');
        }
      } catch {
        if (!cancelled) setStep('paste');
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (step !== 'paste' || saving) return;
    const handlePaste = (e) => {
      const text = e.clipboardData?.getData('text') || '';
      if (text.trim()) {
        e.preventDefault();
        handlePasted(text);
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [step, saving]);

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const resetPaste = () => {
    setStep('paste');
    setPrUrl(''); setRawTitle(''); setTitle('');
    setAssignee(''); setPriority(''); setSeverity('');
    setFormError(''); setFetchError('');
  };

  const canSubmit = title.trim() && assignee && priority && severity && !saving;

  const handleSubmit = async () => {
    if (!canSubmit) { setFormError('Fill all fields.'); return; }
    setFormError('');
    await onCreate({
      title: title.trim(),
      description: title.trim(),
      assignee,
      reporter: currentReporter,
      priority,
      severity,
      githubPr: prUrl ? [prUrl] : []
    });
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 5000 }} onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
        width: 'min(520px, 92vw)',
        padding: 24,
        borderRadius: 14,
        display: 'flex', flexDirection: 'column', gap: 18
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              backgroundColor: '#8b5cf618', color: '#8b5cf6',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <GitPullRequest size={17} />
            </div>
            <div>
              <div style={{ fontSize: '0.98rem', fontWeight: 600, color: 'var(--color-text-main)' }}>
                {step === 'paste' ? 'Create bug from PR' : 'Bug details'}
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                {step === 'paste' ? 'Step 1 of 2 · Paste the PR link' : 'Step 2 of 2 · Assign and classify'}
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: '50%',
            border: 'none', background: 'transparent',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--color-text-muted)', cursor: 'pointer'
          }} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {(step === 'loading' || (step === 'paste' && fetching)) && (
          <div style={{
            padding: '28px 20px',
            border: '1.5px dashed var(--color-border)',
            borderRadius: 12,
            backgroundColor: 'var(--color-bg-body)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
            textAlign: 'center'
          }}>
            <Loader2 size={22} color="var(--color-text-muted)" style={{ animation: 'pr-spin 1s linear infinite' }} />
            <div style={{ fontSize: '0.88rem', fontWeight: 500, color: 'var(--color-text-main)' }}>
              {fetching ? 'Fetching PR title…' : 'Reading clipboard…'}
            </div>
            <style jsx>{`
              @keyframes pr-spin { to { transform: rotate(360deg); } }
            `}</style>
          </div>
        )}

        {step === 'paste' && !fetching && (
          <>
            <div style={{
              padding: '28px 20px',
              border: '1.5px dashed var(--color-border)',
              borderRadius: 12,
              backgroundColor: 'var(--color-bg-body)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
              textAlign: 'center'
            }}>
              <ClipboardPaste size={22} color="var(--color-text-muted)" />
              <div style={{ fontSize: '0.88rem', fontWeight: 500, color: 'var(--color-text-main)' }}>
                Paste the PR link here
              </div>
              <div style={{
                fontSize: '0.72rem', color: 'var(--color-text-muted)',
                display: 'inline-flex', alignItems: 'center', gap: 5
              }}>
                Press <Kbd>⌘</Kbd> <Kbd>V</Kbd>
              </div>
            </div>
            {fetchError && (
              <div style={{ fontSize: '0.78rem', color: '#dc2626', fontWeight: 500 }}>{fetchError}</div>
            )}
          </>
        )}

        {step === 'configure' && (
          <>
            {prUrl && (
              <div style={{
                padding: '8px 12px', borderRadius: 8,
                backgroundColor: 'var(--color-bg-body)',
                border: '1px solid var(--color-border)',
                display: 'flex', alignItems: 'center', gap: 8,
                fontSize: '0.74rem', color: 'var(--color-text-muted)', overflow: 'hidden'
              }}>
                <GitPullRequest size={13} color="#8b5cf6" />
                <a href={prUrl} target="_blank" rel="noopener noreferrer" style={{
                  flex: 1, color: 'var(--color-text-main)', textDecoration: 'none',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                }}>{prUrl}</a>
                <button
                  onClick={resetPaste}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    border: 'none', background: 'transparent',
                    color: 'var(--color-text-muted)',
                    fontSize: '0.7rem', fontWeight: 500, cursor: 'pointer', padding: 0
                  }}>
                  <RotateCcw size={11} /> Reset
                </button>
              </div>
            )}

            <Field label="Title">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                spellCheck={false}
                style={inputStyle}
              />
              {rawTitle && rawTitle !== title && (
                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: 5 }}>
                  Original: <span style={{ fontFamily: 'var(--font-mono)' }}>{rawTitle}</span>
                </div>
              )}
            </Field>

            <Field label="Assign to">
              <CustomDropdown
                label="Select teammate"
                options={assigneeOptions}
                selected={assignee}
                onSelect={setAssignee}
              />
            </Field>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Priority">
                <CustomDropdown
                  label="Select priority"
                  options={priorityOptions}
                  selected={priority}
                  onSelect={setPriority}
                />
              </Field>
              <Field label="Severity">
                <CustomDropdown
                  label="Select severity"
                  options={severityOptions}
                  selected={severity}
                  onSelect={setSeverity}
                />
              </Field>
            </div>

            {formError && (
              <div style={{ fontSize: '0.78rem', color: '#dc2626', fontWeight: 500 }}>{formError}</div>
            )}
          </>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          {step === 'configure' && (
            <button
              onClick={resetPaste}
              style={{
                padding: '8px 14px', borderRadius: 8,
                border: '1px solid var(--color-border)',
                backgroundColor: 'transparent',
                color: 'var(--color-text-muted)',
                fontSize: '0.82rem', fontWeight: 500, cursor: 'pointer',
                marginRight: 'auto'
              }}>
              Back
            </button>
          )}
          <button
            onClick={onClose}
            style={{
              padding: '8px 14px', borderRadius: 8,
              border: '1px solid var(--color-border)',
              backgroundColor: 'transparent',
              color: 'var(--color-text-muted)',
              fontSize: '0.82rem', fontWeight: 500, cursor: 'pointer'
            }}>
            Cancel
          </button>
          {step === 'configure' && (
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '8px 14px', borderRadius: 8,
                border: 'none', backgroundColor: '#0f172a',
                color: 'white',
                fontSize: '0.82rem', fontWeight: 500,
                cursor: canSubmit ? 'pointer' : 'not-allowed',
                opacity: canSubmit ? 1 : 0.5
              }}>
              {saving ? 'Creating…' : 'Create bug'} {!saving && <ArrowRight size={13} />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{
        fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase',
        letterSpacing: '0.05em', color: 'var(--color-text-muted)'
      }}>{label}</label>
      {children}
    </div>
  );
}

function Kbd({ children }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      minWidth: 18, height: 18, padding: '0 5px',
      borderRadius: 4,
      border: '1px solid var(--color-border)',
      backgroundColor: 'var(--color-bg-surface)',
      color: 'var(--color-text-main)',
      fontSize: '0.7rem', fontWeight: 600,
      fontFamily: 'var(--font-family)'
    }}>{children}</span>
  );
}

const inputStyle = {
  width: '100%', padding: '9px 12px', borderRadius: 8,
  border: '1px solid var(--color-border)',
  backgroundColor: 'var(--color-bg-body)',
  fontSize: '0.86rem', color: 'var(--color-text-main)',
  fontFamily: 'var(--font-family)', outline: 'none'
};
