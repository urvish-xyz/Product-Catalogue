/**
 * js/product.js
 * Product detail page:
 *  - reads ?id= from URL
 *  - fetches data source (data/products.json)
 *  - renders product or "not found" message
 *  - handles errors and accessibility
 */

const PRODUCT_URL = "data/products.json";
const MERCHANT_EMAIL = "urvish.entp@gmail.com"; // Replace with your actual email address
const detailEl = document.getElementById("product-detail");
const FETCH_TIMEOUT = 8000;
const themeToggle = document.getElementById("theme-toggle");

function safeFetch(url, options = {}, timeout = FETCH_TIMEOUT) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Request timed out")),
      timeout
    );
    fetch(url, options)
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

function getParam(name) {
  const params = new URLSearchParams(location.search);
  return params.get(name);
}

function setTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("theme", theme);
  const themeToggle = document.getElementById("theme-toggle");
  if (themeToggle) themeToggle.textContent = theme === "dark" ? "☀️" : "🌙";
  // Change logo based on theme
  const logo = document.getElementById("site-logo");
  if (logo) {
    logo.src =
      theme === "dark"
        ? "images/urVish logo V dark.png"
        : "images/urVish logo V light.png";
  }
}

function formatINR(n) {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(n);
  } catch (e) {
    return "₹" + Number(n).toFixed(2);
  }
}

function makeWhatsAppLink(p) {
  const phone = "916353288843"; // add merchant number if you have one
  const productUrl = window.location.href;
  const msg = `Hello, I'm interested in ${p.name} (ID: ${p.id}). Is it available?\n\nProduct Link: ${productUrl}`;
  if (phone) return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
  return `https://wa.me/?text=${encodeURIComponent(msg)}`;
}

function makeEmailLink(p) {
  const subject = `Enquiry: ${p.name}`;
  const productUrl = window.location.href;
  const body = `Hi,%0D%0A%0D%0AI would like more information about ${p.name} (ID: ${p.id}).%0D%0A%0D%0AProduct Link: ${productUrl}%0D%0A%0D%0AThanks.`;
  return `mailto:${MERCHANT_EMAIL}?subject=${encodeURIComponent(
    subject
  )}&body=${body}`;
}

function renderNotFound() {
  detailEl.innerHTML = `<p class="msg">Product not found. Please check the link or return to <a href="index.html">catalog</a>.</p>`;
}

function renderProduct(p) {
  if (!p) return renderNotFound();

  // Handle multiple images or fallback to single image
  const images =
    Array.isArray(p.images) && p.images.length > 0
      ? p.images
      : [p.image || "images/placeholder.png"];
  const mainImgSrc = images[0];

  // Create main image
  const mainImg = `<img id="main-img" src="${mainImgSrc}" alt="${escapeHtml(
    p.name
  )}" loading="lazy" onerror="this.src='images/placeholder.png'">`;

  // Create thumbnails
  const thumbnailsHtml = images
    .map(
      (imgSrc, index) =>
        `<img class="thumbnail ${
          index === 0 ? "active" : ""
        }" src="${imgSrc}" alt="${escapeHtml(p.name)} - View ${
          index + 1
        }" data-index="${index}" loading="lazy" onerror="this.src='images/placeholder.png'">`
    )
    .join("");

  const imageGalleryHtml = `
    <div class="image-gallery">
      <div class="main-image">
        ${mainImg}
      </div>
      <div class="thumbnails">
        ${thumbnailsHtml}
      </div>
    </div>
  `;

  const specsHtml = Array.isArray(p.specifications)
    ? p.specifications.map((s) => `<li>${escapeHtml(s)}</li>`).join("")
    : "";

  const amazonHtml = p.amazon
    ? `<a class="amazon-link" target="_blank" rel="noopener" href="${escapeHtml(
        p.amazon
      )}">Buy on Amazon</a>`
    : "";

  detailEl.innerHTML = `
    <div class="top">
      ${imageGalleryHtml}
      <div class="product-meta">
        <h2>${escapeHtml(p.name)}</h2>
        <div class="price">
          ${
            p.old_price
              ? `<span class="old-price"><s>${formatINR(
                  p.old_price
                )}</s></span>`
              : ""
          }
          <span class="current-price">${formatINR(p.price)}</span>
          ${
            p.old_price
              ? `<span class="discount">${Math.round(
                  ((p.old_price - p.price) / p.old_price) * 100
                )}% off</span>`
              : ""
          }
        </div>
        <div class="specs small">Slots: ${escapeHtml(
          String(p.slots)
        )} • Finish: ${escapeHtml(p.finish)}</div>
        <p>${escapeHtml(p.description)}</p>
        <ul class="spec-list">
          ${specsHtml}
        </ul>
        ${amazonHtml}
        <div style="margin-top:1rem;display:flex;gap:0.5rem;flex-wrap:wrap">
          <a class="btn btn-contact" target="_blank" rel="noopener" href="${makeWhatsAppLink(
            p
          )}">WhatsApp</a>
          <a class="btn" href="${makeEmailLink(p)}">Email</a>
        </div>
      </div>
    </div>
  `;

  // Add event listeners for thumbnails
  setupThumbnailListeners(images);
}

function setupThumbnailListeners(images) {
  const mainImg = document.getElementById("main-img");
  const thumbnails = document.querySelectorAll(".thumbnail");

  thumbnails.forEach((thumbnail) => {
    thumbnail.addEventListener("click", function () {
      const index = parseInt(this.getAttribute("data-index"));
      const newSrc = images[index];

      // Update main image
      mainImg.src = newSrc;

      // Update active thumbnail
      thumbnails.forEach((t) => t.classList.remove("active"));
      this.classList.add("active");
    });
  });
}

// simple HTML escape to avoid accidental injection from JSON
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function loadAndRender() {
  const id = getParam("id");
  if (!id) {
    renderNotFound();
    return;
  }

  try {
    const res = await safeFetch(
      PRODUCT_URL,
      { cache: "no-cache" },
      FETCH_TIMEOUT
    );
    if (!res.ok) throw new Error("Network error: " + res.status);
    const list = await res.json();
    if (!Array.isArray(list)) throw new Error("Invalid data format");
    const p = list.find((x) => String(x.id) === String(id));
    renderProduct(p);
  } catch (err) {
    console.error(err);
    detailEl.innerHTML =
      '<p class="msg">Could not load product data. Try again later.</p>';
  }
}

/* -------------------- Theme Toggle -------------------- */

function toggleTheme() {
  const current =
    document.documentElement.getAttribute("data-theme") || "light";
  const newTheme = current === "dark" ? "light" : "dark";
  setTheme(newTheme);
}

function initTheme() {
  const saved = localStorage.getItem("theme") || "light";
  setTheme(saved);
  const themeToggle = document.getElementById("theme-toggle");
  if (themeToggle) themeToggle.addEventListener("click", toggleTheme);
}

function updateFooter() {
  const y = new Date().getFullYear();
  const el = document.getElementById("copyright-product");
  if (el) el.textContent = `© ${y} Your Company. All rights reserved.`;
}

// Initialize on DOM ready
document.addEventListener("DOMContentLoaded", () => {
  loadAndRender();
  updateFooter();
  initTheme();
});
