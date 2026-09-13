-- Permite que usuários autenticados (logados no /admin.html) consigam
-- EDITAR produtos existentes. Sem essa política, o Supabase bloqueia
-- silenciosamente qualquer UPDATE — o que bate exatamente com "dá erro
-- ao mudar o nome" (adicionar/excluir já tinham suas próprias políticas,
-- editar é uma função nova que ainda não tinha a dela).

drop policy if exists "Permitir update para usuarios autenticados" on produtos;

create policy "Permitir update para usuarios autenticados"
on produtos
for update
to authenticated
using (true)
with check (true);
