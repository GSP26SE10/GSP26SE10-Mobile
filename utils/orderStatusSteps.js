/**
 * Ánh xạ orderStatus → bước progress 0..2 (Đang chuẩn bị / Đang diễn ra / Kết thúc).
 * 4 = chuẩn bị, 5 & 6 = đang diễn ra (6 = chờ thanh toán nốt), 7 = kết thúc.
 * @returns {number|null} null nếu không thuộc các mã trên (UI có thể fallback).
 */
export function getOrderStatusProgressStepIndex(orderStatus) {
  const n = Number(orderStatus);
  if (Number.isNaN(n)) return null;
  if (n === 4) return 0;
  if (n === 5 || n === 6) return 1;
  if (n === 7) return 2;
  return null;
}
