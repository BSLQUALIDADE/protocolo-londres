// ============================================================
// PROTOCOLO DE LONDRES - Server v2 (com Supabase)
// ============================================================

require('dotenv').config({ path: '.env.local' });
const express = require('express');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');
const { autenticarSupabase, criarUsuarioSupabase, requireAuth } = require('./auth-supabase');
const { gerarPDFRelatorio } = require('./pdf-generator');
const { parsearTextoRelatorioParaSecoes } = require('./report-text-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================
// SUPABASE CLIENT
// ============================================================
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

let supabase = null;
let supabaseDisponivel = false;

if (SUPABASE_URL && SUPABASE_SECRET_KEY) {
    supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
        auth: { persistSession: false },
        realtime: { transport: ws }
    });
    supabaseDisponivel = true;
    console.log('✅ Cliente Supabase inicializado:', SUPABASE_URL);
} else {
    console.warn('⚠️  Variáveis SUPABASE_URL / SUPABASE_SECRET_KEY não encontradas em .env.local');
    console.warn('⚠️  Servidor vai rodar SOMENTE com localStorage (modo offline)');
}

// ============================================================
// MIDDLEWARE
// ============================================================
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname)));

// ============================================================
// ROTA DE SAÚDE / STATUS
// ============================================================
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        supabase: supabaseDisponivel,
        timestamp: new Date().toISOString()
    });
});

// ============================================================
// AUTENTICAÇÃO REAL (Supabase Auth)
// ============================================================
app.post('/api/login', async (req, res) => {
    if (!supabaseDisponivel) {
        return res.status(503).json({ sucesso: false, mensagem: 'Servidor sem conexão com o banco de dados. Tente novamente em instantes.' });
    }
    const { email, senha } = req.body;
    if (!email || !senha) {
        return res.status(400).json({ sucesso: false, mensagem: 'Email e senha são obrigatórios.' });
    }
    const resultado = await autenticarSupabase(supabase, email, senha);
    if (resultado.sucesso) {
        res.json(resultado);
    } else {
        res.status(401).json(resultado);
    }
});

// Endpoint administrativo para cadastrar novos usuários da equipe.
// Protegido por uma chave de administração simples (ADMIN_SETUP_KEY no
// .env.local) — não é um sistema de permissões completo, apenas evita que
// qualquer pessoa na internet possa criar contas no sistema.
app.post('/api/admin/criar-usuario', async (req, res) => {
    if (!supabaseDisponivel) {
        return res.status(503).json({ sucesso: false, mensagem: 'Servidor sem conexão com o banco de dados.' });
    }
    const { chave_admin, email, senha, nome, cargo } = req.body;
    if (chave_admin !== process.env.ADMIN_SETUP_KEY) {
        return res.status(403).json({ sucesso: false, mensagem: 'Chave de administração inválida.' });
    }
    if (!email || !senha || !nome) {
        return res.status(400).json({ sucesso: false, mensagem: 'email, senha e nome são obrigatórios.' });
    }
    const resultado = await criarUsuarioSupabase(supabase, { email, senha, nome, cargo });
    if (resultado.sucesso) {
        res.json(resultado);
    } else {
        res.status(400).json(resultado);
    }
});

// ============================================================
// MIDDLEWARE: verifica se Supabase está disponível antes das rotas /api/protocolos
// ============================================================
function requireSupabase(req, res, next) {
    if (!supabaseDisponivel) {
        return res.status(503).json({
            erro: 'Supabase não configurado neste servidor. Use o modo localStorage no frontend.',
            supabase: false
        });
    }
    next();
}

// ============================================================
// CRUD: PROTOCOLOS
// ============================================================

// Lista todos os protocolos
app.get('/api/protocolos', requireSupabase, requireAuth(supabase), async (req, res) => {
    try {
        const { status } = req.query;
        let query = supabase.from('protocolos').select('*').order('ultima_atualizacao', { ascending: false });
        if (status) query = query.eq('status', status);

        const { data, error } = await query;
        if (error) throw error;
        res.json({ sucesso: true, protocolos: data });
    } catch (err) {
        console.error('Erro ao listar protocolos:', err.message);
        res.status(500).json({ sucesso: false, erro: err.message });
    }
});

// Busca um protocolo específico (com etapas e anexos)
app.get('/api/protocolos/:uuid', requireSupabase, requireAuth(supabase), async (req, res) => {
    try {
        const { uuid } = req.params;

        const { data: protocolo, error: errP } = await supabase
            .from('protocolos').select('*').eq('uuid', uuid).single();
        if (errP) throw errP;

        const { data: etapas, error: errE } = await supabase
            .from('etapas').select('*').eq('protocolo_uuid', uuid).order('numero_etapa');
        if (errE) throw errE;

        const { data: anexos, error: errA } = await supabase
            .from('anexos').select('*').eq('protocolo_uuid', uuid);
        if (errA) throw errA;

        res.json({ sucesso: true, protocolo, etapas, anexos });
    } catch (err) {
        console.error('Erro ao buscar protocolo:', err.message);
        res.status(404).json({ sucesso: false, erro: err.message });
    }
});

// Cria novo protocolo (rascunho)
app.post('/api/protocolos', requireSupabase, requireAuth(supabase), async (req, res) => {
    try {
        const { uuid } = req.body;
        const novoProtocolo = {
            uuid: uuid,
            numero: null,
            status: 'rascunho',
            nome_residente: null,
            data_ocorrencia: null,
            data_abertura: new Date().toISOString(),
            data_encerramento: null,
            ultima_atualizacao: new Date().toISOString()
        };

        const { data, error } = await supabase.from('protocolos').insert(novoProtocolo).select().single();
        if (error) throw error;

        res.json({ sucesso: true, protocolo: data });
    } catch (err) {
        console.error('Erro ao criar protocolo:', err.message);
        res.status(500).json({ sucesso: false, erro: err.message });
    }
});

// Atualiza metadados do protocolo (numero, status, etc)
app.patch('/api/protocolos/:uuid', requireSupabase, requireAuth(supabase), async (req, res) => {
    try {
        const { uuid } = req.params;
        const updates = { ...req.body, ultima_atualizacao: new Date().toISOString() };

        const { data, error } = await supabase
            .from('protocolos').update(updates).eq('uuid', uuid).select().single();
        if (error) throw error;

        res.json({ sucesso: true, protocolo: data });
    } catch (err) {
        console.error('Erro ao atualizar protocolo:', err.message);
        res.status(500).json({ sucesso: false, erro: err.message });
    }
});

// Exclui protocolo (cascade remove etapas e anexos)
app.delete('/api/protocolos/:uuid', requireSupabase, requireAuth(supabase), async (req, res) => {
    try {
        const { uuid } = req.params;
        const { error } = await supabase.from('protocolos').delete().eq('uuid', uuid);
        if (error) throw error;
        res.json({ sucesso: true });
    } catch (err) {
        console.error('Erro ao excluir protocolo:', err.message);
        res.status(500).json({ sucesso: false, erro: err.message });
    }
});

// ============================================================
// CRUD: ETAPAS
// ============================================================

// Salva (upsert) os dados de uma etapa de um protocolo
app.put('/api/protocolos/:uuid/etapas/:numero', requireSupabase, requireAuth(supabase), async (req, res) => {
    try {
        const { uuid, numero } = req.params;
        const dados = req.body;

        // Verifica se já existe registro dessa etapa pra esse protocolo
        const { data: existente, error: errBusca } = await supabase
            .from('etapas')
            .select('id')
            .eq('protocolo_uuid', uuid)
            .eq('numero_etapa', numero)
            .maybeSingle();
        if (errBusca) throw errBusca;

        let resultado;
        if (existente) {
            const { data, error } = await supabase
                .from('etapas')
                .update({ dados, atualizado_em: new Date().toISOString() })
                .eq('id', existente.id)
                .select()
                .single();
            if (error) throw error;
            resultado = data;
        } else {
            const { data, error } = await supabase
                .from('etapas')
                .insert({ protocolo_uuid: uuid, numero_etapa: parseInt(numero), dados })
                .select()
                .single();
            if (error) throw error;
            resultado = data;
        }

        // Lógica de negócio: gerar número do protocolo se etapa 1+2 completas
        if (numero === '1' || numero === '2') {
            await tentarGerarNumeroProtocolo(uuid);
        }

        // Lógica: status em_analise / encerrado
        if (numero === '17' && dados.relatorio_gerado) {
            await supabase.from('protocolos').update({
                status: 'encerrado',
                data_encerramento: new Date().toISOString(),
                ultima_atualizacao: new Date().toISOString()
            }).eq('uuid', uuid);
        } else if (parseInt(numero) >= 2) {
            const { data: meta } = await supabase.from('protocolos').select('numero, status').eq('uuid', uuid).single();
            if (meta && meta.numero && meta.status === 'aberto') {
                await supabase.from('protocolos').update({
                    status: 'em_analise',
                    ultima_atualizacao: new Date().toISOString()
                }).eq('uuid', uuid);
            }
        }

        res.json({ sucesso: true, etapa: resultado });
    } catch (err) {
        console.error('Erro ao salvar etapa:', err.message);
        res.status(500).json({ sucesso: false, erro: err.message });
    }
});

// Busca os dados de uma etapa específica
app.get('/api/protocolos/:uuid/etapas/:numero', requireSupabase, requireAuth(supabase), async (req, res) => {
    try {
        const { uuid, numero } = req.params;
        const { data, error } = await supabase
            .from('etapas')
            .select('*')
            .eq('protocolo_uuid', uuid)
            .eq('numero_etapa', numero)
            .maybeSingle();
        if (error) throw error;
        res.json({ sucesso: true, etapa: data });
    } catch (err) {
        console.error('Erro ao buscar etapa:', err.message);
        res.status(500).json({ sucesso: false, erro: err.message });
    }
});

// ============================================================
// GERAÇÃO DE PDF
// ============================================================
app.get('/api/protocolos/:uuid/pdf', requireSupabase, requireAuth(supabase), async (req, res) => {
    try {
        const { uuid } = req.params;

        const { data: protocolo, error: errP } = await supabase
            .from('protocolos').select('*').eq('uuid', uuid).single();
        if (errP) throw errP;

        const { data: etapa17, error: errE } = await supabase
            .from('etapas').select('dados').eq('protocolo_uuid', uuid).eq('numero_etapa', 17).maybeSingle();
        if (errE) throw errE;

        const textoRelatorio = etapa17?.dados?.texto_relatorio;
        if (!textoRelatorio) {
            return res.status(400).json({
                sucesso: false,
                erro: 'Relatório ainda não foi gerado para este protocolo. Acesse a Etapa 17 e clique em "Gerar Rascunho" primeiro.'
            });
        }

        const secoes = parsearTextoRelatorioParaSecoes(textoRelatorio);
        const pdfBuffer = await gerarPDFRelatorio(protocolo, secoes);

        const nomeArquivo = `Protocolo_${(protocolo.numero || 'rascunho').replace(/\./g, '_')}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo}"`);
        res.send(pdfBuffer);
    } catch (err) {
        console.error('Erro ao gerar PDF:', err.message);
        res.status(500).json({ sucesso: false, erro: err.message });
    }
});

// ============================================================
// LÓGICA DE NEGÓCIO: gerar número de protocolo
// ============================================================
async function tentarGerarNumeroProtocolo(uuid) {
    const { data: protocolo, error: errP } = await supabase
        .from('protocolos').select('*').eq('uuid', uuid).single();
    if (errP || !protocolo || protocolo.numero) return protocolo?.numero || null;

    const { data: etapa1 } = await supabase
        .from('etapas').select('dados').eq('protocolo_uuid', uuid).eq('numero_etapa', 1).maybeSingle();
    const { data: etapa2 } = await supabase
        .from('etapas').select('dados').eq('protocolo_uuid', uuid).eq('numero_etapa', 2).maybeSingle();

    const nome = etapa1?.dados?.nome;
    const dataOcorrencia = etapa2?.dados?.data_ocorrencia;

    if (!nome || !dataOcorrencia) return null;

    const iniciais = nome.trim().split(/\s+/).filter(Boolean).map(p => p[0].toUpperCase()).join('');

    // Busca e incrementa contador global de forma atômica via RPC seria ideal,
    // mas pra simplicidade usamos contagem de protocolos com número existente + 1
    const { count } = await supabase
        .from('protocolos')
        .select('*', { count: 'exact', head: true })
        .not('numero', 'is', null);

    const seq = (count || 0) + 1;
    const seqFormatado = String(seq).padStart(6, '0');

    const [ano, mes, dia] = dataOcorrencia.split('-');
    const dataFormatada = `${dia}${mes}${ano.slice(2)}`;

    const numero = `${iniciais}.${seqFormatado}.${dataFormatada}`;

    await supabase.from('protocolos').update({
        numero,
        nome_residente: nome,
        data_ocorrencia: dataOcorrencia,
        status: protocolo.status === 'rascunho' ? 'aberto' : protocolo.status,
        ultima_atualizacao: new Date().toISOString()
    }).eq('uuid', uuid);

    return numero;
}

// ============================================================
// ESTATÍSTICAS DO DASHBOARD
// ============================================================
app.get('/api/estatisticas', requireSupabase, requireAuth(supabase), async (req, res) => {
    try {
        const { data: protocolos, error } = await supabase
            .from('protocolos').select('status, data_abertura, data_encerramento').not('numero', 'is', null);
        if (error) throw error;

        const counts = { aberto: 0, em_analise: 0, encerrado: 0 };
        protocolos.forEach(p => {
            if (p.status === 'aberto') counts.aberto++;
            else if (p.status === 'em_analise') counts.em_analise++;
            else if (p.status === 'encerrado') counts.encerrado++;
        });

        const encerrados = protocolos.filter(p => p.status === 'encerrado' && p.data_encerramento);
        let tempoMedio = null;
        if (encerrados.length > 0) {
            const totalDias = encerrados.reduce((sum, p) => {
                const dias = Math.max(0, Math.round((new Date(p.data_encerramento) - new Date(p.data_abertura)) / (1000 * 60 * 60 * 24)));
                return sum + dias;
            }, 0);
            tempoMedio = Math.round(totalDias / encerrados.length);
        }

        res.json({ sucesso: true, ...counts, tempoMedio, total: protocolos.length });
    } catch (err) {
        console.error('Erro ao calcular estatísticas:', err.message);
        res.status(500).json({ sucesso: false, erro: err.message });
    }
});

// ============================================================
// START
// ============================================================
app.listen(PORT, () => {
    console.log(`\n🏥 Protocolo de Londres - Server v2`);
    console.log(`📡 Rodando em http://localhost:${PORT}`);
    console.log(`🗄️  Supabase: ${supabaseDisponivel ? '✅ Conectado' : '❌ Offline (modo localStorage)'}\n`);
});
