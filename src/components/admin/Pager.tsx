import Link from "next/link";

// Prev / next pagination that keeps the current filters in the query string.
export default function Pager({
  basePath,
  params,
  page,
  pageSize,
  total,
}: {
  basePath: string;
  params: Record<string, string | undefined>;
  page: number;
  pageSize: number;
  total: number;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize && page <= 1) return null;

  const href = (target: number) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value) query.set(key, value);
    }
    if (target > 1) query.set("page", String(target));
    const qs = query.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <nav className="adm-pager" aria-label="Pagination">
      <span>
        {total > 0 ? `${from}–${to} of ${total}` : "No results on this page"}
      </span>
      <div>
        {page > 1 ? (
          <Link href={href(page - 1)} className="adm-btn adm-btn-ghost">
            ← Prev
          </Link>
        ) : null}
        <span className="adm-pager-page">
          Page {page} of {pages}
        </span>
        {page < pages ? (
          <Link href={href(page + 1)} className="adm-btn adm-btn-ghost">
            Next →
          </Link>
        ) : null}
      </div>
    </nav>
  );
}
