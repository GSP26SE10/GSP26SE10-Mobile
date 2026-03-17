import AsyncStorage from '@react-native-async-storage/async-storage';

const CART_KEY = 'cart';

async function getCurrentUserCartKey() {
  try {
    const raw = await AsyncStorage.getItem('userData');
    if (!raw) return CART_KEY;
    const data = JSON.parse(raw);
    const userId = data?.userId;
    if (!userId) return CART_KEY;
    return `${CART_KEY}:${userId}`;
  } catch {
    return CART_KEY;
  }
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

/**
 * Lấy toàn bộ giỏ hàng từ AsyncStorage.
 * @returns {Promise<Array>} Mảng item: { id, type, name, basePrice, priceFormatted, image, count }
 */
export async function getCart() {
  try {
    const key = await getCurrentUserCartKey();
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

/**
 * Ghi giỏ hàng vào AsyncStorage.
 * @param {Array} items
 */
export async function setCart(items) {
  try {
    const key = await getCurrentUserCartKey();
    await AsyncStorage.setItem(key, JSON.stringify(items));
  } catch (e) {
    console.error('Failed to save cart', e);
  }
}

/**
 * Thêm menu vào giỏ (hoặc tăng số lượng nếu đã có).
 * @param {object} menu - { menuId, menuName, basePrice, imgUrl, menuCategoryId?, buffetType? }
 * @returns {Promise<Array>} Giỏ hàng sau khi thêm
 */
export async function addMenuToCart(menu) {
  const items = await getCart();
  const id = `menu-${menu.menuId}`;
  const existing = items.find((i) => i.id === id);
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
  return items;
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
  await setCart([]);
}
