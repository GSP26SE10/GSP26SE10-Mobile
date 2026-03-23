import API_URL from '../constants/api';

const authHeaders = (token) => ({
  'Content-Type': 'application/json',
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
});

/**
 * @param {string | null} token
 * @param {number} page
 * @param {number} pageSize
 */
export async function fetchMyNotificationsPage(token, page = 1, pageSize = 10) {
  const url = `${API_URL}/api/notification/my-notifications?page=${page}&pageSize=${pageSize}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: authHeaders(token),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    return {
      ok: false,
      items: [],
      totalCount: 0,
      page: 1,
      pageSize,
      totalPages: 1,
    };
  }
  return {
    ok: true,
    items: Array.isArray(json?.items) ? json.items : [],
    totalCount: Number(json?.totalCount ?? 0),
    page: Number(json?.page ?? page),
    pageSize: Number(json?.pageSize ?? pageSize),
    totalPages: Math.max(1, Number(json?.totalPages ?? 1)),
  };
}

/**
 * @param {string | null} token
 * @param {number} notificationId
 */
export async function markNotificationRead(token, notificationId) {
  const id = Number(notificationId);
  if (!Number.isFinite(id)) return false;
  const url = `${API_URL}/api/notification/${id}/read`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify({}),
  });
  return res.ok;
}

/**
 * Đếm thông báo chưa đọc (lướt hết trang, pageSize cố định để giảm số request).
 * @param {string | null} token
 * @param {number} pageSize
 * @param {number} maxPages
 */
export async function fetchUnreadNotificationsCount(token, pageSize = 50, maxPages = 30) {
  if (!token) return 0;
  let unread = 0;
  let page = 1;
  let totalPages = 1;
  do {
    const data = await fetchMyNotificationsPage(token, page, pageSize);
    if (!data.ok) break;
    for (const it of data.items) {
      if (it && it.isRead === false) unread += 1;
    }
    totalPages = data.totalPages;
    page += 1;
    if (page > totalPages || page > maxPages) break;
  } while (true);
  return unread;
}
