import React from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import './Pagination.css';

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

/**
 * Common, controlled pagination bar shared across all list pages.
 *
 * Renders: Rows: [select]   {start}–{end} of {total}   ‹  ›
 *
 * Works for both client-side (slice an in-memory array) and server-side
 * (drive an API `page`/`limit`) pagination — it is purely presentational.
 *
 * @param {number} page           Current 1-based page.
 * @param {number} pageSize       Rows per page.
 * @param {number} total          Total number of records across all pages.
 * @param {(page:number)=>void} onPageChange
 * @param {(size:number)=>void} [onPageSizeChange]  Omit to hide the rows dropdown.
 * @param {number[]} [pageSizeOptions]  Defaults to [10, 25, 50, 100].
 */
const Pagination = ({
  page = 1,
  pageSize = 25,
  total = 0,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  className = '',
}) => {
  if (!total) return null;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, total);

  const goPrev = () => {
    if (safePage > 1) onPageChange(safePage - 1);
  };
  const goNext = () => {
    if (safePage < totalPages) onPageChange(safePage + 1);
  };

  return (
    <div className={`pg-pagination ${className}`.trim()}>
      {onPageSizeChange && (
        <div className="pg-pagination__rows">
          <span className="pg-pagination__label">Rows:</span>
          <select
            className="pg-pagination__select"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            aria-label="Rows per page"
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      )}

      <span className="pg-pagination__info">
        {start}–{end} of {total}
      </span>

      <div className="pg-pagination__nav">
        <button
          type="button"
          className="pg-pagination__btn"
          onClick={goPrev}
          disabled={safePage <= 1}
          aria-label="Previous page"
        >
          <ChevronLeftIcon className="pg-pagination__icon" />
        </button>
        <button
          type="button"
          className="pg-pagination__btn"
          onClick={goNext}
          disabled={safePage >= totalPages}
          aria-label="Next page"
        >
          <ChevronRightIcon className="pg-pagination__icon" />
        </button>
      </div>
    </div>
  );
};

export default Pagination;
