// ============================================================
// PROTOCOLO DE LONDRES - Componentes Compartilhados (v2 multi-protocolo)
// ============================================================

const STAGE_NAMES = {
    1: 'Dados do Residente', 2: 'Informações do Evento', 3: 'Cronologia',
    4: 'Entrevistas', 5: 'Análise por IA', 6: 'PPC', 7: 'Fatores Contribuintes',
    8: 'Segunda Vítima', 9: 'Disclosure', 10: 'Jurídico', 11: 'Matriz GUT',
    12: 'Esforço × Impacto', 13: 'Diagrama de Ishikawa', 14: 'Plano 5W2H',
    15: 'Diário de Bordo', 16: 'Monitoramento', 17: 'Relatório Final'
};

// ============================================================
// AUTENTICAÇÃO (Supabase Auth via /api/login)
// ============================================================

// Protege uma página: se não houver token de sessão salvo, redireciona
// para a tela de login. Chame isso no topo do <script> de cada página
// protegida (novo-protocolo.html, etapa-N.html, etc), antes de qualquer
// outra coisa.
function exigirAutenticacao() {
    const token = localStorage.getItem('auth-token');
    if (!token) {
        window.location.href = 'index.html';
        return false;
    }
    return true;
}

// Retorna os dados do usuário atualmente logado (nome, email, cargo),
// ou null se não houver sessão.
function getUsuarioLogado() {
    const raw = localStorage.getItem('usuario-logado');
    return raw ? JSON.parse(raw) : null;
}

// Encerra a sessão local e volta para a tela de login.
function logout() {
    localStorage.removeItem('auth-token');
    localStorage.removeItem('auth-refresh-token');
    localStorage.removeItem('usuario-logado');
    window.location.href = 'index.html';
}

// Wrapper de fetch que injeta automaticamente o header Authorization com
// o token de sessão atual. Use no lugar de fetch() puro para chamadas à
// API que exigem autenticação. Se a API responder 401 (sessão expirada),
// desloga automaticamente e redireciona para o login.
async function fetchAutenticado(url, options = {}) {
    const token = localStorage.getItem('auth-token');
    const headers = {
        ...(options.headers || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
    const response = await fetch(url, { ...options, headers });
    if (response.status === 401) {
        logout();
    }
    return response;
}



// Estrutura no localStorage:
// "protocolos-meta" -> { "uuid1": {uuid, numero, status, nome_residente, iniciais, data_ocorrencia, data_abertura, data_encerramento}, ... }
// "protocolo-contador" -> 5 (próximo número sequencial)
// "protocolo-ativo" -> "uuid1" (qual protocolo está sendo editado agora)
// "protocolo:uuid1:etapa-1" -> {...dados da etapa...}

function generateUUID() {
    return 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
}

function getProtocolosMeta() {
    const raw = localStorage.getItem('protocolos-meta');
    return raw ? JSON.parse(raw) : {};
}

function saveProtocolosMeta(meta) {
    localStorage.setItem('protocolos-meta', JSON.stringify(meta));
}

function getProtocoloAtivo() {
    return localStorage.getItem('protocolo-ativo');
}

function setProtocoloAtivo(uuid) {
    localStorage.setItem('protocolo-ativo', uuid);
}

function getProtocoloContador() {
    return parseInt(localStorage.getItem('protocolo-contador') || '0');
}

function incrementProtocoloContador() {
    const next = getProtocoloContador() + 1;
    localStorage.setItem('protocolo-contador', String(next));
    return next;
}

// Cria um novo protocolo (rascunho, sem número ainda) e o torna ativo
function criarNovoProtocolo() {
    const uuid = generateUUID();
    const agora = new Date().toISOString();
    const meta = getProtocolosMeta();
    meta[uuid] = {
        uuid: uuid,
        numero: null,
        status: 'rascunho',
        nome_residente: null,
        data_ocorrencia: null,
        data_abertura: agora,
        data_encerramento: null,
        ultima_atualizacao: agora
    };
    saveProtocolosMeta(meta);
    setProtocoloAtivo(uuid);

    // Registra no banco em segundo plano (fire-and-forget)
    // sem bloquear a UI — se falhar, o sync tentará novamente depois
    (async () => {
        try {
            await fetchAutenticado('/api/protocolos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uuid, status: 'rascunho', data_abertura: agora })
            });
        } catch (err) {
            console.warn('Falha ao registrar protocolo no banco (será sincronizado depois):', err.message);
        }
    })();

    return uuid;
}

function getProtocoloMetaAtivo() {
    const uuid = getProtocoloAtivo();
    if (!uuid) return null;
    const meta = getProtocolosMeta();
    return meta[uuid] || null;
}

function updateProtocoloMetaAtivo(updates) {
    const uuid = getProtocoloAtivo();
    if (!uuid) return;
    const meta = getProtocolosMeta();
    if (!meta[uuid]) return;
    Object.assign(meta[uuid], updates, { ultima_atualizacao: new Date().toISOString() });
    saveProtocolosMeta(meta);

    // Sincroniza com o backend em background (especialmente importante quando
    // o numero do protocolo é gerado, para disparar o email de notificação)
    (async () => {
        try {
            await fetchAutenticado('/api/protocolos/' + uuid, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates)
            });
        } catch (err) {
            console.warn('Falha ao sincronizar meta do protocolo:', err.message);
        }
    })();
}

function extrairIniciais(nomeCompleto) {
    if (!nomeCompleto) return '';
    const partes = nomeCompleto.trim().split(/\s+/).filter(Boolean);
    return partes.map(p => p[0].toUpperCase()).join('');
}

function formatarDataNumero(dataISO) {
    // dataISO formato YYYY-MM-DD -> DDMMAA
    if (!dataISO) return '';
    const [ano, mes, dia] = dataISO.split('-');
    return `${dia}${mes}${ano.slice(2)}`;
}

// Tenta gerar o número do protocolo se Etapa 1 (nome) e Etapa 2 (data_ocorrencia) estiverem completas.
// Chamado após salvar a Etapa 1 ou a Etapa 2.
async function tentarGerarNumeroProtocolo() {
    const uuid = getProtocoloAtivo();
    if (!uuid) return null;

    const meta = getProtocolosMeta();
    const protocolo = meta[uuid];
    if (!protocolo || protocolo.numero) return protocolo?.numero || null; // já tem número

    const etapa1 = await loadStageData(1);
    const etapa2 = await loadStageData(2);

    const nome = etapa1?.nome;
    const dataOcorrencia = etapa2?.data_ocorrencia;

    if (!nome || !dataOcorrencia) return null; // ainda não tem o necessário

    const iniciais = extrairIniciais(nome);
    const seq = incrementProtocoloContador();
    const seqFormatado = String(seq).padStart(6, '0');
    const dataFormatada = formatarDataNumero(dataOcorrencia);

    const numero = `${iniciais}.${seqFormatado}.${dataFormatada}`;

    updateProtocoloMetaAtivo({
        numero: numero,
        nome_residente: nome,
        data_ocorrencia: dataOcorrencia,
        unidade: etapa1?.unidade || null,
        status: protocolo.status === 'rascunho' ? 'aberto' : protocolo.status
    });

    return numero;
}

function listarProtocolos() {
    const meta = getProtocolosMeta();
    return Object.values(meta).sort((a, b) => new Date(b.ultima_atualizacao) - new Date(a.ultima_atualizacao));
}
async function sincronizarProtocolosDoBanco(onComplete) {
    try {
        const res = await fetchAutenticado('/api/protocolos');
        if (!res || !res.ok) { if (onComplete) onComplete(); return; }
        const json = await res.json();
        if (!json.sucesso || !Array.isArray(json.protocolos)) { if (onComplete) onComplete(); return; }
        const meta = getProtocolosMeta();
        json.protocolos.forEach(p => {
            const local = meta[p.uuid];
            if (!local || new Date(p.ultima_atualizacao) > new Date(local.ultima_atualizacao || 0)) {
                meta[p.uuid] = { uuid: p.uuid, numero: p.numero, status: p.status, nome_residente: p.nome_residente, data_ocorrencia: p.data_ocorrencia, data_abertura: p.data_abertura, data_encerramento: p.data_encerramento, ultima_atualizacao: p.ultima_atualizacao, unidade: p.unidade || local?.unidade || null };
            }
        });
        saveProtocolosMeta(meta);
        if (onComplete) onComplete();
    } catch (err) { if (onComplete) onComplete(); }
}
(function() {
    const token = localStorage.getItem('auth-token');
    if (!token) return;
    setTimeout(() => { sincronizarProtocolosDoBanco(() => { window.dispatchEvent(new CustomEvent('protocolos-sincronizados')); }); }, 300);
})();

function listarProtocolosComNumero() {
    return listarProtocolos().filter(p => p.numero).map(p => {
        // Enriquece com dados da etapa 1 (unidade) e etapa 2 (tipo_incidente)
        const uuid = p.uuid;
        const etapa1Raw = localStorage.getItem('protocolo:' + uuid + ':etapa-1');
        const etapa2Raw = localStorage.getItem('protocolo:' + uuid + ':etapa-2');
        const etapa1 = etapa1Raw ? JSON.parse(etapa1Raw) : null;
        const etapa2 = etapa2Raw ? JSON.parse(etapa2Raw) : null;
        return {
            ...p,
            unidade: p.unidade || etapa1?.unidade || null,
            tipo_incidente: etapa2?.tipo_incidente || null,
        };
    });
}

function contarProtocolosPorStatus() {
    const protocolos = listarProtocolosComNumero();
    const counts = { aberto: 0, em_analise: 0, encerrado: 0 };
    protocolos.forEach(p => {
        if (p.status === 'aberto') counts.aberto++;
        else if (p.status === 'em_analise') counts.em_analise++;
        else if (p.status === 'encerrado') counts.encerrado++;
    });
    return counts;
}

function calcularTempoMedioDias() {
    const encerrados = listarProtocolosComNumero().filter(p => p.status === 'encerrado' && p.data_encerramento);
    if (encerrados.length === 0) return null;
    const totalDias = encerrados.reduce((sum, p) => {
        const abertura = new Date(p.data_abertura);
        const encerramento = new Date(p.data_encerramento);
        const dias = Math.max(0, Math.round((encerramento - abertura) / (1000 * 60 * 60 * 24)));
        return sum + dias;
    }, 0);
    return Math.round(totalDias / encerrados.length);
}

function excluirProtocolo(uuid) {
    const meta = getProtocolosMeta();
    delete meta[uuid];
    saveProtocolosMeta(meta);
    for (let i = 1; i <= 17; i++) {
        localStorage.removeItem(`protocolo:${uuid}:etapa-${i}`);
    }
    if (getProtocoloAtivo() === uuid) {
        localStorage.removeItem('protocolo-ativo');
    }
}

function abrirProtocolo(uuid) {
    setProtocoloAtivo(uuid);
    window.location.href = '/novo-protocolo.html';
}

// ============================================================
// NAVEGAÇÃO ENTRE ETAPAS
// ============================================================
function goToStage(num) {
    window.location.href = `/etapa-${num}.html`;
}

function goToList() {
    window.location.href = '/novo-protocolo.html';
}

function goToDashboard() {
    window.location.href = '/dashboard.html';
}

function goToProtocolosList() {
    window.location.href = '/protocolos.html';
}

function renderStageNav(currentStage) {
    const navContainer = document.getElementById('stageNav');
    if (!navContainer) return;

    let html = '';
    if (currentStage > 1) {
        html += `<button type="button" class="btn-nav" onclick="goToStage(${currentStage - 1})">← Etapa Anterior</button>`;
    }
    if (currentStage < 17) {
        html += `<button type="button" class="btn-nav primary" onclick="goToStage(${currentStage + 1})">Próxima Etapa →</button>`;
    } else {
        html += `<button type="button" class="btn-nav primary" onclick="goToList()">Concluir e Voltar ao Painel</button>`;
    }
    navContainer.innerHTML = html;
}

function showAlert(message, type = 'success') {
    const alertDiv = document.getElementById('alert');
    if (!alertDiv) return;
    alertDiv.textContent = message;
    alertDiv.className = `alert ${type} show`;
    setTimeout(() => {
        alertDiv.classList.remove('show');
    }, 4000);
}

function markStageComplete(num) {
    const uuid = getProtocoloAtivo();
    if (!uuid) return;
    localStorage.setItem(`protocolo:${uuid}:etapa-${num}-completa`, 'true');
}

function isStageComplete(num, uuid) {
    const id = uuid || getProtocoloAtivo();
    if (!id) return false;
    return localStorage.getItem(`protocolo:${id}:etapa-${num}`) !== null;
}

// Busca de uma vez (1 chamada) todos os dados do protocolo no backend —
// metadados + todas as etapas já preenchidas — e popula o localStorage.
// Usada para "hidratar" o cache local quando o protocolo foi preenchido
// em outro navegador/dispositivo, ou diretamente no banco de dados.
// Retorna true se algo novo foi sincronizado, false em caso de falha/nada novo.
async function sincronizarProtocoloCompletoComAPI(uuid) {
    try {
        const response = await fetchAutenticado(`/api/protocolos/${uuid}`);
        if (!response.ok) return false;
        const json = await response.json();
        if (!json.sucesso) return false;

        let algoMudou = false;

        // Sincroniza metadados do protocolo (número, status, nome, datas)
        if (json.protocolo) {
            const meta = getProtocolosMeta();
            const metaLocal = meta[uuid] || {};
            const metaRemota = {
                uuid: uuid,
                numero: json.protocolo.numero,
                status: json.protocolo.status,
                nome_residente: json.protocolo.nome_residente,
                data_ocorrencia: json.protocolo.data_ocorrencia,
                data_abertura: json.protocolo.data_abertura,
                data_encerramento: json.protocolo.data_encerramento,
                ultima_atualizacao: json.protocolo.ultima_atualizacao || new Date().toISOString()
            };
            // Só sobrescreve se houver diferença relevante (evita writes inúteis)
            if (JSON.stringify(metaLocal) !== JSON.stringify({ ...metaLocal, ...metaRemota })) {
                meta[uuid] = { ...metaLocal, ...metaRemota };
                saveProtocolosMeta(meta);
                algoMudou = true;
            }
        }

        // Sincroniza cada etapa retornada que ainda não está no cache local
        if (Array.isArray(json.etapas)) {
            json.etapas.forEach(etapa => {
                const chave = `protocolo:${uuid}:etapa-${etapa.numero_etapa}`;
                if (localStorage.getItem(chave) === null && etapa.dados) {
                    localStorage.setItem(chave, JSON.stringify(etapa.dados));
                    localStorage.setItem(`protocolo:${uuid}:etapa-${etapa.numero_etapa}-completa`, 'true');
                    algoMudou = true;
                }
            });
        }

        return algoMudou;
    } catch (err) {
        console.warn('Sincronização completa do protocolo falhou:', err.message);
        return false;
    }
}

// ============================================================
// TAGS INPUT
// ============================================================
class TagsInput {
    constructor(containerId, initialTags = []) {
        this.container = document.getElementById(containerId);
        this.tags = [...initialTags];
        this.render();
    }

    render() {
        this.container.innerHTML = '';
        this.container.classList.add('tags-input-container');

        this.tags.forEach((tag, idx) => {
            const chip = document.createElement('span');
            chip.className = 'tag-chip';
            chip.innerHTML = `${this.escapeHtml(tag)} <span class="remove-tag" data-idx="${idx}">×</span>`;
            this.container.appendChild(chip);
        });

        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = this.tags.length === 0 ? 'Digite e pressione Enter...' : 'Adicionar...';
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && input.value.trim()) {
                e.preventDefault();
                this.tags.push(input.value.trim());
                this.render();
            } else if (e.key === 'Backspace' && !input.value && this.tags.length > 0) {
                this.tags.pop();
                this.render();
            }
        });
        this.container.appendChild(input);

        this.container.querySelectorAll('.remove-tag').forEach(el => {
            el.addEventListener('click', (e) => {
                const idx = parseInt(e.target.dataset.idx);
                this.tags.splice(idx, 1);
                this.render();
            });
        });

        input.focus();
    }

    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    getTags() { return this.tags; }
    setTags(tags) { this.tags = [...tags]; this.render(); }
}

// ============================================================
// DYNAMIC TABLE
// ============================================================
class DynamicTable {
    constructor(containerId, columns, initialRows = []) {
        this.container = document.getElementById(containerId);
        this.columns = columns;
        this.rows = initialRows.length > 0 ? initialRows : [];
        this.render();
    }

    addRow() {
        const row = {};
        this.columns.forEach(col => row[col.id] = col.default || '');
        this.rows.push(row);
        this.render();
    }

    deleteRow(index) {
        this.rows.splice(index, 1);
        this.render();
    }

    updateCell(index, colId, value) {
        this.rows[index][colId] = value;
    }

    render() {
        if (this.rows.length === 0) {
            this.container.innerHTML = `<div class="empty-state">Nenhum registro adicionado ainda. Clique em "+ Adicionar" para começar.</div>`;
        } else {
            let html = '<div class="dynamic-table-wrapper"><table class="dynamic-table"><thead><tr>';
            this.columns.forEach(col => {
                html += `<th${col.width ? ` style="width:${col.width}"` : ''}>${col.label}</th>`;
            });
            html += '<th style="width:40px;">Ações</th></tr></thead><tbody>';

            this.rows.forEach((row, idx) => {
                html += '<tr>';
                this.columns.forEach(col => {
                    const value = (row[col.id] !== undefined ? row[col.id] : '');
                    if (col.type === 'textarea') {
                        html += `<td><textarea data-row="${idx}" data-col="${col.id}">${this.escapeHtml(value)}</textarea></td>`;
                    } else if (col.type === 'select') {
                        html += `<td><select data-row="${idx}" data-col="${col.id}">`;
                        html += `<option value="">Selecione...</option>`;
                        col.options.forEach(opt => {
                            const sel = (value === opt.value) ? 'selected' : '';
                            html += `<option value="${opt.value}" ${sel}>${opt.label}</option>`;
                        });
                        html += `</select></td>`;
                    } else {
                        html += `<td><input type="${col.type}" data-row="${idx}" data-col="${col.id}" value="${this.escapeHtml(value)}"></td>`;
                    }
                });
                html += `<td><button type="button" class="btn-icon delete" data-row="${idx}" title="Remover">🗑️</button></td></tr>`;
            });

            html += '</tbody></table></div>';
            this.container.innerHTML = html;

            this.container.querySelectorAll('input, textarea, select').forEach(el => {
                el.addEventListener('input', (e) => {
                    const r = parseInt(e.target.dataset.row);
                    const c = e.target.dataset.col;
                    this.updateCell(r, c, e.target.value);
                });
            });

            this.container.querySelectorAll('.btn-icon.delete').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const r = parseInt(e.target.dataset.row);
                    this.deleteRow(r);
                });
            });
        }
    }

    escapeHtml(str) {
        if (str === null || str === undefined) return '';
        const div = document.createElement('div');
        div.textContent = String(str);
        return div.innerHTML;
    }

    getData() { return this.rows; }
    setData(rows) { this.rows = rows; this.render(); }
}

// ============================================================
// FILE UPLOAD
// ============================================================
class FileUploadManager {
    constructor(zoneId, listId, initialFiles = []) {
        this.zone = document.getElementById(zoneId);
        this.list = document.getElementById(listId);
        this.files = [];
        this._carregarAnexosSalvos();
        this.bindEvents();
    }

    async _carregarAnexosSalvos() {
        const uuid = getProtocoloAtivo();
        if (!uuid) return;
        try {
            const res = await fetchAutenticado('/api/protocolos/' + uuid + '/anexos');
            if (!res.ok) return;
            const json = await res.json();
            if (json.sucesso && Array.isArray(json.anexos)) {
                this.files = json.anexos.map(a => ({
                    id: a.id,
                    nome: a.nome_arquivo,
                    name: a.nome_arquivo,
                    tamanho: a.tamanho_bytes,
                    size: a.tamanho_bytes,
                    type: a.tipo_mime,
                    url: a.url_download,
                    caminho: a.caminho_storage
                }));
                this.renderList();
            }
        } catch (err) {
            console.warn('Nao foi possivel carregar anexos:', err.message);
        }
    }

    bindEvents() {
        if (!this.zone) return;
        const input = this.zone.querySelector('input[type="file"]');
        this.zone.addEventListener('click', () => input && input.click());
        if (input) input.addEventListener('change', (e) => this.handleFiles(e.target.files));
        this.zone.addEventListener('dragover', (e) => { e.preventDefault(); this.zone.classList.add('dragover'); });
        this.zone.addEventListener('dragleave', () => this.zone.classList.remove('dragover'));
        this.zone.addEventListener('drop', (e) => {
            e.preventDefault();
            this.zone.classList.remove('dragover');
            this.handleFiles(e.dataTransfer.files);
        });
    }

    handleFiles(fileList) {
        const uuid = getProtocoloAtivo();
        if (!uuid) { showAlert('Nenhum protocolo ativo.', 'error'); return; }
        Array.from(fileList).forEach(file => this._uploadArquivo(uuid, file));
    }

    async _uploadArquivo(uuid, file) {
        const tempId = 'temp_' + Date.now();
        this.files.push({ id: tempId, nome: file.name, name: file.name, tamanho: file.size, size: file.size, type: file.type, carregando: true });
        this.renderList();

        try {
            const formData = new FormData();
            formData.append('arquivo', file);
            const token = localStorage.getItem('auth-token');
            const res = await fetch('/api/protocolos/' + uuid + '/anexos', {
                method: 'POST',
                headers: token ? { Authorization: 'Bearer ' + token } : {},
                body: formData
            });
            const json = await res.json();
            this.files = this.files.filter(f => f.id !== tempId);
            if (res.ok && json.sucesso) {
                this.files.push({
                    id: json.anexo.id,
                    nome: json.anexo.nome,
                    name: json.anexo.nome,
                    tamanho: json.anexo.tamanho,
                    size: json.anexo.tamanho,
                    type: file.type,
                    url: json.anexo.url,
                    caminho: json.anexo.caminho
                });
                showAlert('Arquivo ' + file.name + ' enviado com sucesso!', 'success');
            } else {
                showAlert('Erro ao enviar ' + file.name + ': ' + (json.erro || 'tente novamente'), 'error');
            }
        } catch (err) {
            this.files = this.files.filter(f => f.id !== tempId);
            showAlert('Falha no upload de ' + file.name + ': ' + err.message, 'error');
        }
        this.renderList();
    }

    async removerArquivo(id) {
        const uuid = getProtocoloAtivo();
        this.files = this.files.filter(f => f.id !== id);
        this.renderList();
        try {
            await fetchAutenticado('/api/protocolos/' + uuid + '/anexos/' + id, { method: 'DELETE' });
        } catch (err) {
            console.warn('Erro ao remover anexo:', err.message);
        }
    }

    formatSize(bytes) {
        if (!bytes) return '—';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    renderList() {
        if (!this.list) return;
        if (this.files.length === 0) { this.list.innerHTML = ''; return; }
        let html = '';
        this.files.forEach((file) => {
            const nome = file.nome || file.name || 'Arquivo';
            const tamanho = this.formatSize(file.tamanho || file.size);
            const icon = (file.type || '').includes('pdf') ? '📄' : (file.type || '').includes('image') ? '🖼️' : '📎';
            if (file.carregando) {
                html += '<div class="file-item"><span class="file-name">⏳ ' + nome + ' <span class="file-size">Enviando...</span></span></div>';
            } else {
                const linkAbrir = file.url ? '<a href="' + file.url + '" target="_blank" class="btn-icon" title="Abrir">🔗</a>' : '';
                html += '<div class="file-item"><span class="file-name">' + icon + ' ' + nome + ' <span class="file-size">' + tamanho + '</span></span><div style="display:flex;gap:4px;">' + linkAbrir + '<button type="button" class="btn-icon delete" data-id="' + file.id + '" title="Remover">🗑️</button></div></div>';
            }
        });
        this.list.innerHTML = html;
        this.list.querySelectorAll('.btn-icon.delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.dataset.id;
                if (confirm('Remover este anexo?')) this.removerArquivo(id);
            });
        });
    }

    getFiles() {
        return this.files.filter(f => !f.carregando)
            .map(f => ({ id: f.id, nome: f.nome || f.name, tamanho: f.tamanho || f.size, url: f.url }));
    }
}

// ============================================================
// PERSISTÊNCIA POR PROTOCOLO (localStorage + sincronização com API)
// ============================================================

// Salva localmente (instantâneo) e dispara o envio para a API em segundo
// plano (fire-and-forget). Se a API falhar, os dados continuam salvos no
// localStorage e o usuário não percebe nenhuma interrupção.
function saveStageData(stageNum, data) {
    const uuid = getProtocoloAtivo();
    if (!uuid) {
        showAlert('⚠️ Nenhum protocolo ativo. Volte ao painel e crie um novo protocolo.', 'error');
        return;
    }
    localStorage.setItem(`protocolo:${uuid}:etapa-${stageNum}`, JSON.stringify(data));
    markStageComplete(stageNum);

    // Após salvar etapa 1 ou 2, tenta gerar o número do protocolo.
    // Roda em segundo plano (fire-and-forget): na prática os dados já estão
    // no cache local nesse ponto (acabamos de salvar), então resolve na hora.
    if (stageNum === 1 || stageNum === 2) {
        tentarGerarNumeroProtocolo();
    }

    // Ao salvar a etapa 17 (relatório final com flag), encerra o protocolo
    if (stageNum === 17 && data.relatorio_gerado) {
        updateProtocoloMetaAtivo({ status: 'encerrado', data_encerramento: new Date().toISOString() });
    } else if (stageNum >= 2) {
        // Progrediu além da etapa 1 -> em_analise (se já tinha número)
        const metaAtual = getProtocoloMetaAtivo();
        if (metaAtual && metaAtual.numero && metaAtual.status === 'aberto') {
            updateProtocoloMetaAtivo({ status: 'em_analise' });
        }
    }

    // Envia para a API em segundo plano (não bloqueia a UI nem espera resposta)
    sincronizarEtapaComAPI(uuid, stageNum, data);
}

// Tenta enviar os dados da etapa para o backend. Silenciosamente ignora
// falhas (sem servidor, sem rede, etc) já que o localStorage já garantiu
// a persistência local — a sincronização é um "bônus" quando disponível.
async function sincronizarEtapaComAPI(uuid, stageNum, data) {
    try {
        await fetchAutenticado(`/api/protocolos/${uuid}/etapas/${stageNum}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    } catch (err) {
        // Sem servidor ou sem rede: dados continuam seguros no localStorage.
        console.warn(`Sincronização da Etapa ${stageNum} com a API falhou (dados mantidos localmente):`, err.message);
    }
}

// Carrega os dados de uma etapa. Busca primeiro no localStorage (rápido);
// se não encontrar nada localmente, busca na API como fallback (útil quando
// o protocolo foi preenchido em outro navegador/dispositivo, ou diretamente
// no banco) e populamos o cache local para acelerar os próximos acessos.
// IMPORTANTE: esta função agora é assíncrona — quem a chama precisa usar
// "await loadStageData(...)" dentro de uma função async.
async function loadStageData(stageNum) {
    const uuid = getProtocoloAtivo();
    if (!uuid) return null;

    const chave = `protocolo:${uuid}:etapa-${stageNum}`;
    const local = localStorage.getItem(chave);
    if (local !== null) {
        return JSON.parse(local);
    }

    // Nada no cache local: tenta buscar da API
    try {
        const response = await fetchAutenticado(`/api/protocolos/${uuid}/etapas/${stageNum}`);
        if (!response.ok) return null;
        const json = await response.json();
        const dadosRemotos = json?.etapa?.dados;
        if (dadosRemotos) {
            // Popula o cache local pra acelerar os próximos carregamentos
            localStorage.setItem(chave, JSON.stringify(dadosRemotos));
            localStorage.setItem(`protocolo:${uuid}:etapa-${stageNum}-completa`, 'true');
            return dadosRemotos;
        }
        return null;
    } catch (err) {
        console.warn(`Busca da Etapa ${stageNum} na API falhou:`, err.message);
        return null;
    }
}

// ============================================================
// HELPERS DE FORMULÁRIO
// ============================================================
function getFormValue(id) {
    const el = document.getElementById(id);
    if (!el) return '';
    if (el.type === 'checkbox') return el.checked;
    return el.value;
}

function setFormValue(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.type === 'checkbox') { el.checked = !!value; }
    else { el.value = value !== undefined && value !== null ? value : ''; }
}

function getRadioValue(name) {
    const checked = document.querySelector(`input[name="${name}"]:checked`);
    return checked ? checked.value : '';
}

function setRadioValue(name, value) {
    const el = document.querySelector(`input[name="${name}"][value="${value}"]`);
    if (el) el.checked = true;
}

// ============================================================
// RENDERIZAÇÃO DO CABEÇALHO DE PROTOCOLO (número + status) nas etapas
// ============================================================
function renderProtocoloHeader(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const meta = getProtocoloMetaAtivo();
    if (!meta) {
        container.innerHTML = `<div class="protocolo-tag">⚠️ Nenhum protocolo ativo</div>`;
        return;
    }
    const numero = meta.numero || 'Será gerado após Etapas 1 e 2';
    const statusLabels = { rascunho: 'Rascunho', aberto: 'Aberto', em_analise: 'Em Análise', encerrado: 'Encerrado' };
    container.innerHTML = `<div class="protocolo-tag"><strong>Protocolo:</strong> ${numero} <span class="protocolo-status-badge status-${meta.status}">${statusLabels[meta.status] || meta.status}</span></div>`;
}
