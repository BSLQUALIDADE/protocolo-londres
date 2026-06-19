// ============================================================
// AUTENTICAÇÃO REAL via Supabase Auth
// Substitui o mock baseado em usuarios-mock.json
// ============================================================

// Login: usa o client "anon" do Supabase (mesmo client usado pelo resto do
// app) para validar email/senha via signInWithPassword. Retorna o usuário
// e o access_token (sessão) em caso de sucesso.
async function autenticarSupabase(supabase, email, senha) {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: senha
    });

    if (error || !data.session) {
        return { sucesso: false, mensagem: 'Email ou senha incorretos.' };
    }

    return {
        sucesso: true,
        usuario: {
            id: data.user.id,
            email: data.user.email,
            nome: data.user.user_metadata?.nome || data.user.email,
            cargo: data.user.user_metadata?.cargo || '',
        },
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token
    };
}

// Cria um usuário real no Supabase Auth. Usa o client "admin" (service role
// key) — NUNCA exponha esse client no navegador, somente no backend.
// email_confirm: true evita o envio de email de confirmação (útil para
// contas internas criadas manualmente pelo administrador do sistema).
async function criarUsuarioSupabase(supabaseAdmin, { email, senha, nome, cargo }) {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: senha,
        email_confirm: true,
        user_metadata: { nome, cargo }
    });

    if (error) {
        return { sucesso: false, mensagem: error.message };
    }

    return { sucesso: true, usuario: { id: data.user.id, email: data.user.email, nome, cargo } };
}

// Middleware Express: valida o token Bearer enviado pelo frontend e injeta
// req.usuario com os dados do usuário autenticado. Usa o client "anon" para
// validar o token (getUser funciona com qualquer client, valida o JWT).
function requireAuth(supabase) {
    return async (req, res, next) => {
        const authHeader = req.headers.authorization || '';
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

        if (!token) {
            return res.status(401).json({ sucesso: false, mensagem: 'Token de autenticação não fornecido.' });
        }

        const { data, error } = await supabase.auth.getUser(token);
        if (error || !data.user) {
            return res.status(401).json({ sucesso: false, mensagem: 'Sessão inválida ou expirada. Faça login novamente.' });
        }

        req.usuario = {
            id: data.user.id,
            email: data.user.email,
            nome: data.user.user_metadata?.nome || data.user.email,
            cargo: data.user.user_metadata?.cargo || ''
        };
        next();
    };
}

module.exports = { autenticarSupabase, criarUsuarioSupabase, requireAuth };
