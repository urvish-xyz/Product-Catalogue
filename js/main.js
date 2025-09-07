/**
 * js/main.js
 * Product list page logic:
 *  - fetch products.json
 *  - render product cards
 *  - search (debounced) and sort
 *  - accessibility enhancements and keyboard handlers
 *  - graceful error handling with retry
 */

const PRODUCTS_URL = "data/products.json";
const MERCHANT_EMAIL = "urvish.entp@gmail.com"; // Replace with your actual email address
const productsContainer = document.getElementById("products");
const searchInput = document.getElementById("search");
const sortSelect = document.getElementById("sort");
const msgEl = document.getElementById("msg");
const themeToggle = document.getElementById("theme-toggle");

let products = []; // in-memory cache of all products
let lastRendered = []; // currently rendered list (for testing/checking)
const FETCH_TIMEOUT = 8000; // ms
const MAX_RETRIES = 1; // simple retry count

/* -------------------- Utilities -------------------- */

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

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(props).forEach(([k, v]) => {
    if (k === "className") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else node.setAttribute(k, v);
  });
  children.flat().forEach((c) => {
    if (typeof c === "string") node.appendChild(document.createTextNode(c));
    else if (c instanceof Node) node.appendChild(c);
  });
  return node;
}

function safeFetch(url, options = {}, timeout = FETCH_TIMEOUT) {
  // fetch with timeout
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

// Debounce to avoid excessive filtering on input
function debounce(fn, wait = 250) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

/* -------------------- Contact link builders -------------------- */

function makeWhatsAppLink(p) {
  // If you have a merchant number, replace phone = '91XXXXXXXXXX'
  const phone = "916353288843"; // leave blank to let user select; or add merchant number
  const productUrl = `${window.location.origin}/product.html?id=${p.id}`;
  const msg = `Hello, I'm interested in ${p.name} (ID: ${p.id}). Is it available?\n\nProduct Link: ${productUrl}`;
  // wa.me expects numbers only if you include phone; if phone blank, use https://wa.me/?text=
  if (phone) return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
  return `https://wa.me/?text=${encodeURIComponent(msg)}`;
}

function makeEmailLink(p) {
  const subject = `Product enquiry: ${p.name}`;
  const productUrl = `${window.location.origin}/product.html?id=${p.id}`;
  const body = `Hi,%0D%0A%0D%0AI am interested in ${p.name} (ID: ${p.id}). Please share availability and pricing.%0D%0A%0D%0AProduct Link: ${productUrl}%0D%0A%0D%0AThanks.`;
  return `mailto:${MERCHANT_EMAIL}?subject=${encodeURIComponent(
    subject
  )}&body=${body}`;
}

/* -------------------- Rendering -------------------- */

function createCard(p) {
  const img = el("img", {
    src: p.image || "images/placeholder.png",
    alt: p.name,
    loading: "lazy",
  });
  // fallback if image fails
  img.addEventListener("error", () => {
    img.src = "images/placeholder.png";
  });

  const titleLink = el(
    "a",
    {
      href: `product.html?id=${encodeURIComponent(p.id)}`,
      className: "product-link",
      "aria-label": `Open details for ${p.name}`,
    },
    [p.name]
  );
  const h3 = el("h3", { id: `p-${p.id}-title` }, [titleLink]);

  const priceContent = [];
  if (p.old_price) {
    priceContent.push(
      el("span", { className: "old-price" }, [formatINR(p.old_price)])
    );
  }
  priceContent.push(
    el("span", { className: "current-price" }, [formatINR(p.price)])
  );
  if (p.old_price) {
    const discountPercent = Math.round(
      ((p.old_price - p.price) / p.old_price) * 100
    );
    priceContent.push(
      el("span", { className: "discount" }, [`${discountPercent}% off`])
    );
  }
  const price = el("div", { className: "price" }, priceContent);
  const specs = el("div", {
    className: "specs",
    html: `<div class="small">Slots: ${p.slots} • Finish: ${p.finish}</div><div class="small">${p.description}</div>`,
  });

  const readBtn = el(
    "a",
    {
      href: `product.html?id=${encodeURIComponent(p.id)}`,
      className: "btn btn-read",
    },
    ["Read More"]
  );
  const waBtn = el(
    "a",
    {
      href: makeWhatsAppLink(p),
      target: "_blank",
      rel: "noopener",
      className: "btn btn-contact",
    },
    ["WhatsApp"]
  );
  const emailBtn = el("a", { href: makeEmailLink(p), className: "btn" }, [
    "Email",
  ]);

  const actions = el("div", { className: "actions" }, [
    readBtn,
    waBtn,
    emailBtn,
  ]);

  const article = el(
    "article",
    { className: "card", tabindex: "0", "aria-labelledby": `p-${p.id}-title` },
    [img, h3, price, specs, actions]
  );

  // Open link on Enter when article is focused
  article.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const link = article.querySelector("a.product-link");
      if (link) link.click();
    }
  });

  return article;
}

function renderList(list) {
  lastRendered = list.slice(); // copy for any automated check
  productsContainer.innerHTML = "";
  if (!list || list.length === 0) {
    productsContainer.innerHTML =
      '<p class="msg">No products match your search.</p>';
    return;
  }
  const frag = document.createDocumentFragment();
  list.forEach((p) => frag.appendChild(createCard(p)));
  productsContainer.appendChild(frag);
}

/* -------------------- Filtering & Sorting -------------------- */

function applyFilters() {
  const q = (searchInput.value || "").trim().toLowerCase();
  let filtered = products.filter((p) => {
    if (!q) return true;
    const inName = String(p.name || "")
      .toLowerCase()
      .includes(q);
    const inFinish = String(p.finish || "")
      .toLowerCase()
      .includes(q);
    const inSlots = String(p.slots || "")
      .toLowerCase()
      .includes(q);
    return inName || inFinish || inSlots;
  });

  const sortVal = sortSelect.value;
  if (sortVal === "price-asc")
    filtered.sort((a, b) => Number(a.price) - Number(b.price));
  else if (sortVal === "price-desc")
    filtered.sort((a, b) => Number(b.price) - Number(a.price));
  else if (sortVal === "slots-asc")
    filtered.sort((a, b) => Number(a.slots) - Number(b.slots));
  else if (sortVal === "slots-desc")
    filtered.sort((a, b) => Number(b.slots) - Number(a.slots));
  // default or 'relevance' keep original order

  renderList(filtered);
}

/* -------------------- Fetching -------------------- */

async function fetchProductsWithRetry(retries = MAX_RETRIES) {
  msgEl.textContent = "Loading products...";
  msgEl.setAttribute("aria-hidden", "false");

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await safeFetch(
        PRODUCTS_URL,
        { cache: "no-cache" },
        FETCH_TIMEOUT
      );
      if (!res.ok)
        throw new Error("Network response was not ok: " + res.status);
      const json = await res.json();
      if (!Array.isArray(json))
        throw new Error("Invalid data format: expected array");
      products = json;
      msgEl.textContent = "";
      msgEl.setAttribute("aria-hidden", "true");
      renderList(products);
      return;
    } catch (err) {
      console.warn(`Fetch attempt ${attempt + 1} failed:`, err);
      if (attempt === retries) {
        msgEl.textContent = "Sorry — could not load products at this time.";
        msgEl.setAttribute("aria-hidden", "false");
        productsContainer.innerHTML =
          '<p class="msg">Unable to load products. Please try again later.</p>';
      } else {
        // small delay before retry
        await new Promise((r) => setTimeout(r, 500));
      }
    }
  }
}

/* -------------------- Theme Toggle -------------------- */

function setTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("theme", theme);
  themeToggle.textContent = theme === "dark" ? "☀️" : "🌙";
}

function toggleTheme() {
  const current =
    document.documentElement.getAttribute("data-theme") || "light";
  const newTheme = current === "dark" ? "light" : "dark";
  setTheme(newTheme);
}

function initTheme() {
  const saved = localStorage.getItem("theme") || "light";
  setTheme(saved);
  themeToggle.addEventListener("click", toggleTheme);
}

/* -------------------- Footer & Init -------------------- */

function updateFooter() {
  const y = new Date().getFullYear();
  const el = document.getElementById("copyright");
  if (el) el.textContent = `© ${y} Your Company. All rights reserved.`;
}

function init() {
  // Event listeners
  searchInput.addEventListener(
    "input",
    debounce(() => applyFilters(), 250)
  );
  sortSelect.addEventListener("change", applyFilters);

  // Accessibility: allow focusing controls with keyboard easily
  searchInput.setAttribute(
    "aria-label",
    "Search products by name, slots, or finish"
  );
  sortSelect.setAttribute("aria-label", "Sort products");

  // Fetch data
  fetchProductsWithRetry();

  // Footer
  updateFooter();

  // Theme
  initTheme();
}

document.addEventListener("DOMContentLoaded", init);
