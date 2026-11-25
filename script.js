(function () {
  'use strict';

  const STORAGE_KEY = 'auraHandmade_cart_v1';
  const SHIPPING_FEE = 25000;
  const FREE_SHIPPING_THRESHOLD = 300000;

  const products = Array.isArray(window.AURA_PRODUCTS) ? window.AURA_PRODUCTS : [];
  let activeCategory = 'all';
  let cart = loadCart();
  let toastTimer = null;

  // Tham chiếu phần tử DOM
  const productGrid = document.getElementById('product-grid');
  const filterButtons = document.querySelectorAll('.filter-btn');
  const headerCartCount = document.getElementById('header-cart-count');
  const checkoutItemBadge = document.getElementById('checkout-item-badge');

  const pageCartItems = document.getElementById('page-cart-items');
  const drawerCartItems = document.getElementById('drawer-cart-items');
  const freeShipBanner = document.getElementById('free-ship-banner');
  const drawerFreeShip = document.getElementById('drawer-free-ship');

  const pageSubtotalEl = document.getElementById('page-subtotal');
  const pageShippingEl = document.getElementById('page-shipping');
  const pageTotalEl = document.getElementById('page-total');

  const drawerSubtotalEl = document.getElementById('drawer-subtotal');
  const drawerShippingEl = document.getElementById('drawer-shipping');
  const drawerTotalEl = document.getElementById('drawer-total');

  const cartDrawer = document.getElementById('cart-drawer');
  const cartBackdrop = document.getElementById('cart-backdrop');
  const openCartBtn = document.getElementById('open-cart-btn');
  const heroOpenCartBtn = document.getElementById('hero-open-cart');
  const closeCartBtn = document.getElementById('close-cart-btn');
  const drawerCheckoutBtn = document.getElementById('drawer-checkout-btn');

  const checkoutForm = document.getElementById('checkout-form');
  const nameInput = document.getElementById('customer-name');
  const phoneInput = document.getElementById('customer-phone');
  const addressInput = document.getElementById('customer-address');
  const noteInput = document.getElementById('customer-note');
  const consentCheckbox = document.getElementById('consent-checkbox');
  const formError = document.getElementById('form-error');
  const orderConfirmation = document.getElementById('order-confirmation');

  const toastEl = document.getElementById('toast');
  const toastMessageEl = document.getElementById('toast-message');
  const toastViewCartBtn = document.getElementById('toast-view-cart');

  // Định dạng giá tiền kiểu Việt Nam: 120.000đ
  function formatVND(amount) {
    const rounded = Math.max(0, Math.round(Number(amount) || 0));
    return String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + 'đ';
  }

  function escapeHTML(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function findProduct(productId) {
    return products.find((p) => p.id === productId);
  }

  function loadCart() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((item) => item && typeof item.id === 'string' && findProduct(item.id))
        .map((item) => ({
          id: item.id,
          quantity: Math.max(1, Math.min(99, parseInt(item.quantity, 10) || 1))
        }));
    } catch {
      return [];
    }
  }

  function saveCart() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // Bỏ qua nếu trình duyệt chặn localStorage
    }
  }

  function calculateTotals() {
    let totalItems = 0;
    let subtotal = 0;

    cart.forEach((item) => {
      const product = findProduct(item.id);
      if (!product) return;
      totalItems += item.quantity;
      subtotal += product.price * item.quantity;
    });

    const shippingFee =
      subtotal === 0 ? 0 : subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
    const finalTotal = subtotal + shippingFee;
    const remaining = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);

    return { totalItems, subtotal, shippingFee, finalTotal, remaining };
  }

  // Hiển thị danh sách sản phẩm theo bộ lọc
  function renderProducts() {
    const filtered =
      activeCategory === 'all'
        ? products
        : products.filter((p) => p.category === activeCategory);

    productGrid.innerHTML = filtered
      .map(
        (product) => `
        <article class="product-card">
          <div class="product-visual" style="background: ${product.bgGradient};">
            <span class="product-badge">${escapeHTML(product.badge)}</span>
            <span class="product-emoji" role="img" aria-label="${escapeHTML(product.name)}">${product.emoji}</span>
          </div>
          <div class="product-body">
            <span class="product-category">${escapeHTML(product.category)}</span>
            <h3 class="product-title">${escapeHTML(product.name)}</h3>
            <p class="product-desc">${escapeHTML(product.description)}</p>
            <div class="product-footer">
              <span class="product-price">${formatVND(product.price)}</span>
              <button type="button" class="add-to-cart-btn" data-add-id="${escapeHTML(product.id)}">
                Thêm vào giỏ
              </button>
            </div>
          </div>
        </article>
      `
      )
      .join('');
  }

  // Tạo HTML danh sách sản phẩm trong giỏ (dùng chung cho cả Drawer và trang Đặt hàng)
  function buildCartMarkup() {
    if (cart.length === 0) {
      return `
        <div class="cart-empty">
          <p>Giỏ hàng của bạn đang trống.</p>
          <a href="#san-pham" class="btn btn-secondary" data-close-on-browse="true">Chọn sản phẩm thủ công</a>
        </div>
      `;
    }

    return cart
      .map((item) => {
        const product = findProduct(item.id);
        if (!product) return '';
        const lineTotal = product.price * item.quantity;

        return `
          <div class="cart-item" data-item-id="${escapeHTML(product.id)}">
            <div class="cart-item-thumb" style="background: ${product.bgGradient};" aria-hidden="true">
              ${product.emoji}
            </div>
            <div class="cart-item-info">
              <div class="cart-item-name">${escapeHTML(product.name)}</div>
              <div class="cart-item-unit">${formatVND(product.price)} × ${item.quantity} = <strong>${formatVND(lineTotal)}</strong></div>
            </div>
            <div class="cart-item-actions">
              <div class="qty-control" aria-label="Điều chỉnh số lượng ${escapeHTML(product.name)}">
                <button type="button" class="qty-btn" data-qty-action="dec" data-id="${escapeHTML(product.id)}" aria-label="Giảm số lượng">−</button>
                <span class="qty-val">${item.quantity}</span>
                <button type="button" class="qty-btn" data-qty-action="inc" data-id="${escapeHTML(product.id)}" aria-label="Tăng số lượng">+</button>
              </div>
              <button type="button" class="remove-btn" data-remove-id="${escapeHTML(product.id)}">Xóa món</button>
            </div>
          </div>
        `;
      })
      .join('');
  }

  function updateShippingHint(el, totals) {
    if (totals.subtotal === 0) {
      el.classList.remove('is-free');
      el.innerHTML =
        'Phí giao hàng <strong>25.000đ</strong> — <strong>Miễn phí</strong> cho đơn từ <strong>300.000đ</strong>.';
      return;
    }

    if (totals.remaining === 0) {
      el.classList.add('is-free');
      el.innerHTML = '🎉 Đơn hàng của bạn đã đủ điều kiện <strong>Miễn phí giao hàng</strong>!';
    } else {
      el.classList.remove('is-free');
      el.innerHTML = `Mua thêm <strong>${formatVND(totals.remaining)}</strong> để được <strong>Miễn phí giao hàng</strong>.`;
    }
  }

  function renderCart() {
    const totals = calculateTotals();
    const cartMarkup = buildCartMarkup();
    const shippingText =
      totals.subtotal === 0
        ? '0đ'
        : totals.shippingFee === 0
        ? 'Miễn phí (0đ)'
        : formatVND(totals.shippingFee);

    headerCartCount.textContent = String(totals.totalItems);
    checkoutItemBadge.textContent = `${totals.totalItems} sản phẩm`;

    pageCartItems.innerHTML = cartMarkup;
    drawerCartItems.innerHTML = cartMarkup;

    updateShippingHint(freeShipBanner, totals);
    updateShippingHint(drawerFreeShip, totals);

    pageSubtotalEl.textContent = formatVND(totals.subtotal);
    pageShippingEl.textContent = shippingText;
    pageTotalEl.textContent = formatVND(totals.finalTotal);

    drawerSubtotalEl.textContent = formatVND(totals.subtotal);
    drawerShippingEl.textContent = shippingText;
    drawerTotalEl.textContent = formatVND(totals.finalTotal);

    drawerCheckoutBtn.disabled = cart.length === 0;
  }

  function addToCart(productId) {
    const product = findProduct(productId);
    if (!product) return;

    const existing = cart.find((item) => item.id === productId);
    if (existing) {
      existing.quantity = Math.min(99, existing.quantity + 1);
    } else {
      cart.push({ id: productId, quantity: 1 });
    }

    saveCart();
    renderCart();
    showToast(`Đã thêm "${product.name}" vào giỏ`);
  }

  function updateQuantity(productId, delta) {
    const index = cart.findIndex((item) => item.id === productId);
    if (index === -1) return;

    const nextQty = cart[index].quantity + delta;
    if (nextQty <= 0) {
      cart.splice(index, 1);
    } else {
      cart[index].quantity = Math.min(99, nextQty);
    }

    saveCart();
    renderCart();
  }

  function removeFromCart(productId) {
    cart = cart.filter((item) => item.id !== productId);
    saveCart();
    renderCart();
  }

  function openDrawer() {
    toastEl.hidden = true;
    if (toastTimer) {
      clearTimeout(toastTimer);
      toastTimer = null;
    }
    cartBackdrop.hidden = false;
    cartDrawer.classList.add('is-open');
    cartDrawer.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeDrawer() {
    cartDrawer.classList.remove('is-open');
    cartDrawer.setAttribute('aria-hidden', 'true');
    cartBackdrop.hidden = true;
    document.body.style.overflow = '';
  }

  function showToast(message) {
    toastMessageEl.textContent = message;
    toastEl.hidden = false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.hidden = true;
    }, 3200);
  }

  function clearFieldErrors() {
    [nameInput, phoneInput, addressInput].forEach((el) => el.classList.remove('is-invalid'));
    formError.hidden = true;
    formError.textContent = '';
  }

  function showFormError(message, invalidField) {
    clearFieldErrors();
    formError.textContent = message;
    formError.hidden = false;
    if (invalidField) {
      invalidField.classList.add('is-invalid');
      invalidField.focus();
    }
  }

  function generateOrderCode() {
    const randomPart = Math.floor(100000 + Math.random() * 900000);
    return `AURA-${randomPart}`;
  }

  function handleCartContainerClick(event) {
    const qtyBtn = event.target.closest('[data-qty-action]');
    if (qtyBtn) {
      const id = qtyBtn.getAttribute('data-id');
      const action = qtyBtn.getAttribute('data-qty-action');
      updateQuantity(id, action === 'inc' ? 1 : -1);
      return;
    }

    const removeBtn = event.target.closest('[data-remove-id]');
    if (removeBtn) {
      removeFromCart(removeBtn.getAttribute('data-remove-id'));
      return;
    }

    const browseLink = event.target.closest('[data-close-on-browse]');
    if (browseLink) {
      closeDrawer();
    }
  }

  // Gắn sự kiện bộ lọc sản phẩm
  filterButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      activeCategory = btn.getAttribute('data-category') || 'all';
      filterButtons.forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      renderProducts();
    });
  });

  // Gắn sự kiện thêm vào giỏ trên danh sách sản phẩm
  productGrid.addEventListener('click', (event) => {
    const addBtn = event.target.closest('[data-add-id]');
    if (!addBtn) return;
    addToCart(addBtn.getAttribute('data-add-id'));
  });

  pageCartItems.addEventListener('click', handleCartContainerClick);
  drawerCartItems.addEventListener('click', handleCartContainerClick);

  openCartBtn.addEventListener('click', openDrawer);
  heroOpenCartBtn.addEventListener('click', openDrawer);
  closeCartBtn.addEventListener('click', closeDrawer);
  cartBackdrop.addEventListener('click', closeDrawer);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && cartDrawer.classList.contains('is-open')) {
      closeDrawer();
    }
  });

  drawerCheckoutBtn.addEventListener('click', () => {
    closeDrawer();
    const targetSection = document.getElementById('dat-hang');
    if (targetSection) {
      targetSection.scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => nameInput.focus(), 300);
    }
  });

  toastViewCartBtn.addEventListener('click', () => {
    toastEl.hidden = true;
    openDrawer();
  });

  // Xử lý đặt hàng COD
  checkoutForm.addEventListener('submit', (event) => {
    event.preventDefault();
    clearFieldErrors();

    if (cart.length === 0) {
      showFormError('Giỏ hàng đang trống. Vui lòng thêm ít nhất 1 sản phẩm trước khi đặt hàng.');
      return;
    }

    const customerName = nameInput.value.trim();
    const rawPhone = phoneInput.value.trim();
    const normalizedPhone = rawPhone.replace(/[\s.-]/g, '');
    const customerAddress = addressInput.value.trim();
    const customerNote = noteInput.value.trim();

    if (customerName.length < 2) {
      showFormError('Vui lòng nhập họ và tên người nhận (ít nhất 2 ký tự).', nameInput);
      return;
    }

    if (!/^0\d{9}$/.test(normalizedPhone)) {
      showFormError(
        'Vui lòng nhập số điện thoại Việt Nam hợp lệ (10 chữ số, bắt đầu bằng số 0).',
        phoneInput
      );
      return;
    }

    if (customerAddress.length < 8) {
      showFormError(
        'Vui lòng nhập địa chỉ giao hàng chi tiết (số nhà, tên đường, phường/xã, quận/huyện).',
        addressInput
      );
      return;
    }

    if (!consentCheckbox.checked) {
      showFormError(
        'Vui lòng đánh dấu ô "Tôi đồng ý cho cửa hàng dùng thông tin này để giao hàng".',
        consentCheckbox
      );
      return;
    }

    const totals = calculateTotals();
    const orderedSummary = cart
      .map((item) => {
        const p = findProduct(item.id);
        return p ? `${p.name} (×${item.quantity})` : '';
      })
      .filter(Boolean)
      .join(', ');

    const orderCode = generateOrderCode();

    // Xóa giỏ hàng và cập nhật localStorage sau khi đặt đơn giả lập thành công
    cart = [];
    saveCart();
    renderCart();
    checkoutForm.reset();

    orderConfirmation.innerHTML = `
      <h3>🎉 Cảm ơn ${escapeHTML(customerName)} đã đặt hàng tại AuraHandmade!</h3>
      <div class="order-code-badge">Mã đơn hàng: ${escapeHTML(orderCode)}</div>
      <p>
        Đơn hàng mô phỏng của bạn đã được ghi nhận thành công và giỏ hàng đã được làm mới.
        (Lưu ý: <strong>Website thực hành – không bán hàng thật</strong>, không có hàng được giao đi).
      </p>
      <div class="order-meta">
        <p><strong>Sản phẩm đã chọn:</strong> ${escapeHTML(orderedSummary)}</p>
        <p><strong>Người nhận:</strong> ${escapeHTML(customerName)} — ${escapeHTML(normalizedPhone)}</p>
        <p><strong>Địa chỉ:</strong> ${escapeHTML(customerAddress)}</p>
        ${customerNote ? `<p><strong>Ghi chú:</strong> ${escapeHTML(customerNote)}</p>` : ''}
        <p><strong>Phương thức thanh toán:</strong> Thanh toán khi nhận hàng (COD)</p>
        <p><strong>Tổng tiền thanh toán:</strong> ${formatVND(totals.finalTotal)} (gồm phí giao hàng ${
      totals.shippingFee === 0 ? 'Miễn phí' : formatVND(totals.shippingFee)
    })</p>
      </div>
      <a href="#san-pham" class="btn btn-secondary">Tiếp tục xem sản phẩm</a>
    `;
    orderConfirmation.hidden = false;
    orderConfirmation.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  // Khởi tạo giao diện ban đầu
  renderProducts();
  renderCart();
})();
