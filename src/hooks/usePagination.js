import { useState, useMemo, useEffect } from 'react';

/**
 * Client-side pagination for list pages that already hold the full (filtered)
 * array in memory. Pairs with the common <Pagination> component.
 *
 *   const { pageItems, page, setPage, pageSize, setPageSize, total } =
 *     usePagination(filteredRows, 25);
 *
 * - Auto-clamps the current page when the source list shrinks (e.g. after a
 *   filter/search change), so you never land on an empty page.
 * - Returns `pageItems` to render and `total` for the pagination bar.
 *
 * @param {Array} items            The full list to paginate.
 * @param {number} [initialSize]   Initial rows per page (default 25).
 */
export default function usePagination(items, initialSize = 25) {
  const list = useMemo(() => (Array.isArray(items) ? items : []), [items]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialSize);

  const total = list.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Keep the page within bounds when the list or page size changes.
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return list.slice(start, start + pageSize);
  }, [list, page, pageSize]);

  const handleSetPageSize = (size) => {
    setPageSize(size);
    setPage(1);
  };

  return {
    pageItems,
    page,
    setPage,
    pageSize,
    setPageSize: handleSetPageSize,
    total,
    totalPages,
  };
}
