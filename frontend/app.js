import { renderDashboard } from './pages/dashboardPage.js';
import { renderProducts } from './pages/productsPage.js';
import { renderClients } from './pages/clientsPage.js';
import { renderMouvements } from './pages/mouvementsPage.js';
import { renderCommandes } from './pages/commandesPage.js';
import { renderStockSheet } from './pages/stockSheetPage.js';
import { showToast } from './components/ui.js';
import { api } from './services/api.js';

const routes = {
  dashboard: { title: 'Dashboard', render: renderDashboard },
  products: { title: 'Produits', render: renderProducts },
  clients: { title: 'Clients', render: renderClients },
  mouvements: { title: 'Mouvements', render: renderMouvements },
  commandes: { title: 'Commandes', render: renderCommandes },
  stocksheet: { title: 'Fiche de stock', render: renderStockSheet }
};

const navItems = [
  { key: 'dashboard', label: 'Dashboard', icon: '📊' },
  { key: 'products', label: 'Produits', icon: '📦' },
  { key: 'clients', label: 'Clients', icon: '👥' },
  { key: 'mouvements', label: 'Mouvements', icon: '🔁' },
  { key: 'commandes', label: 'Commandes', icon: '🧾' },
  { key: 'stocksheet', label: 'Fiche de stock', icon: '📄' }
];

let notificationsTimer = null;
const READ_NOTIFICATIONS_KEY = 'egk-notifications-read';

async function resolveGlobalSearchRoute(rawTerm) {
  const term = String(rawTerm || '').trim();
  if (!term) return null;

  const [products, clients, commandes, mouvements] = await Promise.allSettled([
    api.getProducts({ q: term, page: 1, limit: 1 }),
    api.getClients({ q: term, page: 1, limit: 1 }),
    api.getCommandes({ q: term, page: 1, limit: 1 }),
    api.getMouvements({ q: term, page: 1, limit: 1 })
  ]);

  const hasData = (result) => result.status === 'fulfilled' && Array.isArray(result.value?.data) && result.value.data.length > 0;
  const isNumeric = /^\d+$/.test(term);

  const priorities = isNumeric
    ? [
        { key: 'commandes', ok: hasData(commandes), hash: `#/commandes?q=${encodeURIComponent(term)}` },
        { key: 'products', ok: hasData(products), hash: `#/products?q=${encodeURIComponent(term)}` },
        { key: 'clients', ok: hasData(clients), hash: `#/clients?q=${encodeURIComponent(term)}` },
        { key: 'mouvements', ok: hasData(mouvements), hash: `#/mouvements?q=${encodeURIComponent(term)}` }
      ]
    : [
        { key: 'clients', ok: hasData(clients), hash: `#/clients?q=${encodeURIComponent(term)}` },
        { key: 'products', ok: hasData(products), hash: `#/products?q=${encodeURIComponent(term)}` },
        { key: 'commandes', ok: hasData(commandes), hash: `#/commandes?q=${encodeURIComponent(term)}` },
        { key: 'mouvements', ok: hasData(mouvements), hash: `#/mouvements?q=${encodeURIComponent(term)}` }
      ];

  return priorities.find((candidate) => candidate.ok)?.hash || null;
}

function currentRoute() {
  const hash = location.hash.replace('#/', '');
  const path = hash.split('?')[0] || 'dashboard';
  return routes[path] ? path : 'dashboard';
}

function buildNavButton(item, routeKey, extraClass = '') {
  const isActive = routeKey === item.key;
  return `
    <button
      class="nav-link ${extraClass} ${isActive ? 'active' : ''}"
      data-route="${item.key}"
      aria-label="${item.label}"
      title="${item.label}"
      type="button"
    >
      <span class="nav-icon" aria-hidden="true">${item.icon}</span>
      <span class="nav-text">${item.label}</span>
    </button>
  `;
}

function setTheme(isDark) {
  document.body.classList.toggle('dark', isDark);
  localStorage.setItem('egk-theme', isDark ? 'dark' : 'light');
}

function getReadNotifications() {
  try {
    const raw = sessionStorage.getItem(READ_NOTIFICATIONS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (_error) {
    return {};
  }
}

function saveReadNotifications(map) {
  sessionStorage.setItem(READ_NOTIFICATIONS_KEY, JSON.stringify(map));
}

function markNotificationRead(key) {
  const readMap = getReadNotifications();
  readMap[key] = true;
  saveReadNotifications(readMap);
}

function isNotificationRead(key) {
  return Boolean(getReadNotifications()[key]);
}

function buildNotificationItems(data) {
  const items = [];
  const delayedCount = data?.delayedDeliveries?.items?.length || 0;
  const lowStockCount = data?.lowStock?.length || 0;
  const draftOrders = data?.todayItems?.commandesBrouillon?.length || 0;
  const toDeliver = data?.todayItems?.commandesALivrer?.length || 0;

  const firstDelayed = data?.delayedDeliveries?.items?.[0];
  const firstLowStock = data?.lowStock?.[0];
  const firstDraft = data?.todayItems?.commandesBrouillon?.[0];
  const firstToDeliver = data?.todayItems?.commandesALivrer?.[0];

  if (delayedCount > 0) {
    items.push({
      key: `delay-${firstDelayed?.num_com || delayedCount}`,
      level: 'warn',
      text: `${delayedCount} commande(s) validée(s) en retard de livraison.`,
      route: `#/commandes?q=${encodeURIComponent(firstDelayed?.num_com || '')}`
    });
  }

  if (lowStockCount > 0) {
    items.push({
      key: `low-${firstLowStock?.id_prod || lowStockCount}`,
      level: 'warn',
      text: `${lowStockCount} produit(s) en stock critique.`,
      route: `#/products?q=${encodeURIComponent(firstLowStock?.id_prod || '')}`
    });
  }

  if (draftOrders > 0) {
    items.push({
      key: `draft-${firstDraft?.num_com || draftOrders}`,
      level: 'info',
      text: `${draftOrders} commande(s) brouillon à finaliser.`,
      route: `#/commandes?q=${encodeURIComponent(firstDraft?.num_com || '')}`
    });
  }

  if (toDeliver > 0) {
    items.push({
      key: `deliver-${firstToDeliver?.num_com || toDeliver}`,
      level: 'info',
      text: `${toDeliver} commande(s) validée(s) prêtes à livrer.`,
      route: `#/commandes?q=${encodeURIComponent(firstToDeliver?.num_com || '')}`
    });
  }

  return items.map((item) => ({ ...item, read: isNotificationRead(item.key) }));
}

function renderNotificationsPanel(panel, items, showRead = false) {
  if (!panel) return;

  const visible = showRead ? items : items.filter((item) => !item.read);
  const unreadCount = items.filter((item) => !item.read).length;

  panel.innerHTML = `
    <div class="notifications-head">
      <strong>Notifications</strong>
      <div class="notifications-head-actions">
        <span>${unreadCount}/${items.length}</span>
        <button type="button" class="btn btn-light btn-xs" data-toggle-read>${showRead ? 'Masquer lus' : 'Afficher lus'}</button>
      </div>
    </div>
    <div class="notifications-list">
      ${
        visible.length === 0
          ? '<p class="notifications-empty">Aucune notification active.</p>'
          : visible
              .map(
                (item) => `
                  <div class="notification-item ${item.level === 'warn' ? 'notification-warn' : ''} ${item.read ? 'notification-read' : ''}">
                    <div>${item.text}</div>
                    <div class="notification-actions">
                      <button type="button" class="btn btn-light btn-xs" data-open-route="${item.route}">Ouvrir</button>
                      ${item.read ? '' : `<button type="button" class="btn btn-light btn-xs" data-mark-read="${item.key}">Lu</button>`}
                    </div>
                  </div>
                `
              )
              .join('')
      }
    </div>
  `;
}

function setupNotifications(app) {
  const button = app.querySelector('#open-notifications');
  const panel = app.querySelector('#notifications-panel');
  const badge = app.querySelector('#notifications-count');
  if (!button || !panel || !badge) return;

  let showRead = false;
  let currentItems = [];

  const setCount = (count) => {
    badge.textContent = String(count);
    badge.hidden = count === 0;
  };

  const refresh = async () => {
    try {
      const dashboard = await api.getDashboard({ delay_days: 2 });
      currentItems = buildNotificationItems(dashboard.data);
      setCount(currentItems.filter((item) => !item.read).length);
      renderNotificationsPanel(panel, currentItems, showRead);
    } catch (error) {
      setCount(0);
      currentItems = [];
      renderNotificationsPanel(panel, [], showRead);
    }
  };

  button.addEventListener('click', () => {
    const isOpen = panel.classList.toggle('show');
    button.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });

  panel.addEventListener('click', (event) => {
    const toggleBtn = event.target.closest('[data-toggle-read]');
    if (toggleBtn) {
      showRead = !showRead;
      renderNotificationsPanel(panel, currentItems, showRead);
      return;
    }

    const markReadBtn = event.target.closest('[data-mark-read]');
    if (markReadBtn) {
      markNotificationRead(markReadBtn.dataset.markRead);
      currentItems = currentItems.map((item) =>
        item.key === markReadBtn.dataset.markRead ? { ...item, read: true } : item
      );
      setCount(currentItems.filter((item) => !item.read).length);
      renderNotificationsPanel(panel, currentItems, showRead);
      return;
    }

    const openBtn = event.target.closest('[data-open-route]');
    if (openBtn) {
      const route = openBtn.dataset.openRoute;
      if (route) {
        location.hash = route;
        panel.classList.remove('show');
        button.setAttribute('aria-expanded', 'false');
      }
    }
  });

  refresh();

  if (notificationsTimer) {
    clearInterval(notificationsTimer);
    notificationsTimer = null;
  }

  notificationsTimer = setInterval(refresh, 60000);
}

function buildLayout(routeKey) {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="layout">
      <aside class="sidebar">
        <h1 class="brand">🏗️ EGK Stock</h1>
        <p class="brand-subtitle">Pilotage opérationnel BTP</p>
        <nav class="sidebar-nav">
          ${navItems.map((item) => buildNavButton(item, routeKey)).join('')}
        </nav>
      </aside>

      <main class="main">
        <header class="topbar">
          <div class="topbar-title">
            <h2 class="page-title">${routes[routeKey].title}</h2>
            <p class="page-subtitle">Interface de gestion modernisée</p>
          </div>
          <div class="topbar-actions">
            <form id="global-search-form" class="global-search-form" role="search">
              <input id="global-search-input" placeholder="Recherche globale (id, nom, commande...)" />
              <button type="submit" class="btn btn-light">Rechercher</button>
            </form>
            <div class="notifications-wrap">
              <button class="btn btn-light notif-btn" id="open-notifications" aria-expanded="false">🔔 Notifications <span id="notifications-count" class="notif-badge" hidden>0</span></button>
              <div class="notifications-panel" id="notifications-panel"></div>
            </div>
            <button class="btn btn-light" id="toggle-theme">🌓 Mode sombre</button>
          </div>
        </header>
        <section id="page-root"></section>
      </main>

      <nav class="bottom-nav" aria-label="Navigation principale mobile">
        ${navItems.map((item) => buildNavButton(item, routeKey, 'bottom-nav-link')).join('')}
      </nav>
    </div>
  `;

  app.querySelectorAll('[data-route]').forEach((btn) => {
    btn.addEventListener('click', () => {
      location.hash = `#/${btn.dataset.route}`;
    });
  });

  app.querySelector('#toggle-theme').addEventListener('click', () => {
    const next = !document.body.classList.contains('dark');
    setTheme(next);
  });

  app.querySelector('#global-search-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const input = app.querySelector('#global-search-input');
    const term = input?.value || '';
    if (!term.trim()) {
      showToast('Saisissez un terme de recherche', 'error');
      return;
    }

    try {
      const targetHash = await resolveGlobalSearchRoute(term);
      if (!targetHash) {
        showToast('Aucun résultat trouvé');
        return;
      }
      location.hash = targetHash;
    } catch (error) {
      showToast(error.message || 'Recherche indisponible', 'error');
    }
  });

  setupNotifications(app);
}

async function renderApp() {
  const routeKey = currentRoute();
  window.scrollTo(0, 0);
  buildLayout(routeKey);
  const pageRoot = document.getElementById('page-root');

  try {
    await routes[routeKey].render(pageRoot);
  } catch (error) {
    pageRoot.innerHTML = `<div class="card"><p>Erreur de chargement: ${error.message}</p></div>`;
    showToast(error.message || 'Erreur de chargement', 'error');
  }
}

if (localStorage.getItem('egk-theme') === 'dark') {
  setTheme(true);
}

window.addEventListener('hashchange', renderApp);
renderApp();
