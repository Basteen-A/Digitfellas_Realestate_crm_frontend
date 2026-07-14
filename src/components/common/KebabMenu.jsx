import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { EllipsisVerticalIcon } from '@heroicons/react/24/outline';

/**
 * Overflow "kebab" (⋮) menu for row/list actions.
 * Collapses a set of action buttons into a single vertical-dots trigger + dropdown.
 * The dropdown renders in a portal with fixed positioning so it is never clipped by
 * a scrollable table/overflow container.
 *
 * items: Array<{ key, label, Icon?, onClick, color?, disabled? }>
 */
const MENU_WIDTH = 200;

const KebabMenu = ({ items = [], title = 'More actions', className = '' }) => {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  const place = () => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    let left = r.right - MENU_WIDTH;                 // right-align to the trigger
    if (left < 8) left = 8;                          // keep inside the viewport
    setCoords({ top: r.bottom + 4, left });
  };

  useLayoutEffect(() => { if (open) place(); }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (triggerRef.current?.contains(e.target) || menuRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const close = () => setOpen(false);
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const visible = items.filter(Boolean);
  if (!visible.length) return null;

  return (
    <div className={`kebab-menu ${className}`}>
      <button
        type="button"
        ref={triggerRef}
        className="kebab-menu__trigger"
        title={title}
        aria-label={title}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
      >
        <EllipsisVerticalIcon style={{ width: 16, height: 16 }} />
      </button>
      {open && createPortal(
        <div
          ref={menuRef}
          className="kebab-menu__dropdown"
          role="menu"
          style={{ position: 'fixed', top: coords.top, left: coords.left, width: MENU_WIDTH }}
          onClick={(e) => e.stopPropagation()}
        >
          {visible.map((it) => (
            <button
              key={it.key || it.label}
              type="button"
              role="menuitem"
              className="kebab-menu__item"
              disabled={it.disabled}
              style={it.color ? { color: it.color } : undefined}
              onClick={(e) => { e.stopPropagation(); setOpen(false); it.onClick?.(e); }}
            >
              {it.Icon && <it.Icon style={{ width: 15, height: 15, flexShrink: 0 }} />}
              <span>{it.label}</span>
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
};

export default KebabMenu;
