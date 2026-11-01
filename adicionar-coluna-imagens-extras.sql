-- Rode isso uma única vez no Supabase: Dashboard > SQL Editor > New query > Run
-- ANTES de publicar o admin.js novo (senão salvar produto dá erro).
--
-- Guarda as fotos EXTRAS (outros ângulos) de cada produto, como lista de URLs.
-- A foto principal continua na coluna imagem_url (catálogo, vitrine e carrinho
-- seguem usando ela). Produtos antigos ficam com lista vazia = só a foto principal.
alter table produtos
  add column if not exists imagens_extras text[] not null default '{}';
