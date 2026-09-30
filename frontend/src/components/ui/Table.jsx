import { useEffect, useMemo, useState } from 'react';
import styles from './Table.module.css';

export default function Table({
  columns,
  data,
  onRowClick,
  emptyMessage = 'No data found',
  searchable = false,
  searchKeys,
  searchPlaceholder = 'Search...',
  sortable = false,
  paginate = false,
  pageSize = 12,
}) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState(null);
  const [page, setPage] = useState(0);

  const searchFields = useMemo(() => {
    if (searchKeys && searchKeys.length) return new Set(searchKeys.map(String));
    return new Set(columns.map((c) => String(c.key)));
  }, [columns, searchKeys]);

  const filtered = useMemo(() => {
    let rows = Array.isArray(data) ? data : [];
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter((row) =>
        [...searchFields].some((k) => {
          const v = row[k];
          return v !== null && v !== undefined && String(v).toLowerCase().includes(q);
        })
      );
    }
    if (sort && sortable) {
      const col = columns.find((c) => String(c.key) === sort.key);
      const get = (row) => (col && typeof col.getValue === 'function' ? col.getValue(row) : row[sort.key]);
      rows = [...rows].sort((a, b) => {
        const av = get(a);
        const bv = get(b);
        if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * (sort.dir === 'asc' ? 1 : -1);
        return String(av ?? '').localeCompare(String(bv ?? ''), undefined, { numeric: true }) * (sort.dir === 'asc' ? 1 : -1);
      });
    }
    return rows;
  }, [data, search, searchFields, sort, sortable, columns]);

  useEffect(() => { setPage(0); }, [search, sort, data]);

  const pageCount = paginate ? Math.max(1, Math.ceil(filtered.length / pageSize)) : 1;
  const safePage = Math.min(page, pageCount - 1);
  const rows = paginate ? filtered.slice(safePage * pageSize, safePage * pageSize + pageSize) : filtered;

  const firstCol = columns[0];

  const renderSearch = () => (
    <div className={styles.toolbar}>
      <input
        type="search"
        className={styles.search}
        placeholder={searchPlaceholder}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {paginate && <span className={styles.count}>{filtered.length} result{filtered.length === 1 ? '' : 's'}</span>}
    </div>
  );

  if (!filtered || filtered.length === 0) {
    if (!searchable) {
      return (
        <div className={styles.empty}>
          <p>{emptyMessage}</p>
        </div>
      );
    }
    return (
      <div>
        {renderSearch()}
        <div className={styles.empty}>
          <p>{emptyMessage}</p>
        </div>
      </div>
    );
  }

  const toggleSort = (key) => {
    setSort((cur) => (cur && cur.key === key ? { key, dir: cur.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  };

  return (
    <div className={styles.wrapper}>
      {searchable && renderSearch()}
      <div className={styles.scroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{ width: col.width }}
                  className={`${col.align === 'right' ? styles.alignRight : ''} ${sortable && col.sortable !== false ? styles.sortable : ''}`}
                  onClick={() => { if (sortable && col.sortable !== false) toggleSort(String(col.key)); }}
                >
                  {col.label}
                  {sortable && col.sortable !== false && sort?.key === String(col.key) && (
                    <span className={styles.sortArrow}>{sort.dir === 'asc' ? '▲' : '▼'}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={row.id || i}
                onClick={() => onRowClick?.(row)}
                className={onRowClick ? styles.clickable : ''}
              >
                {columns.map((col) => (
                  <td key={col.key} className={col.align === 'right' ? styles.alignRight : ''}>
                    {col.render ? col.render(row[col.key], row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {paginate && pageCount > 1 && (
        <div className={styles.pager}>
          <button className={styles.pageBtn} onClick={() => setPage(0)} disabled={safePage === 0} aria-label="First page">«</button>
          <button className={styles.pageBtn} onClick={() => setPage((p) => p - 1)} disabled={safePage === 0} aria-label="Previous page">‹</button>
          <span className={styles.pageInfo}>{safePage + 1} / {pageCount}</span>
          <button className={styles.pageBtn} onClick={() => setPage((p) => p + 1)} disabled={safePage === pageCount - 1} aria-label="Next page">›</button>
          <button className={styles.pageBtn} onClick={() => setPage(pageCount - 1)} disabled={safePage === pageCount - 1} aria-label="Last page">»</button>
        </div>
      )}
    </div>
  );
}
