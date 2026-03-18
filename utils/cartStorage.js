import AsyncStorage from '@react-native-async-storage/async-storage';

const LEGACY_CART_KEY = 'cart';
const PARTIES_KEY_PREFIX = 'orderParties';
const ACTIVE_PARTY_KEY_PREFIX = 'activePartyId';

async function getCurrentUserId() {
  try {
    const raw = await AsyncStorage.getItem('userData');
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data?.userId ?? null;
  } catch {
    return null;
  }
}

async function getPartiesKey() {
  const userId = await getCurrentUserId();
  return userId ? `${PARTIES_KEY_PREFIX}:${userId}` : PARTIES_KEY_PREFIX;
}

async function getActivePartyKey() {
  const userId = await getCurrentUserId();
  return userId ? `${ACTIVE_PARTY_KEY_PREFIX}:${userId}` : ACTIVE_PARTY_KEY_PREFIX;
}

function makePartyId() {
  return `party-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

const formatPrice = (price) => {
  if (price == null) return '0₫';
  try {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(price);
  } catch (e) {
    return `${Number(price).toLocaleString('vi-VN')} đ`;
  }
};

async function migrateLegacyCartIfNeeded() {
  // Nếu trước đây app lưu theo key cart:<userId> hoặc 'cart', migrate sang parties (1 party).
  try {
    const partiesKey = await getPartiesKey();
    const existingPartiesRaw = await AsyncStorage.getItem(partiesKey);
    if (existingPartiesRaw) return;

    const userId = await getCurrentUserId();
    const legacyKey = userId ? `${LEGACY_CART_KEY}:${userId}` : LEGACY_CART_KEY;
    const legacyRaw = await AsyncStorage.getItem(legacyKey);
    if (!legacyRaw) return;
    const legacyItems = JSON.parse(legacyRaw);
    const items = Array.isArray(legacyItems) ? legacyItems : [];
    const partyId = makePartyId();
    const parties = [{ partyId, items }];
    await AsyncStorage.setItem(partiesKey, JSON.stringify(parties));
    await AsyncStorage.setItem(await getActivePartyKey(), partyId);
  } catch {
    // ignore
  }
}

export async function getOrderParties() {
  await migrateLegacyCartIfNeeded();
  try {
    const key = await getPartiesKey();
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function setOrderParties(parties) {
  try {
    const key = await getPartiesKey();
    await AsyncStorage.setItem(key, JSON.stringify(Array.isArray(parties) ? parties : []));
  } catch (e) {
    console.error('Failed to save order parties', e);
  }
}

export async function getActivePartyId() {
  await migrateLegacyCartIfNeeded();
  try {
    const key = await getActivePartyKey();
    const id = await AsyncStorage.getItem(key);
    return id || null;
  } catch {
    return null;
  }
}

export async function setActivePartyId(partyId) {
  try {
    const key = await getActivePartyKey();
    await AsyncStorage.setItem(key, String(partyId));
  } catch {
    // ignore
  }
}

async function ensureActiveParty(parties) {
  const list = Array.isArray(parties) ? parties : [];
  let activeId = await getActivePartyId();
  if (!list.length) {
    const partyId = makePartyId();
    const next = [{ partyId, items: [] }];
    await setOrderParties(next);
    await setActivePartyId(partyId);
    return { parties: next, activePartyId: partyId };
  }
  if (!activeId || !list.some((p) => p.partyId === activeId)) {
    activeId = list[0].partyId;
    await setActivePartyId(activeId);
  }
  return { parties: list, activePartyId: activeId };
}

async function normalizePartiesAndActive(parties, activePartyId) {
  const list = (Array.isArray(parties) ? parties : []).filter(
    (p) => Array.isArray(p?.items) && p.items.length > 0
  );
  if (!list.length) {
    const activeKey = await getActivePartyKey();
    await AsyncStorage.removeItem(activeKey);
    await setOrderParties([]);
    return { parties: [], activePartyId: null };
  }
  let nextActive = activePartyId;
  if (!nextActive || !list.some((p) => p.partyId === nextActive)) {
    nextActive = list[0].partyId;
    await setActivePartyId(nextActive);
  }
  await setOrderParties(list);
  return { parties: list, activePartyId: nextActive };
}

/**
 * Lấy toàn bộ giỏ hàng từ AsyncStorage.
 * @returns {Promise<Array>} Mảng item: { id, type, name, basePrice, priceFormatted, image, count }
 */
export async function getCart() {
  const parties = await getOrderParties();
  const ensured = await ensureActiveParty(parties);
  const active = ensured.parties.find((p) => p.partyId === ensured.activePartyId);
  return Array.isArray(active?.items) ? active.items : [];
}

/**
 * Ghi giỏ hàng vào AsyncStorage.
 * @param {Array} items
 */
export async function setCart(items) {
  const parties = await getOrderParties();
  const ensured = await ensureActiveParty(parties);
  const next = ensured.parties.map((p) =>
    p.partyId === ensured.activePartyId ? { ...p, items: Array.isArray(items) ? items : [] } : p
  );
  await normalizePartiesAndActive(next, ensured.activePartyId);
}

/**
 * Thêm menu vào giỏ (hoặc tăng số lượng nếu đã có).
 * Mỗi tiệc chỉ được 1 menu — nếu đã có menu khác sẽ trả { success: false }.
 * @param {object} menu - { menuId, menuName, basePrice, imgUrl, menuCategoryId?, buffetType? }
 * @returns {Promise<{ success: boolean, reason?: string, items: Array }>}
 */
export async function addMenuToCart(menu) {
  const items = await getCart();
  const id = `menu-${menu.menuId}`;
  const existing = items.find((i) => i.id === id);
  const otherMenu = items.find((i) => i.type === 'menu' && i.id !== id);

  if (otherMenu) {
    return { success: false, reason: 'DUPLICATE_MENU', items };
  }

  const priceFormatted = formatPrice(menu.basePrice);
  const imageArray = Array.isArray(menu.imgUrl) ? menu.imgUrl : null;
  const image = imageArray ? imageArray[0] : (menu.imgUrl || menu.image || '');
  const menuCategoryId = menu.menuCategoryId ?? null;
  const buffetType = menu.buffetType ?? null;

  if (existing) {
    existing.count += 1;
  } else {
    items.push({
      id,
      type: 'menu',
      menuId: menu.menuId,
      menuCategoryId,
      buffetType,
      name: menu.menuName || menu.name || 'Menu',
      basePrice: menu.basePrice ?? 0,
      priceFormatted,
      image,
      count: 1,
    });
  }
  await setCart(items);
  return { success: true, items };
}

/**
 * Thêm dịch vụ vào giỏ (hoặc tăng số lượng nếu đã có).
 * @param {object} service - { serviceId, serviceName, basePrice, image }
 * @returns {Promise<Array>} Giỏ hàng sau khi thêm
 */
export async function addServiceToCart(service) {
  const items = await getCart();
  const id = `service-${service.serviceId}`;
  const existing = items.find((i) => i.id === id);
  const priceFormatted = formatPrice(service.basePrice);
  const image = service.image || service.img || '';

  if (existing) {
    existing.count += 1;
  } else {
    items.push({
      id,
      type: 'service',
      serviceId: service.serviceId,
      name: service.serviceName || service.name || 'Dịch vụ',
      basePrice: service.basePrice ?? 0,
      priceFormatted,
      image,
      count: 1,
    });
  }
  await setCart(items);
  return items;
}

/**
 * Thêm món lẻ vào giỏ. Yêu cầu tiệc đã có menu.
 * Số lượng món lẻ tự đồng bộ theo số lượng menu.
 * @param {object} dish - { dishId, dishName, price, image, description, note, dishCategoryName }
 * @returns {Promise<{ success: boolean, reason?: string, items: Array }>}
 */
export async function addDishToCart(dish) {
  const items = await getCart();
  const menuItem = items.find((i) => i.type === 'menu');

  if (!menuItem) {
    return { success: false, reason: 'NO_MENU', items };
  }

  const menuCount = Number(menuItem.count ?? 1);
  const id = `dish-${dish.dishId}`;
  const existing = items.find((i) => i.id === id);
  const priceFormatted = formatPrice(dish.price);
  const image = dish.image || dish.img || '';

  if (existing) {
    existing.count = menuCount;
  } else {
    items.push({
      id,
      type: 'dish',
      dishId: dish.dishId,
      name: dish.dishName || dish.name || 'Món ăn',
      basePrice: dish.price ?? 0,
      priceFormatted,
      image,
      count: menuCount,
    });
  }
  await setCart(items);
  return { success: true, items };
}

/**
 * Cập nhật số lượng một item. Xóa nếu count <= 0.
 * @param {string} itemId - id trong giỏ (menu-1, service-2)
 * @param {number} delta - +1 hoặc -1
 * @returns {Promise<Array>} Giỏ hàng sau khi cập nhật
 */
export async function updateCartItemQuantity(itemId, delta) {
  const items = await getCart();
  const index = items.findIndex((i) => i.id === itemId);
  if (index === -1) return items;
  items[index].count += delta;
  if (items[index].count <= 0) {
    items.splice(index, 1);
  }
  await setCart(items);
  return items;
}

/**
 * Xóa một item khỏi giỏ.
 * @param {string} itemId
 * @returns {Promise<Array>} Giỏ hàng sau khi xóa
 */
export async function removeCartItem(itemId) {
  const items = await getCart();
  const filtered = items.filter((i) => i.id !== itemId);
  await setCart(filtered);
  return filtered;
}

/**
 * Xóa toàn bộ giỏ hàng.
 */
export async function clearCart() {
  // clear toàn bộ parties của user hiện tại
  await setOrderParties([]);
  const activeKey = await getActivePartyKey();
  await AsyncStorage.removeItem(activeKey);
}

export async function addParty() {
  const parties = await getOrderParties();
  const ensured = await ensureActiveParty(parties);
  const activeIdx = ensured.parties.findIndex((p) => p.partyId === ensured.activePartyId);
  const insertAt = activeIdx >= 0 ? activeIdx + 1 : ensured.parties.length;
  const partyId = makePartyId();
  const next = [
    ...ensured.parties.slice(0, insertAt),
    { partyId, items: [] },
    ...ensured.parties.slice(insertAt),
  ];
  await setOrderParties(next);
  await setActivePartyId(partyId);
  return { parties: next, partyId, index: insertAt };
}

export async function setActivePartyByIndex(index) {
  const parties = await getOrderParties();
  const p = parties[index];
  if (!p?.partyId) return null;
  await setActivePartyId(p.partyId);
  return p.partyId;
}
