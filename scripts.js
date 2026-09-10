// ── Conexão com o Supabase ─────────────────────────────────────────
// Essa chave é "publishable" (antiga "anon public"): foi feita pra
// ficar exposta no código do site. Quem protege o banco de verdade
// são as regras de RLS configuradas lá no Supabase, não o sigilo
// dessa chave.
const SUPABASE_URL = 'https://padjfxslzjhgtqujdkbx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_50YMqseOFR5Yma5AF1FCuQ_Y5xVaHBj';

// Em conexões mais lentas ou instáveis (comum em celular), o script do
// CDN do Supabase pode não terminar de carregar a tempo. Sem essa
// checagem, "window.supabase" viria undefined e a linha abaixo travaria
// com um erro fatal. Com a checagem, se o CDN falhar, supabaseClient
// fica null e o carregarProdutos() cai direto no fallback local.
const supabaseClient = (typeof window.supabase !== 'undefined')
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

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
  if (e.key === 'Escape') {
    fecharLightbox();
    fecharProdutoModal();
    fecharInfo();
  }
});

document.getElementById('lightbox-img').addEventListener('click', e => {
  e.stopPropagation();
});

// ── Painel de Informações — janela modal (display:flex centraliza). ──
function abrirInfo() {
  const painel = document.getElementById('info-painel');
  painel.style.display = painel.style.display === 'flex' ? 'none' : 'flex';
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

// Embaralha uma cópia do array (Fisher-Yates) — usado pra mostrar os
// buquês em ordem aleatória na aba Geral.
function embaralhar(array) {
  const copia = [...array];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

// Guarda todos os produtos carregados, indexados por id, pra alimentar
// o modal de produto sem precisar refazer fetch nem ler dados do DOM.
let produtosCache = {};

function criarCardHtml(p) {
  return `
    <div class="card"
         data-title="${escapeAttr(p.nomeBusca)}"
         data-desc="${escapeAttr(p.descBusca)}">
      <div class="card-title">${p.nomeExibicao}</div>
      <div class="card-body">
        <img src="${p.imagem}" alt="${escapeAttr(p.imagemAlt)}" class="produto-clicavel" data-produto-id="${escapeAttr(p.id)}" />
        <div class="card-desc">
          <span class="preco">Valor: R$ ${p.preco}</span>
          <button class="btn-adicionar" onclick="adicionarCarrinho(this)"
            data-nome="${escapeAttr(p.nomeCarrinho)}"
            data-preco="${p.preco}"
            data-descricao="${escapeAttr(p.descBusca)}">
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
        <img src="${p.imagem}" alt="${escapeAttr(p.imagemAlt)}" class="produto-clicavel" data-produto-id="${escapeAttr(p.id)}">
        <div class="card-desc-cesta">
          <span class="preco">Valor: R$ ${p.preco}</span>
          <button class="btn-adicionar" onclick="adicionarCarrinho(this)"
            data-nome="${escapeAttr(p.nomeCarrinho)}"
            data-preco="${p.preco}"
            data-descricao="${escapeAttr(p.descBusca)}">
            🛒 Adicionar
          </button>
        </div>
      </div>
    </div>`;
}

function inserirCardEm(containerId, html) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const sentinela = container.querySelector('.no-results');
  if (sentinela) {
    sentinela.insertAdjacentHTML('beforebegin', html);
  } else {
    container.insertAdjacentHTML('beforeend', html);
  }
}

function renderizarProdutos(produtos) {
  const containers = {
    buques: 'galeria',
    glitter: 'galeria-glitter',
    personalizados: 'galeria-personalizados',
    cestas: 'galeria-cestas',
  };

  produtos.forEach(p => {
    const containerId = containers[p.categoria];
    if (!containerId) {
      console.warn('Categoria desconhecida no produtos.json:', p.categoria, p);
      return;
    }
    produtosCache[p.id] = p;
    const html = p.categoria === 'cestas' ? criarCardCestaHtml(p) : criarCardHtml(p);
    inserirCardEm(containerId, html);

    // Produto marcado como "mais vendido" no admin aparece também na
    // aba Geral, sempre no estilo de card padrão (mesmo se for cesta),
    // pra manter a grade uniforme.
    if (p.maisVendido) {
      inserirCardEm('galeria-mais-vendidos', criarCardHtml(p));
    }
  });

  // Aba Geral também mostra os buquês em ordem aleatória (ainda são
  // poucos, então dá pra mostrar todos em vez de só uma amostra).
  const buques = embaralhar(produtos.filter(p => p.categoria === 'buques'));
  buques.forEach(p => inserirCardEm('galeria-geral-buques', criarCardHtml(p)));

  // Pool com TODO o catálogo (qualquer categoria), usado só quando a
  // pessoa pesquisa estando na aba Geral — pra achar produtos de
  // qualquer categoria, não só buquês/mais vendidos.
  produtos.forEach(p => inserirCardEm('galeria-geral-todos', criarCardHtml(p)));
}

// Converte uma linha da tabela "produtos" do Supabase (nomes em
// snake_case) pro mesmo formato que o resto do código já espera
// (o mesmo shape do antigo produtos.json).
function mapearProdutoDoBanco(row) {
  return {
    id: row.id,
    categoria: row.categoria,
    nomeExibicao: row.nome_exibicao,
    nomeBusca: row.nome_busca,
    descBusca: row.desc_busca,
    nomeCarrinho: row.nome_carrinho,
    imagem: row.imagem_url,
    imagemAlt: row.imagem_alt,
    itens: row.itens || [],
    preco: row.preco,
    maisVendido: Boolean(row.mais_vendido),
  };
}

async function carregarProdutos() {
  try {
    if (!supabaseClient) throw new Error('Cliente Supabase indisponível (CDN não carregou a tempo)');

    const { data, error } = await supabaseClient
      .from('produtos')
      .select('*')
      .order('criado_em', { ascending: true });

    if (error) throw error;
    if (!data || data.length === 0) throw new Error('Nenhum produto retornado do banco');

    renderizarProdutos(data.map(mapearProdutoDoBanco));
  } catch (err) {
    // Se o Supabase estiver fora do ar, ou a chave/URL estiver errada,
    // caímos de volta pro produtos.json local em vez de deixar a
    // vitrine vazia — evita que um problema no banco tire o site do ar.
    console.error('Erro ao carregar produtos do Supabase, usando produtos.json como backup:', err);
    try {
      const resp = await fetch('produtos.json');
      if (!resp.ok) throw new Error(`Falha ao carregar produtos.json (status ${resp.status})`);
      const produtos = await resp.json();
      renderizarProdutos(produtos);
    } catch (err2) {
      console.error('Erro também ao carregar produtos.json de backup:', err2);
    }
  }
}

// ── Modal de produto (estilo Shopee) ──────────────────────────────
function abrirProdutoModal(id) {
  const p = produtosCache[id];
  if (!p) {
    console.warn('Produto não encontrado no cache:', id);
    return;
  }

  const imgEl = document.getElementById('produto-modal-img');
  imgEl.src = p.imagem;
  imgEl.alt = p.imagemAlt || p.nomeExibicao;

  document.getElementById('produto-modal-titulo').textContent = p.nomeExibicao;
  document.getElementById('produto-modal-desc').innerHTML = montarItensHtml(p.itens);
  document.getElementById('produto-modal-preco').textContent = `R$ ${p.preco}`;

  const btnComprar = document.getElementById('produto-modal-btn-comprar');
  btnComprar.dataset.nome = p.nomeCarrinho;
  btnComprar.dataset.preco = p.preco;
  btnComprar.dataset.descricao = p.descBusca;
  btnComprar.disabled = false;
  btnComprar.innerHTML = 'Adicionar ao carrinho';
  btnComprar.onclick = () => adicionarCarrinho(btnComprar);

  document.getElementById('produto-modal-overlay').classList.add('ativo');
  document.body.style.overflow = 'hidden';
}

function fecharProdutoModal() {
  document.getElementById('produto-modal-overlay').classList.remove('ativo');
  document.body.style.overflow = '';
}

document.getElementById('produto-modal-img').addEventListener('click', e => {
  e.stopPropagation();
  abrirLightbox(e.target.src, e.target.alt);
});

// ── Abas de categoria — só o painel da aba ativa fica visível. ─────
const abas    = document.querySelectorAll('.aba');
const paineis = document.querySelectorAll('.tab-painel');

function ativarAba(nomeAba) {
  abas.forEach(btn => {
    const ativa = btn.dataset.aba === nomeAba;
    btn.classList.toggle('ativa', ativa);
    btn.setAttribute('aria-selected', ativa ? 'true' : 'false');
  });
  paineis.forEach(painel => {
    painel.classList.toggle('oculto', painel.dataset.categoria !== nomeAba);
  });

  const barra = document.querySelector('.abas-categorias');
  if (barra) window.scrollTo({ top: barra.offsetTop - 8, behavior: 'smooth' });
}

abas.forEach(btn => {
  btn.addEventListener('click', () => ativarAba(btn.dataset.aba));
});

// ── Banner de destaque — mensagens rodando em loop com fade ────────
const HERO_MENSAGENS = [
  'Flores que contam histórias, momentos que se tornam memórias.',
  '🌸 Peça pelo WhatsApp e receba com todo carinho em Franca-SP.',
  '🎁 Aceitamos encomendas personalizadas — fale com a gente!',
];
let heroIndex = 0;

function girarHeroBanner() {
  const el = document.getElementById('hero-banner-texto');
  if (!el) return;
  el.classList.add('sumindo');
  setTimeout(() => {
    heroIndex = (heroIndex + 1) % HERO_MENSAGENS.length;
    el.textContent = HERO_MENSAGENS[heroIndex];
    el.classList.remove('sumindo');
  }, 400);
}
setInterval(girarHeroBanner, 4500);

// ── Busca ───────────────────────────────────────────────────────────
// Config de todas as galerias que a busca precisa filtrar + o "sem
// resultados" de cada uma. Adicionar uma galeria nova é só adicionar
// uma linha aqui.
const GALERIAS = [
  { id: 'galeria-mais-vendidos',  seletorCard: '.card',       sentinelaId: 'noResultsMaisVendidos' },
  { id: 'galeria-geral-buques',   seletorCard: '.card',       sentinelaId: 'noResultsGeralBuques' },
  { id: 'galeria-geral-todos',    seletorCard: '.card',       sentinelaId: 'noResultsGeralTodos' },
  { id: 'galeria',                seletorCard: '.card',       sentinelaId: 'noResults' },
  { id: 'galeria-glitter',        seletorCard: '.card',       sentinelaId: 'noResultsGlitter' },
  { id: 'galeria-personalizados', seletorCard: '.card',       sentinelaId: 'noResultsPersonalizados' },
  { id: 'galeria-cestas',         seletorCard: '.card-cesta', sentinelaId: 'noResultsCestas' },
];

const input = document.getElementById('searchInput');

function toggleBusca() {
  const wrap = document.querySelector('.search-wrap');
  const vaiAbrir = !wrap.classList.contains('aberta');
  wrap.classList.toggle('aberta', vaiAbrir);
  if (vaiAbrir) input.focus();
}

// Se o campo perder o foco vazio, recolhe de volta pra só o ícone —
// mas só fecha se realmente não tem texto digitado.
input.addEventListener('blur', () => {
  if (!input.value.trim()) {
    document.querySelector('.search-wrap').classList.remove('aberta');
  }
});

function normalize(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim();
}

function filtrarGaleria({ id, seletorCard }, terms) {
  const container = document.getElementById(id);
  if (!container) return;
  container.querySelectorAll(`${seletorCard}[data-title]`).forEach(card => {
    if (!terms.length) { card.classList.remove('hidden'); return; }
    const texto = normalize(card.dataset.title) + ' ' + normalize(card.dataset.desc);
    card.classList.toggle('hidden', !terms.some(t => texto.includes(t)));
  });
}

function atualizarVazio({ id, seletorCard, sentinelaId }) {
  const sentinela = document.getElementById(sentinelaId);
  if (!sentinela) return;
  const visiveis = document.querySelectorAll(`#${id} ${seletorCard}[data-title]:not(.hidden)`).length;
  sentinela.classList.toggle('visible', visiveis === 0);
}

input.addEventListener('input', () => {
  const terms = normalize(input.value).split(/\s+/).filter(Boolean);
  GALERIAS.forEach(g => { filtrarGaleria(g, terms); atualizarVazio(g); });

  // Na aba Geral: sem busca, mostra Mais Vendidos + Buquês aleatórios
  // (visão padrão). Buscando, troca pra mostrar qualquer produto do
  // catálogo inteiro que bater com o termo, não só buquês.
  const buscando = terms.length > 0;
  document.getElementById('geral-padrao').classList.toggle('oculto', buscando);
  document.getElementById('geral-busca').classList.toggle('oculto', !buscando);
});

// ── Carrinho ─────────────────────────────────────────────────────
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

function atualizarContadorCarrinho() {
  document.getElementById('carrinho-count').textContent = carrinho.length;
}

function adicionarCarrinho(btn) {
  const nome      = btn.dataset.nome;
  const preco     = btn.dataset.preco;
  const descricao = btn.dataset.descricao || '';
  carrinho.push({ nome, preco, descricao });
  salvarCarrinho();
  atualizarContadorCarrinho();
  atualizarCarrinho();

  const original = btn.innerHTML;
  btn.innerHTML = '✓ Adicionado!';
  btn.disabled = true;
  setTimeout(() => {
    btn.innerHTML = original;
    btn.disabled = false;
  }, 1200);
}

// Carrinho agora é uma aba própria (renderizada sempre, escondida via
// CSS quando não é a aba ativa) em vez de uma janela modal.
function atualizarCarrinho() {
  const lista = document.getElementById('carrinho-lista');
  const caixa = document.querySelector('.carrinho-caixa');
  const acoes = document.querySelector('.carrinho-acoes');
  if (!lista || !caixa) return;

  if (carrinho.length === 0) {
    lista.innerHTML = '';
    document.getElementById('carrinho-total').textContent = '';
    if (!caixa.querySelector('.carrinho-vazio')) {
      lista.insertAdjacentHTML('beforebegin', '<p class="carrinho-vazio">Seu carrinho está vazio.</p>');
    }
    if (acoes) acoes.classList.add('oculto');
    return;
  }

  const vazioMsg = caixa.querySelector('.carrinho-vazio');
  if (vazioMsg) vazioMsg.remove();
  if (acoes) acoes.classList.remove('oculto');

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
  atualizarContadorCarrinho();
  atualizarCarrinho();
}

function finalizarPedido() {
  if (carrinho.length === 0) return alert('Seu carrinho está vazio!');

  let mensagem = 'Olá! Gostaria de fazer um pedido:\n\n';
  carrinho.forEach(item => {
    mensagem += `• ${item.nome} — R$ ${item.preco}\n`;
    if (item.descricao) mensagem += `  (${item.descricao})\n`;
    mensagem += '\n';
  });

  const total = carrinho.reduce((s, i) => s + parseFloat(i.preco.replace(',', '.')), 0);
  mensagem += `Total: R$ ${total.toFixed(2).replace('.', ',')}`;

  window.open(`https://wa.me/5516993414588?text=${encodeURIComponent(mensagem)}`, '_blank');

  carrinho = [];
  salvarCarrinho();
  atualizarContadorCarrinho();
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
  atualizarContadorCarrinho();
  atualizarCarrinho();
  await carregarProdutos();

  GALERIAS.forEach(atualizarVazio);

  document.querySelectorAll('.card, .card-cesta').forEach(el => {
    observer.observe(el);
  });

  document.querySelectorAll('.produto-clicavel').forEach(img => {
    img.style.cursor = 'pointer';
    img.addEventListener('click', e => {
      e.stopPropagation();
      abrirProdutoModal(img.dataset.produtoId);
    });
  });
});
