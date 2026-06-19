// ============================================================
// GERADOR DE PDF v2 — Relatório Visual Executivo
// Protocolo de Londres — BSL Saúde
// ============================================================
'use strict';

const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

// ── Paleta BSL ──────────────────────────────────────────────
const C = {
    teal:        '#1A6B7A',
    teal2:       '#2DACA4',
    tealLight:   '#E3F0F3',
    tealMid:     '#B8D8DD',
    red:         '#C0272D',
    redLight:    '#FBE9E9',
    yellow:      '#D4A020',
    yellowLight: '#FDF6E3',
    green:       '#00875A',
    greenLight:  '#E3F5EE',
    orange:      '#D4620A',
    orangeLight: '#FEF0E7',
    blue:        '#1A56A0',
    blueLight:   '#EBF2FB',
    purple:      '#6B3FA0',
    purpleLight: '#F3EEF9',
    gray900:     '#111827',
    gray700:     '#374151',
    gray500:     '#6B7280',
    gray300:     '#D1D5DB',
    gray100:     '#F3F4F6',
    gray50:      '#F9FAFB',
    white:       '#FFFFFF',
};

// ── Dimensões A4 ─────────────────────────────────────────────
const W  = 595.28;
const H  = 841.89;
const ML = 48;   // margem esquerda
const MR = 48;   // margem direita
const MT = 48;   // margem superior
const MB = 48;   // margem inferior
const CW = W - ML - MR; // largura do conteúdo

// ── Categorias de fatores contribuintes ──────────────────────
const CAT_COLORS = {
    ambiente:         { bg: C.blueLight,   fg: C.blue,   label: 'Ambiente' },
    tarefa_tecnologia:{ bg: C.purpleLight, fg: C.purple, label: 'Tarefa/Tecnologia' },
    individuo:        { bg: C.tealLight,   fg: C.teal,   label: 'Indivíduo' },
    equipe:           { bg: C.greenLight,  fg: C.green,  label: 'Equipe' },
    organizacao:      { bg: C.yellowLight, fg: C.yellow, label: 'Organização' },
    contexto:         { bg: C.orangeLight, fg: C.orange, label: 'Contexto' },
    paciente:         { bg: C.redLight,    fg: C.red,    label: 'Paciente' },
};

const DANO_CONFIG = {
    nenhum:   { bg: C.greenLight,  fg: C.green,  label: 'Sem Dano' },
    leve:     { bg: C.yellowLight, fg: C.yellow, label: 'Dano Leve' },
    moderado: { bg: C.orangeLight, fg: C.orange, label: 'Dano Moderado' },
    grave:    { bg: C.redLight,    fg: C.red,    label: 'Dano Grave' },
    morte:    { bg: '#1a0000',     fg: '#FF4444',label: 'Óbito' },
};

const TIPO_CONFIG = {
    queda:             { label: 'Queda' },
    medicamento:       { label: 'Erro de Medicação' },
    infeccao:          { label: 'Infecção Relacionada' },
    lesao_pressao:     { label: 'Lesão por Pressão' },
    procedimento:      { label: 'Erro de Procedimento' },
    comunicacao:       { label: 'Falha de Comunicação' },
    equipamento:       { label: 'Falha de Equipamento' },
    identificacao:     { label: 'Erro de Identificação' },
};

// ============================================================
// FUNÇÃO PRINCIPAL
// ============================================================
function gerarPDFRelatorio(protocolo, secoes) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({
                size: 'A4',
                margins: { top: MT, bottom: MB, left: ML, right: MR },
                bufferPages: true,
                info: {
                    Title: `Protocolo de Londres — ${protocolo.numero || 'Rascunho'}`,
                    Author: 'BSL Saúde — Sistema de Qualidade e Segurança do Paciente',
                    Subject: 'Relatório de Investigação de Evento Adverso',
                    Creator: 'Protocolo de Londres v2',
                }
            });

            const chunks = [];
            doc.on('data', c => chunks.push(c));
            doc.on('end',  () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);

            // Extrai dados estruturados das seções para uso nos módulos visuais
            const dados = extrairDadosEstrutados(secoes, protocolo);

            desenharCapa(doc, protocolo, dados);
            doc.addPage();
            desenharPaginas(doc, protocolo, dados, secoes);
            desenharRodapeGlobal(doc, protocolo);

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
}

// ============================================================
// EXTRATOR DE DADOS ESTRUTURADOS
// Mapeia as seções de texto para objetos usáveis nos módulos visuais
// ============================================================
function extrairDadosEstrutados(secoes, protocolo) {
    const dados = {
        identificacao: null,
        evento: null,
        cronologia: [],
        entrevistas: [],
        ppc: [],
        fatores: [],
        segundaVitima: null,
        disclosure: null,
        juridico: null,
        gut: null,
        esforco: null,
        ishikawa: null,
        acoes: [],
        monitoramento: [],
        diario: [],
        conclusao: null,
    };

    secoes.forEach(s => {
        const t = (s.titulo || '').toLowerCase();
        const c = Array.isArray(s.conteudo) ? s.conteudo : [];

        if (t.includes('identificação') || t.includes('residente')) {
            dados.identificacao = s;
        } else if (t.includes('evento') || t.includes('descrição')) {
            dados.evento = s;
        } else if (t.includes('cronologia')) {
            dados.cronologia = c;
        } else if (t.includes('entrevista') || t.includes('relato')) {
            dados.entrevistas = c;
        } else if (t.includes('ppc') || t.includes('prestação do cuidado')) {
            dados.ppc = c;
        } else if (t.includes('fator') || t.includes('contribuint')) {
            dados.fatores = c;
        } else if (t.includes('segunda') || t.includes('vítima')) {
            dados.segundaVitima = s;
        } else if (t.includes('disclosure') || t.includes('comunicação')) {
            dados.disclosure = s;
        } else if (t.includes('jurídic')) {
            dados.juridico = s;
        } else if (t.includes('gut')) {
            dados.gut = s;
        } else if (t.includes('esforço') || t.includes('impacto')) {
            dados.esforco = s;
        } else if (t.includes('ishikawa') || t.includes('causa')) {
            dados.ishikawa = s;
        } else if (t.includes('5w2h') || t.includes('plano de ação') || t.includes('ação corretiva')) {
            dados.acoes = c;
        } else if (t.includes('monitoramento')) {
            dados.monitoramento = c;
        } else if (t.includes('diário') || t.includes('bordo') || t.includes('reunião')) {
            dados.diario = c;
        } else if (t.includes('conclusão') || t.includes('recomendação')) {
            dados.conclusao = s;
        }
    });

    return dados;
}

// ============================================================
// CAPA
// ============================================================
function desenharCapa(doc, protocolo, dados) {
    // Faixa BSL tricolor no topo
    const faixaH = 6;
    const terco = W / 3;
    doc.rect(0, 0, terco, faixaH).fill(C.yellow);
    doc.rect(terco, 0, terco, faixaH).fill(C.red);
    doc.rect(terco * 2, 0, terco, faixaH).fill(C.teal);

    // Faixa teal principal
    doc.rect(0, faixaH, W, 180).fill(C.teal);

    // Logo BSL (imagem real se disponível, senão wordmark textual)
    const logoPath = path.join(__dirname, 'logo.png');
    const logoB64Path = path.join(__dirname, 'logo_b64.txt');

    let logoDesenhado = false;

    if (fs.existsSync(logoPath)) {
        try {
            const logoH = 52;
            const logoW = logoH * (1369 / 889); // aspect ratio real do logo
            const logoX = (W - logoW) / 2;
            // Box branco atrás do logo
            doc.roundedRect(logoX - 12, faixaH + 22, logoW + 24, logoH + 16, 8)
               .fill(C.white);
            doc.image(logoPath, logoX, faixaH + 30, { height: logoH });
            logoDesenhado = true;
        } catch(e) { /* fallback abaixo */ }
    }

    if (!logoDesenhado) {
        // Wordmark textual como fallback
        const boxW = 160; const boxH = 64;
        const boxX = (W - boxW) / 2;
        doc.roundedRect(boxX, faixaH + 20, boxW, boxH, 10).fill(C.white);
        doc.fillColor(C.teal).fontSize(28).font('Helvetica-Bold')
           .text('BSL', boxX, faixaH + 30, { width: boxW, align: 'center' });
        doc.fillColor(C.gray500).fontSize(8).font('Helvetica')
           .text('BRASIL SENIOR LIVING', boxX, faixaH + 62, { width: boxW, align: 'center', characterSpacing: 1.5 });
    }

    // Título na faixa teal
    let titleY = faixaH + 110;
    doc.fillColor(C.white).fontSize(9).font('Helvetica')
       .text('RELATÓRIO DE INVESTIGAÇÃO DE EVENTO ADVERSO', 0, titleY,
             { align: 'center', width: W, characterSpacing: 1.2 });

    titleY += 18;
    doc.fillColor(C.white).fontSize(22).font('Helvetica-Bold')
       .text('Protocolo de Londres', 0, titleY, { align: 'center', width: W });

    // ── Caixa do número do protocolo ──
    const numBoxW = 380; const numBoxH = 88;
    const numBoxX = (W - numBoxW) / 2;
    const numBoxY = faixaH + 188 + 12;

    doc.roundedRect(numBoxX, numBoxY, numBoxW, numBoxH, 10)
       .fillAndStroke(C.tealLight, C.tealMid);

    doc.fillColor(C.gray500).fontSize(8).font('Helvetica-Bold')
       .text('NÚMERO DO PROTOCOLO', numBoxX, numBoxY + 14,
             { width: numBoxW, align: 'center', characterSpacing: 1 });

    doc.fillColor(C.teal).fontSize(24).font('Helvetica-Bold')
       .text(protocolo.numero || '— RASCUNHO —', numBoxX, numBoxY + 28,
             { width: numBoxW, align: 'center' });

    // Badge de status
    const stMap = {
        rascunho: { l: 'RASCUNHO', bg: C.gray100, fg: C.gray500 },
        aberto:   { l: 'ABERTO',   bg: C.blueLight, fg: C.blue },
        em_analise: { l: 'EM ANÁLISE', bg: C.yellowLight, fg: C.yellow },
        encerrado:  { l: 'ENCERRADO', bg: C.greenLight, fg: C.green },
    };
    const st = stMap[protocolo.status] || stMap.rascunho;
    const stW = 90; const stH = 18;
    const stX = (W - stW) / 2;
    doc.roundedRect(stX, numBoxY + 62, stW, stH, 4).fill(st.bg);
    doc.fillColor(st.fg).fontSize(8).font('Helvetica-Bold')
       .text(st.l, stX, numBoxY + 66, { width: stW, align: 'center', characterSpacing: 0.8 });

    // ── Grid 2x2 de metadados ──
    const gridY = numBoxY + numBoxH + 24;
    const gridW = (CW - 16) / 2;
    const gridH = 64;
    const cells = [
        { label: 'RESIDENTE', value: protocolo.nome_residente || 'Não informado' },
        { label: 'DATA DO EVENTO', value: formatarData(protocolo.data_ocorrencia) },
        { label: 'DATA DE ABERTURA', value: formatarData(protocolo.data_abertura) },
        { label: 'ENCERRAMENTO', value: protocolo.data_encerramento ? formatarData(protocolo.data_encerramento) : 'Em andamento' },
    ];

    cells.forEach((cell, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const cx = ML + col * (gridW + 16);
        const cy = gridY + row * (gridH + 12);
        doc.roundedRect(cx, cy, gridW, gridH, 8).fill(C.gray50);
        doc.moveTo(cx, cy + 24).lineTo(cx + gridW, cy + 24)
           .lineWidth(1).strokeColor(C.gray300).stroke();
        doc.fillColor(C.gray500).fontSize(7.5).font('Helvetica-Bold')
           .text(cell.label, cx + 12, cy + 8, { width: gridW - 24, characterSpacing: 0.8 });
        doc.fillColor(C.gray900).fontSize(11).font('Helvetica-Bold')
           .text(cell.value, cx + 12, cy + 32, { width: gridW - 24 });
    });

    // ── Rodapé da capa ──
    const origMB = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;

    doc.moveTo(ML, H - 52).lineTo(W - MR, H - 52)
       .lineWidth(0.5).strokeColor(C.gray300).stroke();

    doc.fillColor(C.gray500).fontSize(8).font('Helvetica')
       .text('Documento confidencial — uso interno restrito à equipe de qualidade e segurança do paciente.',
             ML, H - 42, { width: CW, align: 'center' });

    doc.fillColor(C.gray300).fontSize(7.5)
       .text(`Gerado em: ${formatarDataHora(new Date().toISOString())}`,
             ML, H - 28, { width: CW, align: 'center' });

    doc.page.margins.bottom = origMB;
}

// ============================================================
// CABEÇALHO DAS PÁGINAS INTERNAS
// ============================================================
function desenharCabecalhoInterno(doc, protocolo) {
    // Faixa teal fina
    doc.rect(0, 0, W, 3).fill(C.teal);
    doc.rect(0, 3, W, 1.5).fill(C.tealMid);

    const hY = 12;
    doc.fillColor(C.teal).fontSize(9).font('Helvetica-Bold')
       .text('PROTOCOLO DE LONDRES', ML, hY, { continued: true })
       .fillColor(C.gray500).font('Helvetica')
       .text(`  |  ${protocolo.numero || 'Rascunho'}`, { continued: true })
       .text(`  |  ${protocolo.nome_residente || ''}`, { continued: true });

    // Badge de status pequeno no lado direito
    const stSmall = protocolo.status === 'encerrado' ? { l: 'ENCERRADO', bg: C.greenLight, fg: C.green }
                  : protocolo.status === 'em_analise' ? { l: 'EM ANÁLISE', bg: C.yellowLight, fg: C.yellow }
                  : { l: 'EM ABERTO', bg: C.blueLight, fg: C.blue };

    const badgeW = 72;
    doc.roundedRect(W - MR - badgeW, hY - 2, badgeW, 14, 3).fill(stSmall.bg);
    doc.fillColor(stSmall.fg).fontSize(7).font('Helvetica-Bold')
       .text(stSmall.l, W - MR - badgeW, hY + 1, { width: badgeW, align: 'center', characterSpacing: 0.5 });

    doc.text('', ML, 32); // reposiciona doc.y
}

// ============================================================
// MÓDULOS VISUAIS
// ============================================================

// ── Título de seção ──────────────────────────────────────────
function secaoTitulo(doc, numero, titulo, cor) {
    garantirEspaco(doc, 48);
    const y = doc.y;
    const bgCor = cor || C.teal;

    // Número da seção em caixinha
    doc.roundedRect(ML, y, 22, 22, 4).fill(bgCor);
    doc.fillColor(C.white).fontSize(10).font('Helvetica-Bold')
       .text(String(numero), ML, y + 5, { width: 22, align: 'center' });

    // Título
    doc.fillColor(C.gray900).fontSize(12).font('Helvetica-Bold')
       .text(titulo.toUpperCase(), ML + 28, y + 5, { width: CW - 28 });

    // Linha separadora
    doc.moveTo(ML, y + 28).lineTo(ML + CW, y + 28)
       .lineWidth(1).strokeColor(bgCor).stroke();

    doc.text('', ML, y + 36);
}

// ── Badge inline ─────────────────────────────────────────────
function desenharBadge(doc, x, y, texto, bg, fg, maxW) {
    const w = Math.min(doc.widthOfString(texto) + 16, maxW || 200);
    const h = 16;
    doc.roundedRect(x, y, w, h, 3).fill(bg);
    doc.fillColor(fg).fontSize(7.5).font('Helvetica-Bold')
       .text(texto, x, y + 3, { width: w, align: 'center', characterSpacing: 0.3 });
    return w;
}

// ── Caixa de destaque ────────────────────────────────────────
function caixaDestaque(doc, texto, bg, fg, icone) {
    garantirEspaco(doc, 50);
    const y = doc.y;
    const h = Math.max(40, doc.heightOfString(texto, { width: CW - 48 }) + 24);
    doc.roundedRect(ML, y, CW, h, 8).fill(bg);
    if (icone) {
        doc.fillColor(fg).fontSize(14).text(icone, ML + 14, y + h/2 - 8, { lineBreak: false });
    }
    const txtX = icone ? ML + 36 : ML + 16;
    doc.fillColor(fg).fontSize(10).font('Helvetica')
       .text(texto, txtX, y + 12, { width: CW - (icone ? 52 : 32) });
    doc.text('', ML, y + h + 10);
}

// ── Linha de KV ──────────────────────────────────────────────
function linhaKV(doc, chave, valor, opcoes) {
    garantirEspaco(doc, 20);
    const y = doc.y;
    const labelW = opcoes?.labelW || 160;
    doc.fillColor(C.gray500).fontSize(8.5).font('Helvetica-Bold')
       .text(chave, ML, y, { width: labelW });
    doc.fillColor(C.gray900).fontSize(9).font('Helvetica')
       .text(String(valor || 'Não informado'), ML + labelW, y, { width: CW - labelW });
    doc.text('', ML, Math.max(doc.y, y + 16));
}

// ── Cronologia visual ────────────────────────────────────────
function desenharCronologia(doc, itens) {
    if (!itens || itens.length === 0) {
        caixaDestaque(doc, 'Nenhum evento de cronologia registrado.', C.gray100, C.gray500, '○');
        return;
    }

    itens.forEach((item, i) => {
        garantirEspaco(doc, 52);
        const y = doc.y;

        // Linha vertical conectora (exceto no último item)
        if (i < itens.length - 1) {
            doc.moveTo(ML + 10, y + 22).lineTo(ML + 10, y + 62)
               .lineWidth(2).strokeColor(C.tealMid).stroke();
        }

        // Círculo marcador
        doc.circle(ML + 10, y + 10, 9).fillAndStroke(C.teal, C.teal);
        doc.fillColor(C.white).fontSize(7).font('Helvetica-Bold')
           .text(String(i + 1), ML + 1, y + 6, { width: 18, align: 'center' });

        // Conteúdo
        const txtX = ML + 28;
        const txtW = CW - 28;

        // Extrai data/hora e texto do item (formato: "DD/MM/AAAA, por volta das HH:MM — Descrição")
        const match = String(item).match(/^(.{8,25}?(?:\d{2}:\d{2})[^—–-]*)[-—–]\s*(.+)$/s);
        const dataTxt = match ? match[1].trim() : '';
        const descTxt = match ? match[2].trim() : String(item);

        if (dataTxt) {
            doc.fillColor(C.teal).fontSize(8).font('Helvetica-Bold')
               .text(dataTxt, txtX, y + 2, { width: txtW });
        }

        const descY = dataTxt ? y + 14 : y + 2;
        doc.fillColor(C.gray700).fontSize(9.5).font('Helvetica')
           .text(descTxt, txtX, descY, { width: txtW, lineGap: 2 });

        doc.text('', ML, Math.max(doc.y, descY + 18) + 8);
    });
}

// ── Entrevistas em cards ─────────────────────────────────────
function desenharEntrevistas(doc, itens) {
    if (!itens || itens.length === 0) {
        caixaDestaque(doc, 'Nenhuma entrevista registrada.', C.gray100, C.gray500, '○');
        return;
    }

    itens.forEach((item, i) => {
        const txt = String(item);

        // Tenta extrair "Depoimento N — Nome (Cargo), data:"
        const headerMatch = txt.match(/^(Depoimento\s+\d+[^:—–-]*?)(?:[:—–-])([\s\S]+?)(?=Observações:|$)/i);
        const obsMatch = txt.match(/Observações:\s*(.*?)$/is);

        const header = headerMatch ? headerMatch[1].trim() : `Depoimento ${i + 1}`;
        const relato = headerMatch ? headerMatch[2].trim() : txt;
        const obs = obsMatch ? obsMatch[1].trim() : '';

        const relatoH = doc.heightOfString(`"${relato}"`, { width: CW - 48 }) + (obs ? 40 : 20) + 40;
        garantirEspaco(doc, relatoH + 20);

        const y = doc.y;

        // Card com borda lateral esquerda
        doc.roundedRect(ML, y, CW, relatoH, 6).fill(C.gray50);
        doc.rect(ML, y, 4, relatoH).fill(C.teal);

        // Header do card
        doc.fillColor(C.teal).fontSize(9).font('Helvetica-Bold')
           .text(header, ML + 14, y + 10, { width: CW - 28 });

        // Texto do relato em itálico
        doc.fillColor(C.gray700).fontSize(9.5).font('Helvetica-Oblique')
           .text(`"${relato}"`, ML + 14, y + 28, { width: CW - 28, lineGap: 2 });

        // Observações
        if (obs) {
            const obsY = y + 32 + doc.heightOfString(`"${relato}"`, { width: CW - 28 });
            doc.fillColor(C.gray500).fontSize(8).font('Helvetica-Bold')
               .text('OBS: ', ML + 14, obsY + 6, { continued: true })
               .font('Helvetica').fillColor(C.gray500)
               .text(obs, { width: CW - 36 });
        }

        doc.text('', ML, y + relatoH + 12);
    });
}

// ── GUT: gráfico de barras horizontal ────────────────────────
function desenharGUT(doc, secao) {
    if (!secao || secao.vazio) {
        caixaDestaque(doc, 'Matriz GUT não preenchida.', C.gray100, C.gray500, '○');
        return;
    }

    const txt = secao.conteudo || [];
    const allTxt = Array.isArray(txt) ? txt.join(' ') : String(txt);

    // Extrai valores
    const gMatch = allTxt.match(/[Gg]ravidade[\s:]+(\d)/);
    const uMatch = allTxt.match(/[Uu]rg[êe]ncia[\s:]+(\d)/);
    const tMatch = allTxt.match(/[Tt]end[êe]ncia[\s:]+(\d)/);
    const rMatch = allTxt.match(/resultado[^:]*:?\s*(\d+)/i);
    const cMatch = allTxt.match(/classifica[çc][ãa]o[^:]*:?\s*(\w+)/i);

    const G = gMatch ? parseInt(gMatch[1]) : 0;
    const U = uMatch ? parseInt(uMatch[1]) : 0;
    const T = tMatch ? parseInt(tMatch[1]) : 0;
    const R = rMatch ? parseInt(rMatch[1]) : G * U * T;
    const classif = cMatch ? cMatch[1].toLowerCase() : (R >= 64 ? 'crítica' : R >= 27 ? 'alta' : R >= 8 ? 'moderada' : 'baixa');

    const classifCfg = {
        crítica: { bg: C.redLight, fg: C.red, label: 'CRÍTICA' },
        critica: { bg: C.redLight, fg: C.red, label: 'CRÍTICA' },
        alta:    { bg: C.orangeLight, fg: C.orange, label: 'ALTA' },
        moderada:{ bg: C.yellowLight, fg: C.yellow, label: 'MODERADA' },
        baixa:   { bg: C.greenLight, fg: C.green, label: 'BAIXA' },
    };
    const cfg = classifCfg[classif] || classifCfg.moderada;

    garantirEspaco(doc, 160);
    const y = doc.y;

    // Box do resultado (lado direito)
    const resultW = 130;
    doc.roundedRect(ML + CW - resultW, y, resultW, 110, 8).fill(cfg.bg);
    doc.fillColor(cfg.fg).fontSize(9).font('Helvetica-Bold')
       .text('RESULTADO GUT', ML + CW - resultW, y + 12, { width: resultW, align: 'center', characterSpacing: 0.5 });
    doc.fillColor(cfg.fg).fontSize(38).font('Helvetica-Bold')
       .text(String(R), ML + CW - resultW, y + 28, { width: resultW, align: 'center' });
    doc.fillColor(cfg.fg).fontSize(11).font('Helvetica-Bold')
       .text(cfg.label, ML + CW - resultW, y + 78, { width: resultW, align: 'center', characterSpacing: 0.8 });

    // Barras horizontais
    const barZone = CW - resultW - 20;
    const barMaxW = barZone - 90;
    const barH = 22;
    const barGap = 14;
    const labels = ['Gravidade', 'Urgência', 'Tendência'];
    const vals = [G, U, T];
    const barCors = [C.teal, C.blue, C.purple];

    labels.forEach((lbl, i) => {
        const barY = y + i * (barH + barGap);
        const v = vals[i];
        const fillW = v > 0 ? (v / 5) * barMaxW : 4;

        doc.fillColor(C.gray700).fontSize(9).font('Helvetica-Bold')
           .text(lbl, ML, barY + 5, { width: 80 });

        // Fundo da barra
        doc.roundedRect(ML + 86, barY, barMaxW, barH, 4).fill(C.gray100);
        // Preenchimento
        if (fillW > 0) {
            doc.roundedRect(ML + 86, barY, fillW, barH, 4).fill(barCors[i]);
        }
        // Valor
        doc.fillColor(C.white).fontSize(9).font('Helvetica-Bold')
           .text(String(v), ML + 86 + fillW - 18, barY + 5, { width: 14, align: 'center' });
    });

    // Escala 1-5
    doc.fillColor(C.gray300).fontSize(7).font('Helvetica');
    for (let n = 1; n <= 5; n++) {
        const px = ML + 86 + ((n - 1) / 4) * barMaxW;
        doc.text(String(n), px - 4, y + 3 * (barH + barGap) + 4, { width: 8, align: 'center' });
    }

    doc.text('', ML, y + 120);
}

// ── 5W2H em tabela ───────────────────────────────────────────
function desenharAcoes(doc, itens) {
    if (!itens || itens.length === 0) {
        caixaDestaque(doc, 'Nenhuma ação corretiva registrada.', C.gray100, C.gray500, '○');
        return;
    }

    itens.forEach((item, i) => {
        const txt = String(item);
        garantirEspaco(doc, 120);
        const y = doc.y;

        // Header da ação
        const numW = 22;
        doc.roundedRect(ML, y, numW, 20, 3).fill(C.teal);
        doc.fillColor(C.white).fontSize(9).font('Helvetica-Bold')
           .text(String(i + 1), ML, y + 4, { width: numW, align: 'center' });

        // Tenta extrair o título da ação (primeira linha ou "Ação N:")
        const tituloMatch = txt.match(/^[^:]+:\s*(.+?)(?:\n|Justificativa:|Por quê)/i);
        const titulo = tituloMatch ? tituloMatch[1].trim() : `Ação ${i + 1}`;

        doc.fillColor(C.gray900).fontSize(10).font('Helvetica-Bold')
           .text(titulo, ML + numW + 8, y + 4, { width: CW - numW - 8 });

        doc.text('', ML, y + 28);

        // Campos da ação em grid 2 colunas
        const campos = ['Justificativa', 'Responsável', 'Prazo', 'Metodologia', 'Status'];
        const patterns = [
            /[Jj]ustificativa[:\s]+(.+?)(?=\n[A-Z]|Responsável|Prazo|$)/s,
            /[Rr]esponsável[:\s]+(.+?)(?=\n[A-Z]|Prazo|$)/s,
            /[Pp]razo[:\s]+(.+?)(?=\n[A-Z]|Metodologia|$)/s,
            /[Mm]etodologia[:\s]+(.+?)(?=\n[A-Z]|Status|$)/s,
            /[Ss]tatus[:\s]+(\w+)/s,
        ];

        const colW = (CW - 8) / 2;
        let col = 0; let rowY = doc.y;

        patterns.forEach((pattern, pi) => {
            const match = txt.match(pattern);
            const val = match ? match[1].trim() : '—';
            const label = campos[pi];

            if (col === 2) { col = 0; rowY = doc.y; }

            const cx = ML + col * (colW + 8);
            garantirEspaco(doc, 36);
            const cellY = col === 0 ? doc.y : rowY;

            doc.roundedRect(cx, cellY, colW, 32, 4).fill(C.gray50);
            doc.fillColor(C.gray500).fontSize(7).font('Helvetica-Bold')
               .text(label.toUpperCase(), cx + 8, cellY + 6, { width: colW - 16, characterSpacing: 0.5 });

            // Badge colorido para status
            if (label === 'Status') {
                const stCfg = val.toLowerCase().includes('aberta') ? { bg: C.yellowLight, fg: C.yellow }
                            : val.toLowerCase().includes('progress') ? { bg: C.blueLight, fg: C.blue }
                            : { bg: C.greenLight, fg: C.green };
                doc.roundedRect(cx + 8, cellY + 16, 70, 12, 3).fill(stCfg.bg);
                doc.fillColor(stCfg.fg).fontSize(7.5).font('Helvetica-Bold')
                   .text(val.toUpperCase(), cx + 8, cellY + 19, { width: 70, align: 'center' });
            } else {
                doc.fillColor(C.gray900).fontSize(8.5).font('Helvetica')
                   .text(val.length > 50 ? val.substring(0, 50) + '…' : val, cx + 8, cellY + 17, { width: colW - 16 });
            }

            if (col === 0) {
                col = 1;
                doc.text('', ML, cellY + 38);
            } else {
                col = 0;
                doc.text('', ML, cellY + 38);
            }
        });

        doc.text('', ML, doc.y + 10);
    });
}

// ── Fatores contribuintes com badges ─────────────────────────
function desenharFatores(doc, itens) {
    if (!itens || itens.length === 0) {
        caixaDestaque(doc, 'Nenhum fator contribuinte identificado.', C.gray100, C.gray500, '○');
        return;
    }

    itens.forEach((item, i) => {
        garantirEspaco(doc, 44);
        const y = doc.y;
        const txt = String(item);

        // Tenta detectar categoria entre colchetes [Ambiente] ou no início
        const catMatch = txt.match(/^\[([^\]]+)\]/) || txt.match(/^\(([^)]+)\)/);
        const catKey = catMatch ? catMatch[1].toLowerCase().replace(/\//g, '_').replace(' ', '_') : 'ambiente';
        const catCfg = CAT_COLORS[catKey] || CAT_COLORS.ambiente;
        const catLabel = catCfg.label;

        const descricao = txt.replace(/^\[[^\]]+\]\s*/, '').replace(/^\([^)]+\)\s*/, '');

        // Badge de categoria
        const badgeW = 140;
        doc.roundedRect(ML, y, badgeW, 16, 4).fill(catCfg.bg);
        doc.fillColor(catCfg.fg).fontSize(7.5).font('Helvetica-Bold')
           .text(catLabel.toUpperCase(), ML, y + 3, { width: badgeW, align: 'center', characterSpacing: 0.3 });

        // Número
        doc.fillColor(C.gray300).fontSize(8).font('Helvetica-Bold')
           .text(`#${i + 1}`, ML + badgeW + 8, y + 3);

        // Descrição
        doc.fillColor(C.gray700).fontSize(9.5).font('Helvetica')
           .text(descricao, ML, y + 22, { width: CW, lineGap: 2 });

        doc.text('', ML, Math.max(doc.y, y + 22 + 14) + 8);
    });
}

// ── Lista padrão com bullet teal ─────────────────────────────
function desenharLista(doc, itens) {
    if (!itens || itens.length === 0) return;
    itens.forEach(item => {
        garantirEspaco(doc, 24);
        const y = doc.y;
        doc.circle(ML + 5, y + 6, 3).fill(C.teal);
        doc.fillColor(C.gray700).fontSize(9.5).font('Helvetica')
           .text(String(item), ML + 14, y, { width: CW - 14, lineGap: 2 });
        doc.text('', ML, Math.max(doc.y, y + 14) + 3);
    });
}

// ── Texto parágrafo ──────────────────────────────────────────
function desenharParagrafo(doc, paragrafos) {
    if (!paragrafos) return;
    const lista = Array.isArray(paragrafos) ? paragrafos : [paragrafos];
    lista.forEach(p => {
        garantirEspaco(doc, 28);
        doc.fillColor(C.gray700).fontSize(9.5).font('Helvetica')
           .text(String(p), ML, doc.y, { width: CW, align: 'justify', lineGap: 3 });
        doc.moveDown(0.5);
    });
}

// ============================================================
// ORQUESTRADOR DE PÁGINAS
// ============================================================
function desenharPaginas(doc, protocolo, dados, secoes) {
    desenharCabecalhoInterno(doc, protocolo);

    let numSec = 1;

    // 1. Identificação do residente
    if (dados.identificacao) {
        secaoTitulo(doc, numSec++, 'Identificação do Residente', C.teal);
        if (dados.identificacao.tipo === 'chave_valor') {
            dados.identificacao.conteudo.forEach(([k, v]) => linhaKV(doc, k, v));
        } else {
            desenharParagrafo(doc, dados.identificacao.conteudo);
        }
        doc.moveDown(0.8);
    }

    // 2. Descrição do evento
    if (dados.evento) {
        secaoTitulo(doc, numSec++, 'Descrição do Evento', C.teal);
        if (dados.evento.tipo === 'chave_valor') {
            dados.evento.conteudo.forEach(([k, v]) => linhaKV(doc, k, v));
        } else {
            desenharParagrafo(doc, dados.evento.conteudo);
        }
        doc.moveDown(0.8);
    }

    // 3. Cronologia
    if (dados.cronologia.length > 0) {
        secaoTitulo(doc, numSec++, 'Cronologia dos Fatos', C.teal);
        desenharCronologia(doc, dados.cronologia);
        doc.moveDown(0.8);
    }

    // 4. Entrevistas
    if (dados.entrevistas.length > 0) {
        secaoTitulo(doc, numSec++, 'Relatos e Entrevistas', C.blue);
        desenharEntrevistas(doc, dados.entrevistas);
        doc.moveDown(0.8);
    }

    // 5. PPC
    if (dados.ppc.length > 0) {
        secaoTitulo(doc, numSec++, 'Problemas na Prestação do Cuidado (PPC)', C.red);
        desenharLista(doc, dados.ppc);
        doc.moveDown(0.8);
    }

    // 6. Fatores contribuintes
    if (dados.fatores.length > 0) {
        secaoTitulo(doc, numSec++, 'Fatores Contribuintes', C.purple);
        desenharFatores(doc, dados.fatores);
        doc.moveDown(0.8);
    }

    // 7. Segunda vítima, Disclosure, Jurídico (compactos numa seção)
    const temSuporteComuni = dados.segundaVitima || dados.disclosure || dados.juridico;
    if (temSuporteComuni) {
        secaoTitulo(doc, numSec++, 'Suporte aos Profissionais e Comunicação com a Família', C.teal);
        if (dados.segundaVitima) {
            if (dados.segundaVitima.tipo === 'lista') desenharLista(doc, dados.segundaVitima.conteudo);
            else desenharParagrafo(doc, dados.segundaVitima.conteudo);
        }
        if (dados.disclosure) {
            if (dados.disclosure.tipo === 'lista') desenharLista(doc, dados.disclosure.conteudo);
            else desenharParagrafo(doc, dados.disclosure.conteudo);
        }
        if (dados.juridico) {
            if (dados.juridico.tipo === 'lista') desenharLista(doc, dados.juridico.conteudo);
            else desenharParagrafo(doc, dados.juridico.conteudo);
        }
        doc.moveDown(0.8);
    }

    // 8. Priorização (GUT + Ishikawa + Esforço/Impacto)
    secaoTitulo(doc, numSec++, 'Priorização e Análise de Causa', C.orange);
    desenharGUT(doc, dados.gut);
    if (dados.esforco) {
        if (dados.esforco.tipo === 'chave_valor') {
            dados.esforco.conteudo.forEach(([k, v]) => linhaKV(doc, k, v));
        } else {
            desenharParagrafo(doc, dados.esforco.conteudo);
        }
    }
    if (dados.ishikawa) {
        if (dados.ishikawa.tipo === 'lista') desenharLista(doc, dados.ishikawa.conteudo);
        else if (dados.ishikawa.tipo === 'chave_valor') {
            dados.ishikawa.conteudo.forEach(([k, v]) => linhaKV(doc, k, v));
        } else {
            desenharParagrafo(doc, dados.ishikawa.conteudo);
        }
    }
    doc.moveDown(0.8);

    // 9. Plano de ação 5W2H
    if (dados.acoes.length > 0) {
        secaoTitulo(doc, numSec++, 'Plano de Ação Corretiva (5W2H)', C.blue);
        desenharAcoes(doc, dados.acoes);
        doc.moveDown(0.8);
    }

    // 10. Monitoramento
    if (dados.monitoramento.length > 0) {
        secaoTitulo(doc, numSec++, 'Monitoramento das Ações', C.teal);
        desenharLista(doc, dados.monitoramento);
        doc.moveDown(0.8);
    }

    // 11. Diário de bordo
    if (dados.diario.length > 0) {
        secaoTitulo(doc, numSec++, 'Registro de Reuniões e Decisões (Diário de Bordo)', C.gray700);
        desenharLista(doc, dados.diario);
        doc.moveDown(0.8);
    }

    // 12. Conclusão
    secaoTitulo(doc, numSec++, 'Conclusão e Recomendações Finais', C.teal);
    if (dados.conclusao && !dados.conclusao.vazio) {
        desenharParagrafo(doc, dados.conclusao.conteudo);
    } else {
        caixaDestaque(doc,
            '[Escreva aqui a síntese final da investigação: causas raiz confirmadas, responsabilidades apuradas, eficácia esperada das ações corretivas e recomendações para prevenção de recorrência.]',
            C.gray50, C.gray500);
    }
}

// ============================================================
// RODAPÉ GLOBAL (todas as páginas exceto capa)
// ============================================================
function desenharRodapeGlobal(doc, protocolo) {
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
        if (i === range.start) continue; // pula capa

        doc.switchToPage(i);
        const origMB = doc.page.margins.bottom;
        doc.page.margins.bottom = 0;

        const ry = H - 36;
        doc.moveTo(ML, ry).lineTo(W - MR, ry).lineWidth(0.5).strokeColor(C.gray300).stroke();

        doc.fillColor(C.gray500).fontSize(7.5).font('Helvetica')
           .text(`Protocolo de Londres  |  ${protocolo.numero || ''}  |  ${protocolo.nome_residente || ''}`,
                 ML, ry + 8, { width: CW - 80, lineBreak: false });

        doc.fillColor(C.gray500).fontSize(7.5).font('Helvetica')
           .text(`Página ${i - range.start} de ${range.count - 1}`,
                 W - MR - 80, ry + 8, { width: 80, align: 'right', lineBreak: false });

        doc.page.margins.bottom = origMB;
    }
}

// ============================================================
// HELPERS
// ============================================================
function garantirEspaco(doc, altura) {
    if (doc.y + altura > H - MB - 40) {
        doc.addPage();
        // Redesenha mini-cabeçalho na nova página
        doc.rect(0, 0, W, 3).fill(C.teal);
        doc.text('', ML, 18);
    }
}

function formatarData(dataISO) {
    if (!dataISO) return 'Não informado';
    const s = String(dataISO).split('T')[0];
    const [ano, mes, dia] = s.split('-');
    return `${dia}/${mes}/${ano}`;
}

function formatarDataHora(dataISO) {
    if (!dataISO) return 'Não informado';
    try {
        const d = new Date(dataISO);
        return d.toLocaleString('pt-BR', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    } catch { return String(dataISO); }
}

module.exports = { gerarPDFRelatorio };
