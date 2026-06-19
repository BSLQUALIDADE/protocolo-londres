-- ============================================================
-- POLÍTICAS RLS BÁSICAS — Protocolo de Londres
-- Decisão: todos os usuários autenticados têm o mesmo nível de acesso
-- (sem diferenciação de perfil/unidade por enquanto). Isso é suficiente
-- para a fase de teste com a equipe (2-5 pessoas).
--
-- IMPORTANTE: o backend (server.js) usa a SECRET KEY (service_role), que
-- por padrão IGNORA o RLS. Essas políticas só importam se, no futuro,
-- alguma parte do sistema passar a acessar o Supabase diretamente do
-- navegador com a chave pública (anon/publishable) em vez de passar pelo
-- backend. Mesmo assim, é boa prática de segurança ativar agora.
-- ============================================================

-- Tabela: protocolos
CREATE POLICY "Usuários autenticados podem ler protocolos"
ON protocolos FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Usuários autenticados podem inserir protocolos"
ON protocolos FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem atualizar protocolos"
ON protocolos FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem excluir protocolos"
ON protocolos FOR DELETE
TO authenticated
USING (true);

-- Tabela: etapas
CREATE POLICY "Usuários autenticados podem ler etapas"
ON etapas FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Usuários autenticados podem inserir etapas"
ON etapas FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem atualizar etapas"
ON etapas FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem excluir etapas"
ON etapas FOR DELETE
TO authenticated
USING (true);

-- Tabela: anexos
CREATE POLICY "Usuários autenticados podem ler anexos"
ON anexos FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Usuários autenticados podem inserir anexos"
ON anexos FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem atualizar anexos"
ON anexos FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem excluir anexos"
ON anexos FOR DELETE
TO authenticated
USING (true);
