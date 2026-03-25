import { api } from '../services/api.js';
import { formatMoney } from '../components/ui.js';

function parseQuery() {
  const hash = location.hash.split('?')[1] || '';
  return new URLSearchParams(hash);
}

export async function renderStockSheet(container) {
  const products = await api.getProducts({ page: 1, limit: 500 });
  const query = parseQuery();
  const selected = query.get('id') || products.data[0]?.id_prod;

  const productOptions = products.data
    .map((p) => `<option value="${p.id_prod}" ${String(p.id_prod) === String(selected) ? 'selected' : ''}>${p.libelle}</option>`)
    .join('');

  container.innerHTML = `
    <section class="card">
      <div class="toolbar">
        <label class="field" style="max-width:320px;">
          Produit
          <select id="sheet-product">${productOptions}</select>
        </label>
        <button class="btn btn-light" id="export-pdf">Exporter PDF</button>
      </div>
      <div id="sheet-content"><p>Chargement...</p></div>
    </section>
  `;

  const sheetContent = container.querySelector('#sheet-content');

  async function loadSheet(idProd) {
    const { data } = await api.getStockSheet(idProd);

    sheetContent.innerHTML = `
      <div class="kpi-grid" style="grid-template-columns:repeat(3,minmax(140px,1fr));">
        <article class="kpi"><h3>Total entrées</h3><strong>${data.totalEntries}</strong></article>
        <article class="kpi"><h3>Total sorties</h3><strong>${data.totalExits}</strong></article>
        <article class="kpi"><h3>Solde actuel</h3><strong>${data.currentBalance}</strong></article>
      </div>

      <div class="table-wrap">
        <table>
          <thead><tr><th>Op</th><th>Date</th><th>Libellé</th><th>Type</th><th>Quantité</th><th>Solde</th></tr></thead>
          <tbody>
            ${data.history
              .map(
                (h) => `
              <tr>
                <td>${h.num_op}</td>
                <td>${new Date(h.date_op).toLocaleString('fr-FR')}</td>
                <td>${h.lib_op}</td>
                <td>${h.type_mvt}</td>
                <td>${h.qte_op}</td>
                <td>${h.balance}</td>
              </tr>`
              )
              .join('')}
          </tbody>
        </table>
      </div>

      <p><strong>Produit:</strong> ${data.product.libelle} | <strong>PU:</strong> ${formatMoney(data.product.pu)}</p>
    `;

    container.querySelector('#export-pdf').onclick = () => {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      doc.setFontSize(14);
      doc.text(`Fiche de stock - ${data.product.libelle}`, 10, 15);
      doc.setFontSize(10);
      doc.text(`Total entrées: ${data.totalEntries}`, 10, 25);
      doc.text(`Total sorties: ${data.totalExits}`, 10, 32);
      doc.text(`Solde actuel: ${data.currentBalance}`, 10, 39);

      let y = 50;
      data.history.forEach((h) => {
        if (y > 280) {
          doc.addPage();
          y = 15;
        }
        doc.text(
          `${new Date(h.date_op).toLocaleDateString('fr-FR')} | ${h.type_mvt} | Qte ${h.qte_op} | Solde ${h.balance}`,
          10,
          y
        );
        y += 7;
      });

      doc.save(`fiche_stock_${data.product.id_prod}.pdf`);
    };
  }

  container.querySelector('#sheet-product').addEventListener('change', (e) => {
    const id = e.target.value;
    location.hash = `#/stocksheet?id=${id}`;
  });

  await loadSheet(selected);
}
