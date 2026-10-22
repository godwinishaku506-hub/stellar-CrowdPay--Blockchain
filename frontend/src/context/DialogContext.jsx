import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

const DialogContext = createContext(null);

const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function DialogProvider({ children }) {
  const { t } = useTranslation();
  const [dialog, setDialog] = useState(null);
  const [value, setValue] = useState('');
  const restoreRef = useRef(null);
  const inputRef = useRef(null);
  const confirmBtnRef = useRef(null);
  const dialogRef = useRef(null);

  const open = useCallback((kind, message, options = {}) => {
    restoreRef.current = document.activeElement;
    setValue(options.defaultValue || '');
    return new Promise((resolve) => setDialog({ kind, message, options, resolve }));
  }, []);

  const close = useCallback((result) => {
    setDialog((current) => {
      if (current) current.resolve(result);
      return null;
    });
    restoreRef.current?.focus?.();
  }, []);

  const confirm = useCallback((message, options) => open('confirm', message, options), [open]);
  const prompt = useCallback((message, options) => open('prompt', message, options), [open]);
  const alert = useCallback((message, options) => open('alert', message, options), [open]);

  // Memoised so consumers only re-render when the dialog state actually changes.
  const api = useMemo(() => ({ confirm, prompt, alert }), [confirm, prompt, alert]);

  useEffect(() => {
    if (!dialog) return undefined;

    const node = dialogRef.current;
    const initial =
      dialog.kind === 'prompt'
        ? node?.querySelector('input, textarea') || node?.querySelector(FOCUSABLE_SELECTOR)
        : confirmBtnRef.current || node?.querySelector(FOCUSABLE_SELECTOR);
    initial?.focus();

    function trapTab(e) {
      if (e.key !== 'Tab') return;
      const modal = dialogRef.current;
      if (!modal) return;
      const focusable = Array.from(modal.querySelectorAll(FOCUSABLE_SELECTOR)).filter((el) => !el.disabled);
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (e.shiftKey) {
        if (active === first || active === modal) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last || active === modal) {
        e.preventDefault();
        first.focus();
      }
    }

    function onKey(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (dialog.kind === 'prompt') close(null);
        else if (dialog.kind === 'alert') close(true);
        else close(false);
        return;
      }
      if (e.key === 'Tab') trapTab(e);
    }

    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [dialog, close]);

  function submit(e) {
    e.preventDefault();
    close(dialog.kind === 'prompt' ? value : true);
  }

  function cancel() {
    if (dialog.kind === 'prompt') close(null);
    else if (dialog.kind === 'alert') close(true);
    else close(false);
  }

  const confirmLabel =
    dialog.kind === 'alert'
      ? t('dialog.ok')
      : dialog.options?.confirmLabel || (dialog.kind === 'prompt' ? t('dialog.promptConfirm') : t('dialog.confirm'));
  const cancelLabel = dialog.options?.cancelLabel || t('common.cancel');

  return (
    <DialogContext.Provider value={api}>
      {children}
      {dialog && (
        <div
          className="modal-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 300,
          }}
          ref={dialogRef}
          role={dialog.kind === 'alert' ? 'alertdialog' : 'dialog'}
          aria-modal="true"
          aria-labelledby="app-dialog-message"
          onClick={(e) => {
            if (e.target === e.currentTarget) cancel();
          }}
        >
          <form
            onSubmit={submit}
            style={{
              background: 'var(--color-surface, #fff)',
              color: 'var(--color-text, inherit)',
              borderRadius: '10px',
              padding: '1.25rem',
              width: 'min(420px, 92vw)',
              display: 'grid',
              gap: '0.75rem',
            }}
          >
            {/* Rendered as a text node — never as HTML — so server messages are safe. */}
            <p id="app-dialog-message" style={{ margin: 0 }}>
              {dialog.message}
            </p>
            {dialog.kind === 'prompt' && (
              <input
                id="app-dialog-input"
                ref={inputRef}
                aria-labelledby="app-dialog-message"
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            )}
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              {dialog.kind !== 'alert' && (
                <button type="button" className="btn-secondary" onClick={cancel}>
                  {cancelLabel}
                </button>
              )}
              <button type="submit" className="btn-primary" ref={confirmBtnRef}>
                {confirmLabel}
              </button>
            </div>
          </form>
        </div>
      )}
    </DialogContext.Provider>
  );
}

export const useDialog = () => useContext(DialogContext);
