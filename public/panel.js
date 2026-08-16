const TOKEN_KEY = "motor_de_frete_token";
const USER_KEY = "motor_de_frete_user";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser() {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function setSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

/** Redireciona pro login se não houver sessão. Chamar no topo de cada página protegida. */
export function requireAuth() {
  if (!getToken()) {
    window.location.href = "/painel/login.html";
  }
}

export async function authFetch(path, options = {}) {
  const token = getToken();
  const headers = { ...(options.headers || {}) };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(path, { ...options, headers });

  if (res.status === 401) {
    clearSession();
    window.location.href = "/painel/login.html";
    throw new Error("Sessão expirada.");
  }

  return res;
}

export function renderSidebar(activePage) {
  const user = getUser();
  const isAdmin = user?.role === "admin";
  const links = [
    { href: "/painel/regras.html", label: "Regras de frete", page: "regras" },
    { href: "/painel/tabelas.html", label: "Tabelas (Loggi / J&T)", page: "tabelas" },
    ...(isAdmin ? [{ href: "/painel/correios.html", label: "Correios (API)", page: "correios" }] : []),
    ...(isAdmin ? [{ href: "/painel/usuarios.html", label: "Usuários", page: "usuarios" }] : []),
  ];

  const nav = document.createElement("nav");
  nav.className = "sidebar";
  nav.innerHTML = `
    <div class="brand">Motor de Frete</div>
    ${links
      .map(
        (l) =>
          `<a href="${l.href}" class="${l.page === activePage ? "active" : ""}">${l.label}</a>`,
      )
      .join("")}
    <div class="spacer"></div>
    <div class="user">${user ? `${user.name} · ${user.role}` : ""}</div>
    <button class="logout" id="logout-btn">Sair</button>
  `;
  document.body.prepend(nav);

  document.getElementById("logout-btn").addEventListener("click", () => {
    clearSession();
    window.location.href = "/painel/login.html";
  });
}

export function showMessage(el, text, kind) {
  el.textContent = text;
  el.className = `message show ${kind}`;
}
