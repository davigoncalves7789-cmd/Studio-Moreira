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
// com um erro fatal — o que impedia até o carrossel.js de continuar e
// derrubava o fallback pro produtos.json que já existe lá embaixo.
// Com a checagem, se o CDN falhar, supabaseClient fica null e o
// carregarProdutos() cai direto no fallback local.
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
    fecharCarrinho();
  }
});

document.getElementById('lightbox-img').addEventListener('click', e => {
  e.stopPropagation();
});

// ── Painel de Informações — agora abre como janela modal (display:flex
// pra centralizar o conteúdo), igual ao modal de produto. ──────────
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

// Guarda todos os produtos carregados do produtos.json, indexados por id,
// pra alimentar o modal de produto sem precisar refazer fetch nem
// recuperar dados a partir do DOM.
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
    produtosCache[p.id] = p;
    const html = p.categoria === 'cestas' ? criarCardCestaHtml(p) : criarCardHtml(p);
    const sentinela = container.querySelector('.no-results');
    if (sentinela) {
      sentinela.insertAdjacentHTML('beforebegin', html);
    } else {
      container.insertAdjacentHTML('beforeend', html);
    }
  });
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

// ── Busca colapsável: só a lupa, expande ao clicar ────────────────
function toggleBusca() {
  const wrap = document.querySelector('.search-wrap');
  const vaiAbrir = !wrap.classList.contains('aberta');
  wrap.classList.toggle('aberta', vaiAbrir);
  if (vaiAbrir) {
    input.focus();
  }
}

// Se o campo perder o foco vazio, recolhe de volta pra só o ícone —
// mas só fecha se realmente não tem texto digitado, senão o usuário
// perderia a busca sem querer.
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
  const nome      = btn.dataset.nome;
  const preco     = btn.dataset.preco;
  const descricao = btn.dataset.descricao || '';
  carrinho.push({ nome, preco, descricao });
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

// ── Painel do Carrinho — agora é sempre uma janela modal centralizada
// (display:flex), em qualquer tamanho de tela. ────────────────────
function abrirCarrinho() {
  const painel = document.getElementById('carrinho-painel');
  const vaiAbrir = painel.style.display !== 'flex';
  painel.style.display = vaiAbrir ? 'flex' : 'none';
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

  document.querySelectorAll('.produto-clicavel').forEach(img => {
    img.style.cursor = 'pointer';
    img.addEventListener('click', e => {
      e.stopPropagation();
      abrirProdutoModal(img.dataset.produtoId);
    });
  });
});

window.addEventListener('resize', renderTodos);
