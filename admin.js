// ── Conexão com o Supabase ─────────────────────────────────────────
// Mesma URL e mesma chave "publishable" usadas no site principal.
// A proteção de verdade não é essa chave (ela é pública por design),
// e sim: 1) o login abaixo (Supabase Auth) e 2) as regras de RLS que
// exigem estar autenticado pra inserir/editar/apagar produtos.
const SUPABASE_URL = 'https://padjfxslzjhgtqujdkbx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_50YMqseOFR5Yma5AF1FCuQ_Y5xVaHBj';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const telaLogin = document.getElementById('tela-login');
const telaAdmin = document.getElementById('tela-admin');

function mostrarAdmin() {
  telaLogin.classList.add('oculto');
  telaAdmin.classList.remove('oculto');
  carregarListaProdutos();
}

function mostrarLogin() {
  telaAdmin.classList.add('oculto');
  telaLogin.classList.remove('oculto');
}

// Se já existir uma sessão válida (login anterior), pula direto pro painel
supabaseClient.auth.getSession().then(({ data }) => {
  if (data.session) mostrarAdmin();
});

// ── Login ────────────────────────────────────────────────────────
document.getElementById('form-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const senha = document.getElementById('login-senha').value;
  const erroEl = document.getElementById('login-erro');
  erroEl.textContent = '';

  const { error } = await supabaseClient.auth.signInWithPassword({ email, password: senha });
  if (error) {
    erroEl.textContent = 'E-mail ou senha incorretos.';
    return;
  }
  mostrarAdmin();
});

document.getElementById('btn-sair').addEventListener('click', async () => {
  await supabaseClient.auth.signOut();
  mostrarLogin();
});

// ── Preview da foto escolhida ───────────────────────────────────────
const inputFoto = document.getElementById('produto-foto');
const previewFoto = document.getElementById('produto-preview');
inputFoto.addEventListener('change', () => {
  const arquivo = inputFoto.files[0];
  if (!arquivo) {
    // Se está editando e a pessoa desmarcar o arquivo, volta a mostrar
    // a foto atual do produto em vez de esconder a prévia.
    if (produtoEmEdicao && fotoAtualUrl) {
      previewFoto.src = fotoAtualUrl;
      previewFoto.classList.remove('oculto');
    } else {
      previewFoto.classList.add('oculto');
    }
    return;
  }
  previewFoto.src = URL.createObjectURL(arquivo);
  previewFoto.classList.remove('oculto');
});

// ── Estado de edição ──────────────────────────────────────────────
// Quando produtoEmEdicao !== null, o formulário está editando aquele
// produto em vez de criar um novo. Guardamos também os produtos já
// carregados na lista (por id) pra preencher o formulário sem precisar
// buscar de novo no Supabase.
let produtoEmEdicao = null;
let fotoAtualUrl = null;
let produtosCacheAdmin = {};

const tituloForm = document.getElementById('titulo-form-produto');
const btnSalvarProduto = document.getElementById('btn-salvar-produto');
const btnCancelarEdicao = document.getElementById('btn-cancelar-edicao');
const avisoFotoEdicao = document.getElementById('produto-foto-aviso');

function entrarModoEdicao(produto) {
  produtoEmEdicao = produto.id;
  fotoAtualUrl = produto.imagem_url;

  document.getElementById('produto-nome').value = produto.nome_exibicao;
  document.getElementById('produto-categoria').value = produto.categoria;
  document.getElementById('produto-itens').value = (produto.itens || []).join('\n');
  document.getElementById('produto-preco').value = produto.preco;

  inputFoto.value = '';
  inputFoto.required = false;
  previewFoto.src = produto.imagem_url;
  previewFoto.classList.remove('oculto');
  avisoFotoEdicao.classList.remove('oculto');

  tituloForm.textContent = 'Editar produto';
  btnSalvarProduto.textContent = 'Salvar alterações';
  btnCancelarEdicao.classList.remove('oculto');

  document.getElementById('produto-erro').textContent = '';
  document.getElementById('produto-sucesso').textContent = '';
  document.getElementById('form-produto').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function sairModoEdicao() {
  produtoEmEdicao = null;
  fotoAtualUrl = null;

  document.getElementById('form-produto').reset();
  inputFoto.required = true;
  previewFoto.classList.add('oculto');
  avisoFotoEdicao.classList.add('oculto');

  tituloForm.textContent = 'Adicionar produto';
  btnSalvarProduto.textContent = 'Adicionar produto';
  btnSalvarProduto.disabled = false;
  btnCancelarEdicao.classList.add('oculto');

  document.getElementById('produto-erro').textContent = '';
  document.getElementById('produto-sucesso').textContent = '';
}

btnCancelarEdicao.addEventListener('click', sairModoEdicao);

// ── Gera um id único e legível a partir do nome do produto ──────────
function gerarId(nome) {
  const slug = nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return `${slug}-${Date.now()}`;
}

async function subirFoto(arquivo, id) {
  const extensao = arquivo.name.split('.').pop();
  const caminho = `${id}.${extensao}`;

  const { error } = await supabaseClient.storage
    .from('produtos-fotos')
    .upload(caminho, arquivo);

  if (error) throw error;

  const { data } = supabaseClient.storage
    .from('produtos-fotos')
    .getPublicUrl(caminho);

  return data.publicUrl;
}

// ── Adicionar / salvar edição de produto ─────────────────────────
document.getElementById('form-produto').addEventListener('submit', async (e) => {
  e.preventDefault();

  const erroEl = document.getElementById('produto-erro');
  const sucessoEl = document.getElementById('produto-sucesso');
  const btn = document.getElementById('btn-salvar-produto');
  erroEl.textContent = '';
  sucessoEl.textContent = '';

  const nome = document.getElementById('produto-nome').value.trim();
  const categoria = document.getElementById('produto-categoria').value;
  const itensTexto = document.getElementById('produto-itens').value.trim();
  const preco = document.getElementById('produto-preco').value.trim();
  const arquivo = inputFoto.files[0];
  const editando = Boolean(produtoEmEdicao);

  // Na edição, a foto é opcional (mantém a atual se nenhuma for escolhida).
  // Ao adicionar um produto novo, a foto continua obrigatória.
  if (!nome || !categoria || !itensTexto || !preco || (!editando && !arquivo)) {
    erroEl.textContent = 'Preenche todos os campos, incluindo a foto.';
    return;
  }

  const itens = itensTexto.split('\n').map(l => l.trim()).filter(Boolean);
  const id = editando ? produtoEmEdicao : gerarId(nome);

  btn.disabled = true;
  btn.textContent = editando ? 'Salvando...' : 'Enviando...';

  try {
    const imagemUrl = arquivo ? await subirFoto(arquivo, id) : fotoAtualUrl;

    const dadosProduto = {
      categoria,
      nome_exibicao: nome,
      nome_busca: nome,
      desc_busca: itens.join(', '),
      nome_carrinho: nome,
      imagem_url: imagemUrl,
      imagem_alt: nome,
      itens,
      preco,
    };

    const { error } = editando
      ? await supabaseClient.from('produtos').update(dadosProduto).eq('id', id)
      : await supabaseClient.from('produtos').insert({ id, ...dadosProduto });

    if (error) throw error;

    sucessoEl.textContent = editando ? 'Produto atualizado!' : 'Produto adicionado! Já está no ar.';
    sairModoEdicao();
    carregarListaProdutos();
  } catch (err) {
    console.error('Erro ao salvar produto:', err);
    erroEl.textContent = 'Não consegui salvar. Tenta de novo em alguns segundos.';
    btn.disabled = false;
    btn.textContent = editando ? 'Salvar alterações' : 'Adicionar produto';
  }
});

// ── Listar / excluir produtos ────────────────────────────────────
const NOMES_CATEGORIA = {
  buques: 'Buquês',
  glitter: 'Buquês com Glitter',
  personalizados: 'Buquês Personalizados',
  cestas: 'Cestas Personalizadas',
};

async function carregarListaProdutos() {
  const lista = document.getElementById('lista-produtos');
  lista.innerHTML = '<p class="carregando">Carregando...</p>';

  const { data, error } = await supabaseClient
    .from('produtos')
    .select('*')
    .order('criado_em', { ascending: false });

  if (error) {
    lista.innerHTML = '<p class="mensagem-erro">Não consegui carregar os produtos.</p>';
    return;
  }

  if (!data || data.length === 0) {
    lista.innerHTML = '<p class="carregando">Nenhum produto cadastrado ainda.</p>';
    return;
  }

  lista.innerHTML = '';
  produtosCacheAdmin = {};
  data.forEach(p => {
    produtosCacheAdmin[p.id] = p;
    const linha = document.createElement('div');
    linha.className = 'produto-linha';
    linha.innerHTML = `
      <img src="${p.imagem_url}" alt="">
      <div class="info">
        <div class="nome">${p.nome_exibicao}</div>
        <div class="meta">${NOMES_CATEGORIA[p.categoria] || p.categoria} · R$ ${p.preco}</div>
      </div>
      <div class="acoes">
        <button class="btn-editar" data-id="${p.id}">Editar</button>
        <button class="btn-excluir" data-id="${p.id}">Excluir</button>
      </div>
    `;
    lista.appendChild(linha);
  });

  lista.querySelectorAll('.btn-editar').forEach(btn => {
    btn.addEventListener('click', () => {
      const produto = produtosCacheAdmin[btn.dataset.id];
      if (produto) entrarModoEdicao(produto);
    });
  });

  lista.querySelectorAll('.btn-excluir').forEach(btn => {
    btn.addEventListener('click', () => excluirProduto(btn.dataset.id));
  });
}

async function excluirProduto(id) {
  if (!confirm('Tem certeza que quer excluir esse produto? Essa ação não pode ser desfeita.')) return;

  const { error } = await supabaseClient.from('produtos').delete().eq('id', id);
  if (error) {
    alert('Não consegui excluir. Tenta de novo.');
    return;
  }
  if (produtoEmEdicao === id) sairModoEdicao();
  carregarListaProdutos();
}
