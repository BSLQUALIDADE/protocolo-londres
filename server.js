// ============================================================
// PROTOCOLO DE LONDRES - Server v2 (com Supabase)
// ============================================================

// Carrega variáveis de ambiente (.env.local local ou Railway em produção)
const fs = require('fs');
if (fs.existsSync('.env.local')) {
    require('dotenv').config({ path: '.env.local' });
}
const { emailNovoProtocolo, emailLembretePendente, emailProtocoloEncerrado } = require('./email-service');
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
console.log('ENV CHECK:', JSON.stringify({
    SUPABASE_URL: process.env.SUPABASE_URL ? 'EXISTE' : 'FALTANDO',
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY ? 'EXISTE' : 'FALTANDO',
    NODE_ENV: process.env.NODE_ENV,
    todas: Object.keys(process.env).filter(k => k.includes('SUPA') || k.includes('ADMIN') || k.includes('EMAIL') || k.includes('RESEND'))
}));
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

// ============================================================
// AUDITORIA — RDC 502/2021
// Registra todas as ações críticas com usuário, timestamp e detalhe
// ============================================================
async function registrarLog(supabase, { protocolo_uuid, usuario, acao, detalhe, req }) {
    try {
        await supabase.from('logs_auditoria').insert({
            protocolo_uuid,
            usuario_email: usuario?.email || 'sistema',
            usuario_nome: usuario?.nome || usuario?.email || 'sistema',
            acao,
            detalhe: typeof detalhe === 'object' ? JSON.stringify(detalhe) : detalhe,
            ip_address: req?.ip || req?.headers?.['x-forwarded-for'] || null
        });
    } catch (err) {
        console.warn('Falha ao registrar log de auditoria:', err.message);
    }
}

app.get('/api/health', async (req, res) => {
    let supabaseOk = false;
    if (supabase) {
        try {
            const { error } = await supabase.from('protocolos').select('uuid').limit(1);
            supabaseOk = !error;
        } catch(e) { supabaseOk = false; }
    }
    res.json({
        status: 'ok',
        supabase: supabaseOk,
        supabaseDisponivel,
        env: {
            hasUrl: !!process.env.SUPABASE_URL,
            hasKey: !!process.env.SUPABASE_SECRET_KEY
        },
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
        supabase.from('logs_auditoria').insert({ protocolo_uuid: null, usuario_email: email, usuario_nome: resultado.usuario?.nome || email, acao: 'LOGIN', detalhe: 'Login bem-sucedido', ip_address: req.ip || null }).then(() => {}).catch(() => {});
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
            .from('protocolos').select('*').eq('uuid', uuid).maybeSingle();
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

        const { data, error } = await supabase.from('protocolos').insert(novoProtocolo).select().maybeSingle();
        if (error) throw error;

        registrarLog(supabase, {
            protocolo_uuid: data.uuid,
            usuario: req.usuario,
            acao: 'PROTOCOLO_CRIADO',
            detalhe: { uuid: data.uuid, status: data.status },
            req
        });
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
            .from('protocolos').update(updates).eq('uuid', uuid).select().maybeSingle();
        if (error) throw error;


        // Bloqueio: protocolo encerrado nao pode ser editado
        const { data: protoAtual } = await supabase
            .from('protocolos').select('status').eq('uuid', uuid).maybeSingle();
        if (protoAtual?.status === 'encerrado' && !req.body.status) {
            registrarLog(supabase, { protocolo_uuid: uuid, usuario: req.usuario, acao: 'EDICAO_BLOQUEADA', detalhe: 'Tentativa de edicao de protocolo encerrado', req });
            return res.status(403).json({ sucesso: false, erro: 'Protocolo encerrado nao pode ser editado.' });
        }
        // Dispara email quando numero do protocolo e gerado
        console.log('PATCH body:', JSON.stringify(req.body));
        if (process.env.RESEND_API_KEY && req.body.numero && data) {
            console.log('Disparando email para protocolo:', req.body.numero);
            emailNovoProtocolo({
                para: process.env.EMAIL_NOTIFICACAO || req.usuario.email,
                numero: data.numero,
                nomeResidente: data.nome_residente || '-',
                tipoIncidente: '-',
                dataOcorrencia: data.data_ocorrencia || '-',
                unidade: '-',
                responsavel: req.usuario.nome || req.usuario.email
            }).then(r => console.log('Email resultado:', JSON.stringify(r)))
              .catch(e => console.error('Email erro:', e.message));
        }
        registrarLog(supabase, {
            protocolo_uuid: uuid,
            usuario: req.usuario,
            acao: req.body.status === 'encerrado' ? 'PROTOCOLO_ENCERRADO' : req.body.numero ? 'NUMERO_GERADO' : 'PROTOCOLO_ATUALIZADO',
            detalhe: req.body,
            req
        });
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
        registrarLog(supabase, {
            protocolo_uuid: uuid,
            usuario: req.usuario,
            acao: 'PROTOCOLO_EXCLUIDO',
            detalhe: { uuid },
            req
        });
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
                .maybeSingle();
            if (error) throw error;
            resultado = data;
        } else {
            const { data, error } = await supabase
                .from('etapas')
                .insert({ protocolo_uuid: uuid, numero_etapa: parseInt(numero), dados })
                .select()
                .maybeSingle();
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
            const { data: meta } = await supabase.from('protocolos').select('numero, status').eq('uuid', uuid).maybeSingle();
            if (meta && meta.numero && meta.status === 'aberto') {
                await supabase.from('protocolos').update({
                    status: 'em_analise',
                    ultima_atualizacao: new Date().toISOString()
                }).eq('uuid', uuid);
            }
        }

        registrarLog(supabase, { protocolo_uuid: uuid, usuario: req.usuario, acao: 'ETAPA_SALVA', detalhe: { numero_etapa: numero }, req });
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
            .from('protocolos').select('*').eq('uuid', uuid).maybeSingle();
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
        .from('protocolos').select('*').eq('uuid', uuid).maybeSingle();
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
// UPLOAD DE ARQUIVOS → Supabase Storage
// ============================================================
const multer = require('multer');
const uploadMiddleware = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = ['application/pdf','image/jpeg','image/png','image/jpg',
                         'application/msword',
                         'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        if (allowed.includes(file.mimetype)) cb(null, true);
        else cb(new Error('Tipo de arquivo nao permitido: ' + file.mimetype));
    }
});

app.post('/api/protocolos/:uuid/anexos', requireSupabase, requireAuth(supabase),
    uploadMiddleware.single('arquivo'), async (req, res) => {
    try {
        const { uuid } = req.params;
        console.log('🔴 UPLOAD RECEBIDO uuid=' + uuid + ' arquivo=' + (req.file ? req.file.originalname : 'NENHUM'));
        if (!req.file) return res.status(400).json({ sucesso: false, erro: 'Nenhum arquivo enviado.' });

        const timestamp = Date.now();
        const nomeSeguro = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
        const caminhoStorage = uuid + '/' + timestamp + '_' + nomeSeguro;

        const { error: uploadErr } = await supabase.storage
            .from('anexos-protocolos')
            .upload(caminhoStorage, req.file.buffer, {
                contentType: req.file.mimetype, upsert: false
            });
        if (uploadErr) return res.status(500).json({ sucesso: false, erro: uploadErr.message });

        const { data: urlData } = await supabase.storage
            .from('anexos-protocolos')
            .createSignedUrl(caminhoStorage, 60 * 60 * 24 * 7);

        const { data: anexo, error: dbErr } = await supabase
            .from('anexos')
            .insert({
                protocolo_uuid: uuid,
                nome_arquivo: req.file.originalname,
                tipo_mime: req.file.mimetype,
                caminho_storage: caminhoStorage,
                tamanho_bytes: req.file.size
            }).select().maybeSingle();

        if (dbErr) {
            await supabase.storage.from('anexos-protocolos').remove([caminhoStorage]);
            return res.status(500).json({ sucesso: false, erro: dbErr.message });
        }

        res.json({ sucesso: true, anexo: {
            id: anexo.id, nome: req.file.originalname,
            tipo: anexo.tipo_arquivo, tamanho: req.file.size,
            url: urlData?.signedUrl || null, caminho: caminhoStorage
        }});
    } catch (err) {
        console.error('Erro no upload:', err.message);
        res.status(500).json({ sucesso: false, erro: err.message });
    }
});

app.get('/api/protocolos/:uuid/anexos', requireSupabase, requireAuth(supabase), async (req, res) => {
    try {
        const { data: anexos, error } = await supabase
            .from('anexos').select('*').eq('protocolo_uuid', req.params.uuid)
            .order('criado_em', { ascending: false });
        if (error) return res.status(500).json({ sucesso: false, erro: error.message });

        const anexosComUrl = await Promise.all((anexos || []).map(async (a) => {
            const { data: urlData } = await supabase.storage
                .from('anexos-protocolos')
                .createSignedUrl(a.caminho_storage, 60 * 60 * 24 * 7);
            return { ...a, url_download: urlData?.signedUrl || null };
        }));
        res.json({ sucesso: true, anexos: anexosComUrl });
    } catch (err) {
        res.status(500).json({ sucesso: false, erro: err.message });
    }
});

app.delete('/api/protocolos/:uuid/anexos/:id', requireSupabase, requireAuth(supabase), async (req, res) => {
    try {
        const { data: anexo } = await supabase.from('anexos')
            .select('caminho_storage').eq('id', req.params.id)
            .eq('protocolo_uuid', req.params.uuid).maybeSingle();
        if (!anexo) return res.status(404).json({ sucesso: false, erro: 'Anexo nao encontrado.' });
        await supabase.storage.from('anexos-protocolos').remove([anexo.caminho_storage]);
        await supabase.from('anexos').delete().eq('id', req.params.id);
        res.json({ sucesso: true });
    } catch (err) {
        res.status(500).json({ sucesso: false, erro: err.message });
    }
});


// ============================================================
// JOB: LEMBRETE DE ETAPAS PENDENTES (executa a cada hora)
// Verifica protocolos abertos há mais de 7 dias e envia email
// ============================================================
async function verificarProtocolosPendentes() {
    if (!supabaseDisponivel || !process.env.RESEND_API_KEY) return;
    try {
        const seteDiasAtras = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const { data: protocolos } = await supabase
            .from('protocolos')
            .select('*')
            .in('status', ['aberto', 'em_analise'])
            .lt('data_abertura', seteDiasAtras)
            .not('numero', 'is', null);

        if (!protocolos || protocolos.length === 0) return;

        // Busca todos os usuários autenticados para notificar
        const { data: usuarios } = await supabase.auth.admin.listUsers();
        const emails = (usuarios?.users || []).map(u => u.email).filter(Boolean);

        for (const proto of protocolos) {
            const diasAberto = Math.round((Date.now() - new Date(proto.data_abertura)) / (1000 * 60 * 60 * 24));

            // Verifica quais etapas estão faltando
            const { data: etapas } = await supabase
                .from('etapas')
                .select('numero_etapa')
                .eq('protocolo_uuid', proto.uuid);

            const etapasFeitas = new Set((etapas || []).map(e => e.numero_etapa));
            const ETAPA_NOMES = {
                1:'Dados do Residente', 2:'Informações do Evento', 3:'Cronologia',
                4:'Entrevistas', 5:'Análise por IA', 6:'PPC', 7:'Fatores Contribuintes',
                8:'Segunda Vítima', 9:'Disclosure', 10:'Jurídico', 11:'Matriz GUT',
                12:'Esforço x Impacto', 13:'Ishikawa', 14:'Plano 5W2H',
                15:'Diário de Bordo', 16:'Monitoramento', 17:'Relatório Final'
            };
            const etapasPendentes = [];
            for (let i = 1; i <= 16; i++) {
                if (!etapasFeitas.has(i)) etapasPendentes.push('Etapa ' + i + ': ' + ETAPA_NOMES[i]);
            }

            if (etapasPendentes.length === 0) continue;

            // Envia para todos os usuários
            for (const email of emails) {
                await emailLembretePendente({
                    para: email,
                    numero: proto.numero,
                    nomeResidente: proto.nome_residente || '—',
                    etapasPendentes: etapasPendentes.slice(0, 5), // máximo 5 na lista
                    diasAberto
                }).catch(err => console.warn('Lembrete falhou para ' + email + ':', err.message));
            }
            console.log('Lembrete enviado para protocolo ' + proto.numero + ' (' + diasAberto + ' dias aberto)');
        }
    } catch (err) {
        console.error('Erro no job de lembretes:', err.message);
    }
}

// Executa a cada hora (3.600.000ms)
setInterval(verificarProtocolosPendentes, 60 * 60 * 1000);
// Executa também 30 segundos após o servidor iniciar (pra testar sem esperar 1h)
setTimeout(verificarProtocolosPendentes, 30000);

// GET /api/protocolos/:uuid/logs — retorna log de auditoria do protocolo
app.get('/api/protocolos/:uuid/logs', requireSupabase, requireAuth(supabase), async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('logs_auditoria')
            .select('*')
            .eq('protocolo_uuid', req.params.uuid)
            .order('criado_em', { ascending: false })
            .limit(100);
        if (error) throw error;
        res.json({ sucesso: true, logs: data || [] });
    } catch (err) {
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
