// ── Conexão com o Supabase ─────────────────────────────────────────
// Essa chave é "publishable" (antiga "anon public"): foi feita pra
// ficar exposta no código do site. Quem protege o banco de verdade
// são as regras de RLS configuradas lá no Supabase, não o sigilo
// dessa chave.
const SUPABASE_URL = 'https://padjfxslzjhgtqujdkbx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_50YMqseOFR5Yma5AF1FCuQ_Y5xVaHBj';

// A loja só LÊ produtos, então não precisa carregar a biblioteca
// inteira do Supabase (centenas de KB): um fetch direto na API REST
// faz o mesmo e começa antes. O admin continua usando a biblioteca.
const SUPABASE_PRODUTOS_URL = `${SUPABASE_URL}/rest/v1/produtos?select=*&order=criado_em.asc`;

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') fecharInfo();
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

const CATEGORIA_LABEL = {
  buques: 'Buquês',
  glitter: 'Glitter',
  personalizados: 'Personalizados',
  cestas: 'Cestas',
  escritorio: 'Escritório',
};

function criarCardHtml(p) {
  const id = escapeAttr(p.id);
  return `
    <div class="card"
         data-title="${escapeAttr(p.nomeBusca)}"
         data-desc="${escapeAttr(p.descBusca)}"
         data-categoria="${escapeAttr(CATEGORIA_LABEL[p.categoria] || p.categoria)}">
      <div class="card-foto">
        <img src="${escapeAttr(p.imagem)}" alt="${escapeAttr(p.imagemAlt)}" width="480" height="600" loading="lazy" decoding="async" class="produto-clicavel" data-produto-id="${id}">
      </div>
      <div class="card-info">
        <h3 class="card-nome produto-clicavel" data-produto-id="${id}">${escapeAttr(p.nomeExibicao)}</h3>
        <span class="card-preco">R$ ${escapeAttr(p.preco)}</span>
        <button class="btn-adicionar" onclick="adicionarCarrinho(this)"
          data-nome="${escapeAttr(p.nomeCarrinho)}"
          data-preco="${escapeAttr(p.preco)}"
          data-descricao="${escapeAttr(p.descBusca)}">
          Comprar
        </button>
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
    escritorio: 'galeria-escritorio',
  };

  produtos.forEach(p => {
    const containerId = containers[p.categoria];
    if (!containerId) {
      console.warn('Categoria desconhecida no produtos.json:', p.categoria, p);
      return;
    }
    inserirCardEm(containerId, criarCardHtml(p));

    // Produto marcado como "mais vendido" no admin aparece também na
    // aba Geral.
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

  montarVitrineGiratoria(produtos);
}

// ── Vitrine giratória — banner da aba Geral que troca de produto
// sozinho, invertendo o lado da foto/preço a cada troca. Prioriza os
// "mais vendidos"; se nenhum estiver marcado ainda, mostra uma
// amostra aleatória do catálogo pra não ficar vazio.
let vitrineProdutos = [];
let vitrineIndex = 0;

function montarVitrineGiratoria(produtos) {
  const destaques = produtos.filter(p => p.maisVendido);
  vitrineProdutos = destaques.length > 0 ? destaques : embaralhar(produtos).slice(0, 6);
  if (vitrineProdutos.length === 0) return;

  renderizarSlideVitrine();
  if (vitrineProdutos.length > 1) {
    setInterval(trocarSlideVitrine, 5000);
  }
}

function renderizarSlideVitrine() {
  const slide = document.getElementById('vitrine-slide');
  const dots = document.getElementById('vitrine-dots');
  if (!slide) return;

  const p = vitrineProdutos[vitrineIndex];
  const invertida = vitrineIndex % 2 === 1;

  slide.className = 'vitrine-slide' + (invertida ? ' invertida' : '');
  slide.onclick = () => abrirProduto(p.id);
  // Foto de verdade (<img>) em vez de imagem de fundo: dá pra ter alt
  // e o recorte é controlado só pelo CSS (object-position).
  slide.innerHTML = `
    <div class="vitrine-foto">
      <img src="${escapeAttr(p.imagem)}" alt="${escapeAttr(p.imagemAlt || p.nomeExibicao)}">
    </div>
    <div class="vitrine-info">
      <span class="vitrine-categoria">${p.maisVendido ? '⭐ Mais vendido' : escapeAttr(CATEGORIA_LABEL[p.categoria] || p.categoria)}</span>
      <span class="vitrine-slide-nome">${escapeAttr(p.nomeExibicao)}</span>
      <span class="vitrine-slide-preco">R$ ${escapeAttr(p.preco)}</span>
      <span class="vitrine-slide-cta">Ver detalhes →</span>
    </div>
  `;

  if (dots) {
    dots.innerHTML = vitrineProdutos
      .map((_, i) => `<span class="${i === vitrineIndex ? 'ativo' : ''}"></span>`)
      .join('');
  }
}

function trocarSlideVitrine() {
  const slide = document.getElementById('vitrine-slide');
  if (!slide) return;
  slide.classList.add('trocando');
  setTimeout(() => {
    vitrineIndex = (vitrineIndex + 1) % vitrineProdutos.length;
    renderizarSlideVitrine();
    slide.classList.remove('trocando');
  }, 400);
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

// Estados de carregamento — mostra "Carregando..." nas galerias enquanto
// busca os dados, depois restaura a mensagem real de "não encontrado"
// de cada uma. Evita a vitrine parecer vazia por um instante e confundir
// "ainda carregando" com "não tem produto".
function iniciarEstadoCarregando() {
  document.querySelectorAll('.no-results').forEach(el => {
    el.dataset.msgVazio = el.textContent;
    el.textContent = 'Carregando produtos...';
    el.classList.add('visible');
  });
}

function finalizarEstadoCarregando() {
  document.querySelectorAll('.no-results').forEach(el => {
    if (el.dataset.msgVazio) el.textContent = el.dataset.msgVazio;
  });
}

async function carregarProdutos() {
  try {
    const resp = await fetch(SUPABASE_PRODUTOS_URL, { headers: { apikey: SUPABASE_KEY } });
    if (!resp.ok) throw new Error(`Supabase respondeu com status ${resp.status}`);
    const data = await resp.json();
    if (!Array.isArray(data) || data.length === 0) throw new Error('Nenhum produto retornado do banco');

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
      // Supabase E o backup local falharam os dois — isso sim é um erro
      // de verdade (não "sem produtos"), então avisamos o cliente com
      // uma mensagem própria em vez de deixar tudo em silêncio.
      console.error('Erro também ao carregar produtos.json de backup:', err2);
      const banner = document.getElementById('erro-carregamento');
      if (banner) banner.classList.remove('oculto');
    }
  }
}

// ── Página do produto ──────────────────────────────────────────────
// Clicar num produto abre produto.html?id=... (página própria, com
// galeria de fotos, descrição e botões), em vez de um popup.
function abrirProduto(id) {
  window.location.href = 'produto.html?id=' + encodeURIComponent(id);
}

// ── Abas de categoria — só o painel da aba ativa fica visível. ─────
const abas    = document.querySelectorAll('.aba');
const paineis = document.querySelectorAll('.tab-painel');

const ABA_STORAGE_KEY = 'studio-moreira:aba';

function ativarAba(nomeAba) {
  abas.forEach(btn => {
    const ativa = btn.dataset.aba === nomeAba;
    btn.classList.toggle('ativa', ativa);
    btn.setAttribute('aria-selected', ativa ? 'true' : 'false');
  });
  paineis.forEach(painel => {
    painel.classList.toggle('oculto', painel.dataset.categoria !== nomeAba);
  });

  // Guarda a aba (menos o carrinho) pra, ao voltar da página de um
  // produto, a pessoa cair na mesma categoria em que estava.
  if (nomeAba !== 'carrinho') {
    try { sessionStorage.setItem(ABA_STORAGE_KEY, nomeAba); } catch (err) { /* sem storage: ignora */ }
  }

  // O topo fica grudado na tela, então desconta a altura dele pra a
  // barra de categorias não parar escondida embaixo.
  const barra = document.querySelector('.abas-categorias');
  const topo = document.querySelector('.topo');
  if (barra) window.scrollTo({ top: barra.offsetTop - (topo ? topo.offsetHeight : 0), behavior: 'smooth' });
}

abas.forEach(btn => {
  btn.addEventListener('click', () => ativarAba(btn.dataset.aba));
});

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
  { id: 'galeria-cestas',         seletorCard: '.card',       sentinelaId: 'noResultsCestas' },
  { id: 'galeria-escritorio',     seletorCard: '.card',       sentinelaId: 'noResultsEscritorio' },
];

const input = document.getElementById('searchInput');
const btnLimparBusca = document.getElementById('clear-search');

function atualizarBotaoLimpar() {
  btnLimparBusca.classList.toggle('oculto', !input.value.trim());
}

btnLimparBusca.addEventListener('click', () => {
  input.value = '';
  input.dispatchEvent(new Event('input'));
  input.focus();
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
    const texto = normalize(card.dataset.title) + ' ' + normalize(card.dataset.desc) + ' ' + normalize(card.dataset.categoria || '');
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
  atualizarBotaoLimpar();

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
    return dados
      .filter(item => item && typeof item.nome === 'string' && typeof item.preco === 'string')
      .map(item => ({
        ...item,
        // Carrinhos salvos antes dessa versão não tinham quantidade —
        // tratamos como 1 pra não quebrar quem já tinha item salvo.
        quantidade: Number.isInteger(item.quantidade) && item.quantidade > 0 ? item.quantidade : 1,
      }));
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
  const total = carrinho.reduce((s, i) => s + i.quantidade, 0);
  document.getElementById('carrinho-count').textContent = total;
}

function adicionarCarrinho(btn) {
  const nome      = btn.dataset.nome;
  const preco     = btn.dataset.preco;
  const descricao = btn.dataset.descricao || '';

  const existente = carrinho.find(i => i.nome === nome && i.preco === preco);
  if (existente) {
    existente.quantidade += 1;
  } else {
    carrinho.push({ nome, preco, descricao, quantidade: 1 });
  }

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
      lista.insertAdjacentHTML('beforebegin',
        `<div class="carrinho-vazio">
          <p>Seu carrinho está vazio.</p>
          <button type="button" onclick="ativarAba('geral')">Ver produtos</button>
        </div>`
      );
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
    const subtotal = valor * item.quantidade;
    total += subtotal;
    lista.innerHTML += `
      <li>
        <span class="carrinho-item-nome">${item.nome}</span>
        <span class="carrinho-item-qtd">
          <button onclick="alterarQuantidade(${i}, -1)" aria-label="Diminuir quantidade">−</button>
          ${item.quantidade}
          <button onclick="alterarQuantidade(${i}, 1)" aria-label="Aumentar quantidade">+</button>
        </span>
        <span>R$ ${subtotal.toFixed(2).replace('.', ',')}</span>
        <button onclick="removerItem(${i})" class="carrinho-item-remover" aria-label="Remover item">✕</button>
      </li>`;
  });

  document.getElementById('carrinho-total').textContent =
    `Total: R$ ${total.toFixed(2).replace('.', ',')}`;
}

function alterarQuantidade(i, delta) {
  const item = carrinho[i];
  if (!item) return;
  item.quantidade = Math.max(1, item.quantidade + delta);
  salvarCarrinho();
  atualizarContadorCarrinho();
  atualizarCarrinho();
}

function removerItem(i) {
  carrinho.splice(i, 1);
  salvarCarrinho();
  atualizarContadorCarrinho();
  atualizarCarrinho();
}

function finalizarPedido() {
  // Garante que só entram na mensagem itens realmente válidos (nome,
  // preço numérico e quantidade positiva) — proteção defensiva caso
  // algum dado salvo esteja corrompido.
  const itensValidos = carrinho.filter(i =>
    i && i.nome && i.quantidade > 0 && !isNaN(parseFloat(String(i.preco).replace(',', '.')))
  );

  if (itensValidos.length === 0) return alert('Seu carrinho está vazio!');

  let mensagem = 'Studio Moreira — Novo pedido\n\nProdutos:\n';
  let total = 0;

  itensValidos.forEach(item => {
    const valor = parseFloat(item.preco.replace(',', '.'));
    const subtotal = valor * item.quantidade;
    total += subtotal;
    mensagem += `• ${item.nome} — ${item.quantidade}x — R$ ${subtotal.toFixed(2).replace('.', ',')}\n`;
    if (item.descricao) mensagem += `   (${item.descricao})\n`;
  });

  mensagem += `\nTotal: R$ ${total.toFixed(2).replace('.', ',')}`;

  window.open(`https://wa.me/5516992631717?text=${encodeURIComponent(mensagem)}`, '_blank');

  carrinho = [];
  salvarCarrinho();
  atualizarContadorCarrinho();
  atualizarCarrinho();
}

// Roda direto (o script é "defer": o HTML já foi lido). Antes esperava o
// evento "load", que só dispara depois de TODAS as imagens e fontes —
// isso atrasava a busca dos produtos à toa.
async function iniciar() {
  atualizarContadorCarrinho();
  atualizarCarrinho();

  iniciarEstadoCarregando();
  await carregarProdutos();
  finalizarEstadoCarregando();
  GALERIAS.forEach(atualizarVazio);

  // produto.html manda pra cá com #carrinho; senão, volta pra última aba.
  let abaInicial = null;
  if (location.hash === '#carrinho') {
    abaInicial = 'carrinho';
  } else {
    try { abaInicial = sessionStorage.getItem(ABA_STORAGE_KEY); } catch (err) { /* ignora */ }
  }
  if (abaInicial && abaInicial !== 'geral' && document.querySelector(`.aba[data-aba="${abaInicial}"], .tab-painel[data-categoria="${abaInicial}"]`)) {
    ativarAba(abaInicial);
  }
}

// Um único listener resolve o clique na foto/nome de qualquer card,
// inclusive dos que só aparecem depois do carregamento.
document.addEventListener('click', e => {
  const alvo = e.target.closest('.produto-clicavel');
  if (alvo && alvo.dataset.produtoId) abrirProduto(alvo.dataset.produtoId);
});

iniciar();
