// ── Busca ──────────────────────────────────────────────
const input           = document.getElementById('searchInput');
const cards           = document.querySelectorAll('.card[data-title]'); 
const cardsCesta      = document.querySelectorAll('.card-cesta[data-title]');
const noResults       = document.getElementById('noResults');
const noResultsCestas = document.getElementById('noResultsCestas');
 
function normalize(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim();
}
 
input.addEventListener('input', () => {
  const terms = normalize(input.value).split(/\s+/).filter(Boolean);
  let visibleBuques = 0;
  let visibleCestas = 0;
 
  cards.forEach(card => {
    if (!terms.length) {
      card.classList.remove('hidden');
      visibleBuques++;
      return;
    }
    const texto = normalize(card.dataset.title) + ' ' + normalize(card.dataset.desc);
    const match = terms.some(t => texto.includes(t));
    card.classList.toggle('hidden', !match);
    if (match) visibleBuques++;
  });
 
  cardsCesta.forEach(card => {
    if (!terms.length) {
      card.classList.remove('hidden');
      visibleCestas++;
      return;
    }
    const texto = normalize(card.dataset.title) + ' ' + normalize(card.dataset.desc);
    const match = terms.some(t => texto.includes(t));
    card.classList.toggle('hidden', !match);
    if (match) visibleCestas++;
  });
 
  noResults.classList.toggle('visible', visibleBuques === 0 && terms.length > 0);
  noResultsCestas.classList.toggle('visible', visibleCestas === 0 && terms.length > 0);
});
 
// ── Carrinho ────────────────────────────────────────────
let carrinho = [];
 
function adicionarCarrinho(btn) {
  const nome  = btn.dataset.nome;
  const preco = btn.dataset.preco;
  carrinho.push({ nome, preco });
  document.getElementById('carrinho-count').textContent = carrinho.length;
 
  const original = btn.innerHTML;
  btn.innerHTML = '✓ Adicionado!';
  btn.disabled = true;
  setTimeout(() => {
    btn.innerHTML = original;
    btn.disabled = false;
  }, 1200);
}
 
function abrirCarrinho() {
  const painel = document.getElementById('carrinho-painel');
  painel.style.display = painel.style.display === 'block' ? 'none' : 'block';
  atualizarCarrinho();
}
 
function fecharCarrinho() {
  document.getElementById('carrinho-painel').style.display = 'none';
}
 
function atualizarCarrinho() {
  const lista = document.getElementById('carrinho-lista');
  lista.innerHTML = '';
  let total = 0;
 
  carrinho.forEach((item, i) => {
    const valor = parseFloat(item.preco.replace(',', '.'));
    total += valor;
    lista.innerHTML += `
      <li>
        ${item.nome}
        <span>R$ ${item.preco}</span>
        <button onclick="removerItem(${i})" style="background:none;border:none;color:red;cursor:pointer;font-size:16px;">✕</button>
      </li>`;
  });
 
  document.getElementById('carrinho-total').textContent =
    `Total: R$ ${total.toFixed(2).replace('.', ',')}`;
}
 
function removerItem(i) {
  carrinho.splice(i, 1);
  document.getElementById('carrinho-count').textContent = carrinho.length;
  atualizarCarrinho();
}
 
function finalizarPedido() {
  if (carrinho.length === 0) return alert('Seu carrinho está vazio!');
 
  let mensagem = 'Olá! Gostaria de fazer um pedido:%0A%0A';
  carrinho.forEach(item => {
    mensagem += `• ${item.nome} — R$ ${item.preco}%0A`;
  });
 
  const total = carrinho.reduce((s, i) => s + parseFloat(i.preco.replace(',', '.')), 0);
  mensagem += `%0ATotal: R$ ${total.toFixed(2).replace('.', ',')}`;
 
  window.open(`https://wa.me/5516993414588?text=${mensagem}`, '_blank');
}
const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visivel');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.card, .card-cesta').forEach(el => {
  observer.observe(el);
});