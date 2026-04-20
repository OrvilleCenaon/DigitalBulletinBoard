// ================= GLOBALS =================
let posts = [];
let currentFilter = "all";
let isAdminAuthenticated = false;
let currentAdmin = null;
let likedPosts = JSON.parse(localStorage.getItem("likedPosts") || "[]");

// ================= ORG BADGE COLORS =================
const ORG_COLORS = {
  "Central Student Government":                  "#1565c0",
  "The Flare":                                   "#6a1b9a",
  "Honor Society":                               "#f9a825",
  "Computer Science Clique":                     "#00838f",
  "Sinag-Tala":                                  "#e65100",
  "Builders of Innovative Technologist Society": "#2e7d32",
  "Business Management Society":                 "#4527a0",
  "Cavite Communicators":                        "#ad1457",
  "Circle of Hospitality and Tourism Students":  "#00695c",
  "Cavite Young Leaders for Entrepreneurship":   "#c62828",
  "Educators' Guild for Excellence":             "#4e342e",
  "Samahan ng mga Magaaral ng Sikolohiya":       "#283593",
  "Young Office Professional Advocates":         "#558b2f",
};

function getOrgColor(org) {
  return ORG_COLORS[org] || "#555";
}

// ================= HAMBURGER NAV =================
function toggleNav() {
  const nav = document.getElementById("topbar-nav");
  const overlay = document.getElementById("nav-overlay");
  const hamburger = document.getElementById("hamburger");
  const open = nav.classList.toggle("open");
  overlay.classList.toggle("show", open);
  hamburger.classList.toggle("active", open);
}

function closeNav() {
  document.getElementById("topbar-nav").classList.remove("open");
  document.getElementById("nav-overlay").classList.remove("show");
  document.getElementById("hamburger").classList.remove("active");
}

// ================= PAGE SWITCH =================
function switchPage(page, btn) {
  if (page === "admin" && !isAdminAuthenticated) {
    openAdminLogin();
    closeNav();
    return;
  }

  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.getElementById(page).classList.add("active");

  document.querySelectorAll(".topbar-nav button").forEach(b => b.classList.remove("active"));
  if (btn) btn.classList.add("active");

  closeNav();
}

// ================= LOAD POSTS =================
function loadPosts() {
  document.getElementById("feed-list").innerHTML = "<div class='loading'>Loading...</div>";

  db.collection("posts").orderBy("date", "desc").onSnapshot(snapshot => {
    posts = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      date: doc.data().date?.toDate()
    }));
    renderFeed();
    renderAdmin();
  });
}

// ================= SUBMIT POST =================
async function submitPost() {
  const title = val("title"),
        body = val("body"),
        org = document.getElementById("org").value,
        fb = val("fb"),
        submittedBy = val("submittedBy"),
        urgent = document.getElementById("urgent").checked;

  if (!title || !body || !org || !submittedBy) {
    showPopup("Fill all required fields", "error");
    return;
  }

  const submitBtn = document.querySelector(".btn-submit");
  submitBtn.disabled = true;
  submitBtn.textContent = "Submitting...";


  await db.collection("posts").add({
    title, body, org, fb, submittedBy,
    urgent,
    pinned: false,
    status: "pending",
    likes: 0,
    date: firebase.firestore.FieldValue.serverTimestamp()
  });

  showPopup("Submitted successfully!", "success");
  submitBtn.disabled = false;
  submitBtn.textContent = "Submit";

  // Reset form
  ["title", "body", "fb", "submittedBy"].forEach(id => document.getElementById(id).value = "");
  document.getElementById("org").value = "";
  document.getElementById("urgent").checked = false;
  document.getElementById("title-count").textContent = "";
  document.getElementById("body-count").textContent = "";
  renderPreview();
}

// ================= FILTER & SEARCH =================
function setFilter(org) {
  currentFilter = org;
  const q = document.querySelector(".search")?.value || "";
  renderFeed(q);
}

let timeout;
function handleSearch(v) {
  clearTimeout(timeout);
  timeout = setTimeout(() => renderFeed(v), 300);
}

// ================= SEE MORE / SEE LESS =================
const BODY_LIMIT = 200;

function toggleSeeMore(id) {
  const bodyEl = document.getElementById(`body-${id}`);
  const btnEl = document.getElementById(`seemore-${id}`);
  const post = posts.find(p => p.id === id);
  if (!post) return;

  if (btnEl.dataset.expanded === "true") {
    bodyEl.textContent = post.body.slice(0, BODY_LIMIT) + "…";
    btnEl.textContent = "See more";
    btnEl.dataset.expanded = "false";
  } else {
    bodyEl.textContent = post.body;
    btnEl.textContent = "See less";
    btnEl.dataset.expanded = "true";
  }
}

// ================= RENDER CARD =================
function renderCard(p, isAdmin = false) {
  const color = getOrgColor(p.org);
  const isLong = p.body && p.body.length > BODY_LIMIT;
  const bodyText = isLong ? p.body.slice(0, BODY_LIMIT) + "…" : (p.body || "");
  const cardId = p.id || "preview";

  return `
    <div class="card ${p.pinned ? 'pinned' : ''} ${p.urgent ? 'urgent' : ''}">

      <div class="card-tags">
        ${p.urgent ? '<span class="tag urgent">🚨 Urgent</span>' : ''}
        ${p.pinned ? '<span class="tag pinned">📌 Pinned</span>' : ''}
        <span class="org-badge" style="background:${color};">${p.org || 'Organization'}</span>
      </div>

      <h3 class="card-title">${p.title || ''}</h3>

      <p class="card-body" id="body-${cardId}">${bodyText}</p>
      ${isLong ? `<button class="see-more-btn" id="seemore-${cardId}" data-expanded="false" onclick="toggleSeeMore('${cardId}')">See more</button>` : ''}

      ${p.fb ? `<div class="card-link"><a href="${p.fb}" target="_blank">🔗 View Facebook Post</a></div>` : ''}
      <div class="card-meta">${p.submittedBy || ''} • ${timeAgo(p.date)}</div>

      <div class="card-actions">
        <button class="like-btn ${likedPosts.includes(p.id) ? 'liked' : ''}" onclick="likePost('${p.id}')">
          ❤️ ${p.likes || 0}
        </button>
        ${isAdmin ? `
          <div class="admin-actions">
            ${p.status === "pending" ? `<button class="btn btn-green" onclick="approve('${p.id}')">Approve</button>` : ""}
            <button class="btn btn-red" onclick="del('${p.id}')">Delete</button>
            <button class="btn btn-neutral" onclick="pin('${p.id}')">${p.pinned ? 'Unpin' : 'Pin'}</button>
          </div>
        ` : ""}
      </div>
    </div>
  `;
}

// ================= RENDER FEED =================
function renderFeed(query = "") {
  const q = query.toLowerCase();
  let list = posts.filter(p => p.status === "approved");
  list = list.filter(p =>
    (currentFilter === "all" || p.org === currentFilter) &&
    (p.title?.toLowerCase().includes(q) || p.body?.toLowerCase().includes(q))
  );

  list.sort((a, b) => {
    const pinDiff = (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
    if (pinDiff !== 0) return pinDiff;
    const urgentDiff = (b.urgent ? 1 : 0) - (a.urgent ? 1 : 0);
    if (urgentDiff !== 0) return urgentDiff;
    return (b.date?.getTime?.() || 0) - (a.date?.getTime?.() || 0);
  });

  document.getElementById("feed-list").innerHTML = list.length
    ? list.map(p => renderCard(p)).join("")
    : "<div class='card empty-state'>📭 No announcements yet.</div>";
}

// ================= RENDER ADMIN =================
function renderAdmin() {
  const pending = posts.filter(p => p.status === "pending");
  const approved = posts.filter(p => p.status === "approved");

  document.getElementById("admin-pending").innerHTML = pending.length
    ? pending.map(p => renderCard(p, true)).join("")
    : "<div class='card empty-state'>No pending posts.</div>";

  document.getElementById("admin-approved").innerHTML = approved.length
    ? approved.map(p => renderCard(p, true)).join("")
    : "<div class='card empty-state'>No approved posts.</div>";
}

// ================= ADMIN ACTIONS =================
function approve(id) { if (!isAdminAuthenticated) return; db.collection("posts").doc(id).update({ status: "approved" }); }
function del(id) { if (!isAdminAuthenticated) return; db.collection("posts").doc(id).delete(); }
function pin(id) {
  if (!isAdminAuthenticated) return;
  const p = posts.find(x => x.id === id);
  db.collection("posts").doc(id).update({ pinned: !p.pinned });
}

// ================= LIKE =================
function likePost(id) {
  if (likedPosts.includes(id)) return;
  db.collection("posts").doc(id).update({ likes: firebase.firestore.FieldValue.increment(1) });
  likedPosts.push(id);
  localStorage.setItem("likedPosts", JSON.stringify(likedPosts));
}

// ================= PREVIEW =================
function renderPreview() {
  const p = {
    id: "preview",
    title: val("title"),
    body: val("body"),
    org: document.getElementById("org").value,
    fb: val("fb"),
    submittedBy: val("submittedBy"),
    urgent: document.getElementById("urgent").checked,
    pinned: false,
    likes: 0,
    date: new Date()
  };

  document.getElementById("preview-container").innerHTML = (p.title || p.body) ? renderCard(p) : "";
}

// ================= POPUP =================
function showPopup(msg, type = "success") {
  const p = document.getElementById("popup");
  document.getElementById("popup-text").textContent = msg;
  p.classList.add("show");
  setTimeout(() => p.classList.remove("show"), 2000);
}

function closePopup() {
  document.getElementById("popup").classList.remove("show");
}

// ================= ADMIN LOGIN =================
function openAdminLogin() { document.getElementById("admin-login").classList.add("show"); }
function closeAdminLogin() { document.getElementById("admin-login").classList.remove("show"); }

const adminLoginModal = document.getElementById("admin-login");
adminLoginModal.addEventListener("click", e => {
  if (e.target === adminLoginModal) closeAdminLogin();
});

function loginAdmin() {
  const username = val("admin-username"), password = val("admin-pass");
  if (!username || !password) { showPopup("Fill both fields", "error"); return; }

  db.collection("admins").get().then(snapshot => {
    let found = false;
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.username === username && data.password === password) found = true;
    });
    if (found) {
      isAdminAuthenticated = true;
      currentAdmin = username;
      closeAdminLogin();
      switchPage("admin");
      showPopup(`Welcome, ${currentAdmin}!`);
    } else {
      showPopup("Wrong username or password", "error");
    }
  }).catch(err => { console.error(err); showPopup("Error logging in", "error"); });
}

function logoutAdmin() {
  isAdminAuthenticated = false;
  currentAdmin = null;
  showPopup("Logged out");
  switchPage("feed");
}

// ================= UTILITIES =================
function val(id) { return document.getElementById(id)?.value.trim() || ""; }

function timeAgo(date) {
  if (!date) return "just now";
  const diff = (new Date() - date) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return Math.floor(diff / 60) + "m ago";
  if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
  return Math.floor(diff / 86400) + "d ago";
}

// ================= INIT =================
loadPosts();
renderPreview();

["title", "body", "org", "fb", "submittedBy", "urgent"].forEach(id => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener(el.type === "checkbox" ? "change" : "input", renderPreview);
});
