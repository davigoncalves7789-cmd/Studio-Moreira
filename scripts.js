
function abrirLightbox(src, alt) {
  const lb = document.getElementById('lightbox');
  document.getElementById('lightbox-img').src = src;
  document.getElementById('lightbox-img').alt = alt;
  lb.classList.add('ativo');
}

function fecharLightbox() {
  document.getElementById('lightbox').classList.remove('ativo');
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') fecharLightbox();
});

document.getElementById('lightbox-img').addEventListener('click', e => {
  e.stopPropagation();
});

function abrirInfo() {
  const painel = document.getElementById('info-painel');
  painel.style.display = painel.style.display === 'block' ? 'none' : 'block';
}

function fecharInfo() {
  document.getElementById('info-painel').style.display = 'none';
}

function escapeAttr(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function montarItensHtml(itens) {
  return itens.map((item, i) => (i === 0 ? item : '+ ' + item)).join('<br>');
}

function criarCardHtml(p) {
  return `
    <div class="card"
         data-title="${escapeAttr(p.nomeBusca)}"
         data-desc="${escapeAttr(p.descBusca)}">
      <div class="card-title">${p.nomeExibicao}</div>
      <div class="card-body">
        <img src="${p.imagem}" alt="${escapeAttr(p.imagemAlt)}" />
        <div class="card-desc">
          <p>${montarItensHtml(p.itens)}</p>
          <span class="preco">Valor: R$ ${p.preco}</span>
          <button class="btn-adicionar" onclick="adicionarCarrinho(this)"
            data-nome="${escapeAttr(p.nomeCarrinho)}"
            data-preco="${p.preco}">
            🛒 Adicionar
          </button>
        </div>
      </div>
    </div>`;
}

function criarCardCestaHtml(p) {
  return `
    <div class="card-cesta"
         data-title="${escapeAttr(p.nomeBusca)}"
         data-desc="${escapeAttr(p.descBusca)}">
      <h2>${p.nomeExibicao}</h2>
      <div class="card-body-cesta">
        <img src="${p.imagem}" alt="${escapeAttr(p.imagemAlt)}">
        <div class="card-desc-cesta">
          <p>${montarItensHtml(p.itens)}</p>
          <span class="preco">Valor: R$ ${p.preco}</span>
          <button class="btn-adicionar" onclick="adicionarCarrinho(this)"
            data-nome="${escapeAttr(p.nomeCarrinho)}"
            data-preco="${p.preco}">
            🛒 Adicionar
          </button>
        </div>
      </div>
    </div>`;
}

function renderizarProdutos(produtos) {
  const containers = {
    buques: document.getElementById('galeria'),
    glitter: document.getElementById('galeria-glitter'),
    personalizados: document.getElementById('galeria-personalizados'),
    cestas: document.getElementById('galeria-cestas'),
  };

  produtos.forEach(p => {
    const container = containers[p.categoria];
    if (!container) {
      console.warn('Categoria desconhecida no produtos.json:', p.categoria, p);
      return;
    }
    const html = p.categoria === 'cestas' ? criarCardCestaHtml(p) : criarCardHtml(p);
    const sentinela = container.querySelector('.no-results');
    if (sentinela) {
      sentinela.insertAdjacentHTML('beforebegin', html);
    } else {
      container.insertAdjacentHTML('beforeend', html);
    }
  });
}

async function carregarProdutos() {
  try {
    const resp = await fetch('produtos.json');
    if (!resp.ok) throw new Error(`Falha ao carregar produtos.json (status ${resp.status})`);
    const produtos = await resp.json();
    renderizarProdutos(produtos);
  } catch (err) {
    console.error('Erro ao carregar produtos:', err);
  }
}

const estadoCarrossel = {
  buques:        { pagina: 0 },
  glitter:       { pagina: 0 },
  personalizados:{ pagina: 0 },
};

const idCarrossel = {
  buques:        'galeria',
  glitter:       'galeria-glitter',
  personalizados:'galeria-personalizados',
};

function isMobile() {
  return window.innerWidth <= 750;
}

function cardsVisiveis(nome) {
  return isMobile() ? 1 : 4;
}

function cardsAtivos(nome) {
  const el = document.getElementById(idCarrossel[nome]);
  return Array.from(el.children).filter(c => !c.classList.contains('hidden') && !c.classList.contains('no-results'));
}

function moverCarrossel(nome, direcao) {
  const estado = estadoCarrossel[nome];
  const visiveis = cardsVisiveis(nome);
  const total = cardsAtivos(nome).length;
  const maxPagina = Math.max(0, Math.ceil(total / visiveis) - 1);

  estado.pagina = Math.min(Math.max(estado.pagina + direcao, 0), maxPagina);
  renderCarrossel(nome);
}

function renderCarrossel(nome) {
  const estado = estadoCarrossel[nome];
  const ativos = cardsAtivos(nome);

  if (isMobile()) {
    ativos.forEach(card => { card.style.display = ''; });
  } else {
    const visiveis = cardsVisiveis(nome);
    const inicio = estado.pagina * visiveis;
    ativos.forEach((card, i) => {
      card.style.display = (i >= inicio && i < inicio + visiveis) ? '' : 'none';
    });
  }

  const wrap = document.getElementById('wrap-' + nome);
  if (!wrap) return;
  const [sEsq, sDir] = wrap.querySelectorAll('.seta');
  const visiveis = cardsVisiveis(nome);
  const maxPagina = Math.max(0, Math.ceil(ativos.length / visiveis) - 1);
  sEsq.disabled = estado.pagina === 0;
  sDir.disabled = estado.pagina >= maxPagina;
}

function renderTodos() {
  renderCarrossel('buques');
  renderCarrossel('glitter');
  renderCarrossel('personalizados');
}

const input           = document.getElementById('searchInput');
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

  ['galeria', 'galeria-glitter', 'galeria-personalizados'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.querySelectorAll('[data-title]').forEach(card => {
      if (!terms.length) { card.classList.remove('hidden'); return; }
      const texto = normalize(card.dataset.title) + ' ' + normalize(card.dataset.desc);
      card.classList.toggle('hidden', !terms.some(t => texto.includes(t)));
    });
  });

  document.querySelectorAll('#galeria-cestas .card-cesta[data-title]').forEach(card => {
    if (!terms.length) { card.classList.remove('hidden'); return; }
    const texto = normalize(card.dataset.title) + ' ' + normalize(card.dataset.desc);
    card.classList.toggle('hidden', !terms.some(t => texto.includes(t)));
  });

  const visiveisBuques = cardsAtivos('buques').length;
  const visiveisCestas = document.querySelectorAll('#galeria-cestas .card-cesta[data-title]:not(.hidden)').length;

  noResults.classList.toggle('visible', visiveisBuques === 0 && terms.length > 0);
  noResultsCestas.classList.toggle('visible', visiveisCestas === 0 && terms.length > 0);

  estadoCarrossel.buques.pagina        = 0;
  estadoCarrossel.glitter.pagina       = 0;
  estadoCarrossel.personalizados.pagina= 0;
  renderTodos();
});

const CARRINHO_STORAGE_KEY = 'studio-moreira:carrinho';

function carregarCarrinhoSalvo() {
  try {
    const salvo = localStorage.getItem(CARRINHO_STORAGE_KEY);
    if (!salvo) return [];
    const dados = JSON.parse(salvo);
    if (!Array.isArray(dados)) return [];
    return dados.filter(item => item && typeof item.nome === 'string' && typeof item.preco === 'string');
  } catch (err) {
    console.warn('Não foi possível ler o carrinho salvo, iniciando vazio:', err);
    return [];
  }
}

function salvarCarrinho() {
  try {
    localStorage.setItem(CARRINHO_STORAGE_KEY, JSON.stringify(carrinho));
  } catch (err) {
    console.warn('Não foi possível salvar o carrinho:', err);
  }
}

let carrinho = carregarCarrinhoSalvo();

function adicionarCarrinho(btn) {
  const nome  = btn.dataset.nome;
  const preco = btn.dataset.preco;
  carrinho.push({ nome, preco });
  salvarCarrinho();
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
  salvarCarrinho();
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

  carrinho = [];
  salvarCarrinho();
  document.getElementById('carrinho-count').textContent = carrinho.length;
  atualizarCarrinho();
}

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visivel');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.1 });

window.addEventListener('load', async () => {
  document.getElementById('carrinho-count').textContent = carrinho.length; 
  await carregarProdutos();
  renderTodos();              

  document.querySelectorAll('.card, .card-cesta').forEach(el => {
    observer.observe(el);
  });

  document.querySelectorAll('.card img, .card-cesta img').forEach(img => {
    img.style.cursor = 'zoom-in';
    img.addEventListener('click', e => {
      e.stopPropagation();
      abrirLightbox(img.src, img.alt);
    });
  });
});

window.addEventListener('resize', renderTodos);