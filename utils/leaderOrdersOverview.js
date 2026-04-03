/**
 * Chuẩn hóa response GET /api/staff-group/leader/orders-overview
 * Hỗ trợ bản refactor (staffGroup + order lồng) và bản phẳng cũ.
 */

function normalizeTasksArray(tasks) {
  if (!Array.isArray(tasks)) return [];
  return tasks.map((t) => {
    if (!t || typeof t !== 'object') return t;
    let assigneeName = t.assigneeName || t.assignee;
    if (!assigneeName && Array.isArray(t.assignees) && t.assignees.length) {
      assigneeName = t.assignees
        .map((a) => (a && (a.staffName || `#${a.staffId}`)) || '')
        .filter(Boolean)
        .join(', ');
    }
    return { ...t, assigneeName };
  });
}

function pickImageUrl(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    const firstValid = value
      .map((v) => {
        if (typeof v === 'string') return v;
        if (v && typeof v === 'object') return v.url || v.uri || v.image || null;
        return null;
      })
      .find((v) => typeof v === 'string' && v.trim().length > 0);
    return firstValid || null;
  }
  if (value && typeof value === 'object') {
    return value.url || value.uri || value.image || null;
  }
  return null;
}

function flattenFromOrderDetails(order, orderDetail) {
  const detail = orderDetail || {};
  const menuSnapshot = detail.menuSnapshot || {};
  const detailMenu = detail.menu || {};

  return {
    ...order,
    ...detail,
    orderId: detail.orderId != null ? detail.orderId : order.orderId,
    orderDetailId: detail.orderDetailId,
    orderStatus: order.status != null ? order.status : detail.orderStatus,
    orderDetailStatus: detail.status != null ? detail.status : order.orderDetailStatus,
    totalPrice: detail.totalPrice != null ? detail.totalPrice : order.totalPrice,
    depositAmount: order.depositAmount != null ? order.depositAmount : detail.depositAmount,
    remainingAmount: order.remainingAmount != null ? order.remainingAmount : detail.remainingAmount,
    extraChargeTotal: detail.extraChargeCost != null ? detail.extraChargeCost : order.extraChargeTotal,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    menuName:
      detail.menuName != null
        ? detail.menuName
        : (menuSnapshot.menuName != null ? menuSnapshot.menuName : detailMenu.name),
    menuImage:
      detail.menuImage != null
        ? detail.menuImage
        : (pickImageUrl(menuSnapshot.imgUrl) || detailMenu.image || null),
    menuId: detail.menuId,
    partyCategory: detail.partyCategory != null ? detail.partyCategory : detail.partyCategoryName,
    numberOfGuests: detail.numberOfGuests,
    startTime: detail.startTime,
    endTime: detail.endTime,
    address: detail.address,
    tasks: normalizeTasksArray(detail.tasks || order.tasks),
  };
}

function flattenLeaderOrder(o) {
  if (!o || typeof o !== 'object') return o;

  const nested =
    o.menu != null ||
    o.schedule != null ||
    o.pricing != null ||
    o.customer != null ||
    o.party != null ||
    (o.status != null && typeof o.status === 'object' && !Array.isArray(o.status));

  if (!nested) {
    return { ...o, tasks: normalizeTasksArray(o.tasks) };
  }

  const status = o.status || {};
  const pricing = o.pricing || {};
  const customer = o.customer || {};
  const menu = o.menu || {};
  const party = o.party || {};
  const schedule = o.schedule || {};
  const menuSnapshot = o.menuSnapshot || {};

  return {
    ...o,
    orderId: o.orderId,
    orderDetailId: o.orderDetailId,
    orderStatus: status.order != null ? status.order : o.orderStatus,
    orderDetailStatus: status.orderDetail != null ? status.orderDetail : o.orderDetailStatus,
    totalPrice: pricing.totalPrice != null ? pricing.totalPrice : o.totalPrice,
    depositAmount: pricing.depositAmount != null ? pricing.depositAmount : o.depositAmount,
    remainingAmount: pricing.remainingAmount != null ? pricing.remainingAmount : o.remainingAmount,
    extraChargeTotal: pricing.extraChargeTotal != null ? pricing.extraChargeTotal : o.extraChargeTotal,
    customerName: customer.name != null ? customer.name : o.customerName,
    customerPhone: customer.phone != null ? customer.phone : o.customerPhone,
    menuName: menu.name != null ? menu.name : (o.menuName != null ? o.menuName : menuSnapshot.menuName),
    menuImage:
      menu.image != null
        ? menu.image
        : (o.menuImage != null ? o.menuImage : pickImageUrl(menuSnapshot.imgUrl)),
    menuId: menu.menuId != null ? menu.menuId : o.menuId,
    partyCategory: party.category != null ? party.category : o.partyCategory,
    numberOfGuests: party.numberOfGuests != null ? party.numberOfGuests : o.numberOfGuests,
    startTime: schedule.startTime != null ? schedule.startTime : o.startTime,
    endTime: schedule.endTime != null ? schedule.endTime : o.endTime,
    address: schedule.address != null ? schedule.address : o.address,
    tasks: normalizeTasksArray(o.tasks),
  };
}

/**
 * @param {object|null|undefined} data — body JSON từ orders-overview
 * @returns {{ staffGroupId, staffGroupName, leaderId, leaderName, members, orders }}
 */
export function normalizeLeaderOrdersOverviewApi(data) {
  if (!data || typeof data !== 'object') {
    return {
      staffGroupId: null,
      staffGroupName: null,
      leaderId: null,
      leaderName: null,
      members: [],
      orders: [],
    };
  }

  const sg = data.staffGroup || {};
  const ordersRaw = Array.isArray(data.orders) ? data.orders : [];

  const staffGroupId = sg.staffGroupId ?? data.staffGroupId ?? null;
  const staffGroupName = sg.staffGroupName ?? data.staffGroupName ?? null;
  const leaderId = sg.leader?.staffId ?? data.leaderId ?? null;
  const leaderName = sg.leader?.staffName ?? data.leaderName ?? null;
  const members = Array.isArray(sg.members)
    ? sg.members
    : Array.isArray(data.members)
      ? data.members
      : [];

  const orders = ordersRaw.flatMap((o) => {
    const details = Array.isArray(o?.orderDetails) ? o.orderDetails : null;
    if (details && details.length > 0) {
      return details.map((detail) => flattenFromOrderDetails(o, detail));
    }
    return [flattenLeaderOrder(o)];
  });

  return {
    staffGroupId,
    staffGroupName,
    leaderId,
    leaderName,
    members,
    orders,
  };
}
