// ============================================================
// PARSER: texto narrativo livre (da Etapa 17) -> seções estruturadas para o PDF
// ============================================================
function parsearTextoRelatorioParaSecoes(texto) {
    if (!texto || typeof texto !== 'string') return [];

    const primeiraSecaoMatch = texto.match(/^\d+\.\s+.+$/m);
    let corpoTexto = texto;
    if (primeiraSecaoMatch) {
        corpoTexto = texto.slice(texto.indexOf(primeiraSecaoMatch[0]));
    }

    corpoTexto = corpoTexto.replace(/=+\n*/g, '');

    const linhas = corpoTexto.split('\n');
    const secoes = [];
    let secaoAtual = null;
    let proximoNumeroEsperado = 1;

    const regexTituloNumerado = /^(\d+)\.\s+(.+)$/;
    const regexTituloCaixaAlta = /^[A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇ\s]{6,60}$/;

    linhas.forEach(linha => {
        const linhaTrim = linha.trim();
        const matchNumerado = linhaTrim.match(regexTituloNumerado);
        const numeroBate = matchNumerado && parseInt(matchNumerado[1], 10) === proximoNumeroEsperado;
        const ehTituloCaixaAlta = !matchNumerado && regexTituloCaixaAlta.test(linhaTrim) && linhaTrim.length > 0;

        if (numeroBate) {
            if (secaoAtual) secoes.push(secaoAtual);
            secaoAtual = { titulo: matchNumerado[2].trim(), linhasBrutas: [] };
            proximoNumeroEsperado++;
        } else if (ehTituloCaixaAlta) {
            if (secaoAtual) secoes.push(secaoAtual);
            secaoAtual = { titulo: linhaTrim, linhasBrutas: [] };
        } else if (secaoAtual) {
            secaoAtual.linhasBrutas.push(linha);
        }
    });
    if (secaoAtual) secoes.push(secaoAtual);

    return secoes.map(secao => {
        const linhasNaoVazias = secao.linhasBrutas.map(l => l.trim()).filter(l => l.length > 0);

        if (linhasNaoVazias.length === 0) {
            return { titulo: secao.titulo, vazio: true, conteudo: '(Esta seção não possui conteúdo registrado.)' };
        }

        const linhasComBullet = linhasNaoVazias.filter(l => l.startsWith('•') || l.startsWith('-'));
        const ehLista = linhasComBullet.length >= Math.ceil(linhasNaoVazias.length * 0.5) && linhasComBullet.length > 1;

        if (ehLista) {
            return {
                titulo: secao.titulo,
                tipo: 'lista',
                conteudo: linhasNaoVazias.map(l => l.replace(/^[•-]\s*/, ''))
            };
        }

        const linhasChaveValor = linhasNaoVazias.filter(l => /^[A-ZÁÉÍÓÚÂÊÔÃÕÇ][^:]{2,40}:\s+.+/.test(l));
        const ehChaveValor = linhasChaveValor.length === linhasNaoVazias.length && linhasNaoVazias.length > 1;

        if (ehChaveValor) {
            return {
                titulo: secao.titulo,
                tipo: 'chave_valor',
                conteudo: linhasNaoVazias.map(l => {
                    const idx = l.indexOf(':');
                    return [l.slice(0, idx + 1), l.slice(idx + 1).trim()];
                })
            };
        }

        return {
            titulo: secao.titulo,
            tipo: 'paragrafos',
            conteudo: linhasNaoVazias
        };
    });
}

module.exports = { parsearTextoRelatorioParaSecoes };
