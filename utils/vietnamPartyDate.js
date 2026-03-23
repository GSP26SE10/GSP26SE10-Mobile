/**
 * Ràng buộc đặt tiệc: ngày tổ chức (theo lịch Việt Nam) phải cách hôm nay ít nhất 2 ngày.
 * Khớp message backend: "First party date must be at least 2 days from today (Vietnam time)."
 */

const VIETNAM_TZ = 'Asia/Ho_Chi_Minh';

/** @param {Date} d */
export function toVietnamDateKey(d) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: VIETNAM_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function parseYmd(key) {
  const [y, m, day] = key.split('-').map(Number);
  return { y, m, d: day };
}

/** Cộng N ngày theo lịch Gregorian (VN không DST). */
function addCalendarDaysYmd(y, m, d, deltaDays) {
  const t = Date.UTC(y, m - 1, d + deltaDays);
  const nd = new Date(t);
  return {
    y: nd.getUTCFullYear(),
    m: nd.getUTCMonth() + 1,
    d: nd.getUTCDate(),
  };
}

/** Ngày tối thiểu được phép đặt (YYYY-MM-DD theo giờ VN) = hôm nay (VN) + 2 ngày. */
export function getMinPartyDateKeyVietnam(now = new Date()) {
  const todayKey = toVietnamDateKey(now);
  const { y, m, d } = parseYmd(todayKey);
  const next = addCalendarDaysYmd(y, m, d, 2);
  return `${String(next.y).padStart(4, '0')}-${String(next.m).padStart(2, '0')}-${String(next.d).padStart(2, '0')}`;
}

/** Date local để gán state / DateTimePicker (trưa để tránh lệch ngày). */
export function dateFromYmdLocal(y, m, d, hour = 12, minute = 0) {
  return new Date(y, m - 1, d, hour, minute, 0, 0);
}

export function getMinPartyDateObject(now = new Date()) {
  const key = getMinPartyDateKeyVietnam(now);
  const { y, m, d } = parseYmd(key);
  return dateFromYmdLocal(y, m, d, 12, 0);
}

/** Thời điểm bắt đầu tiệc có ngày (theo VN) >= ngày tối thiểu không? */
export function isPartyStartAtLeastTwoDaysFromTodayVietnam(start, now = new Date()) {
  if (!start) return false;
  const d = typeof start === 'string' ? new Date(start) : start;
  if (Number.isNaN(d.getTime())) return false;
  const startKey = toVietnamDateKey(d);
  const minKey = getMinPartyDateKeyVietnam(now);
  return startKey >= minKey;
}
