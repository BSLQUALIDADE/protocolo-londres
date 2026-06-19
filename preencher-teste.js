// ============================================================
// SCRIPT DE TESTE: preenche automaticamente as Etapas 3 a 16
// de um protocolo já existente (com Etapas 1 e 2 preenchidas),
// simulando um caso completo de QUEDA para testar o fluxo
// inteiro até a geração do PDF na Etapa 17.
//
// USO:
//   node preencher-teste.js <UUID_DO_PROTOCOLO>
// ============================================================

const BASE_URL = 'http://localhost:3000';
const uuid = process.argv[2];

if (!uuid) {
    console.error('Uso: node preencher-teste.js <UUID_DO_PROTOCOLO>');
    process.exit(1);
}

const etapas = {
    3: {
        cronologia: [
            { data: '2026-06-16', hora: '14:30', descricao: 'Residente encontrado caído no chão do quarto pela técnica de enfermagem durante a ronda da tarde.', responsavel: 'Maria Silva', ordem: 1 },
            { data: '2026-06-16', hora: '14:45', descricao: 'Avaliação médica realizada no local. Suspeita de fratura de fêmur. Sinais vitais estáveis.', responsavel: 'Dr. João Pereira', ordem: 2 },
            { data: '2026-06-16', hora: '15:20', descricao: 'Encaminhamento ao hospital de referência para exame de imagem (raio-X).', responsavel: 'Enf. Maria Silva', ordem: 3 },
            { data: '2026-06-16', hora: '17:00', descricao: 'Confirmada fratura no colo do fêmur direito. Indicação de procedimento cirúrgico.', responsavel: 'Hospital de Referência', ordem: 4 }
        ]
    },
    4: {
        entrevistas: [
            {
                nome_entrevistado: 'Maria Silva',
                cargo: 'Técnica de Enfermagem',
                data_entrevista: '2026-06-16',
                horario: '16:00',
                relato_completo: 'Eu estava fazendo a ronda da tarde quando encontrei o residente caído ao lado da cama. Ele estava consciente, mas com muita dor na perna direita. Imediatamente chamei o médico de plantão e prestei os primeiros cuidados, mantendo-o no chão sem movimentar até a avaliação médica.',
                observacoes: 'Técnica seguiu o protocolo de não mover o paciente até avaliação médica.'
            },
            {
                nome_entrevistado: 'Dr. João Pereira',
                cargo: 'Médico Plantonista',
                data_entrevista: '2026-06-16',
                horario: '16:15',
                relato_completo: 'Ao chegar no quarto, constatei dor importante à palpação e rotação externa do membro inferior direito, sinais sugestivos de fratura de fêmur. Optei por estabilização e encaminhamento hospitalar imediato para confirmação por imagem.',
                observacoes: ''
            }
        ]
    },
    5: {
        analise_ia: {
            resumo_executivo: 'Evento de queda com dano grave (fratura de fêmur) ocorrido durante período noturno em residente com alto grau de dependência. A análise aponta falhas relacionadas ao ambiente físico (iluminação inadequada) e à ausência de dispositivos de prevenção compatíveis com o grau de dependência do residente.',
            possiveis_ppc: ['Ausência de avaliação de risco de queda atualizada para o grau de dependência do residente.', 'Falta de dispositivos de mobilidade assistida adequados no quarto.'],
            barreiras_ausentes: ['Sensor de presença/iluminação automática no quarto.', 'Grades de proteção lateral na cama compatíveis com Grau III de dependência.'],
            fatores_contribuintes: ['Iluminação inadequada do quarto durante o período noturno.', 'Dispositivo de mobilidade assistida não compatível com o grau de dependência do residente.'],
            causas_raiz: ['Ausência de padronização na avaliação periódica de risco de queda para residentes Grau III.']
        },
        status: 'aguardando_revisao',
        data_analise: new Date().toISOString()
    },
    6: {
        ppc: [
            { descricao: 'Avaliação de risco de queda não foi atualizada após mudança no grau de dependência do residente.', evidencia: 'Última avaliação registrada há mais de 90 dias no prontuário.', observacoes: 'Verificar periodicidade do protocolo de reavaliação.' }
        ]
    },
    7: {
        fatores_contribuintes: [
            { categoria: 'ambiente', descricao: 'Iluminação inadequada no quarto durante a noite.', evidencia: 'Relatório de manutenção indica lâmpada queimada não substituída.', observacoes: '' },
            { categoria: 'tarefa_tecnologia', descricao: 'Dispositivo de mobilidade assistida não compatível com o grau de dependência do residente.', evidencia: 'Checklist de equipamentos do quarto.', observacoes: '' }
        ]
    },
    8: {
        houve_segunda_vitima: false,
        descricao: '',
        conduta_adotada: '',
        observacoes: 'Equipe relatou abalo emocional leve, mas não foi caracterizada situação de segunda vítima.'
    },
    9: {
        realizado: true,
        data_disclosure: '2026-06-16',
        participantes: ['Dr. João Pereira', 'Enf. Maria Silva', 'Familiar responsável'],
        descricao: 'Comunicação transparente realizada com a família no mesmo dia do evento, explicando o ocorrido, as condutas adotadas e os próximos passos do tratamento.',
        observacoes: ''
    },
    10: {
        necessita_avaliacao: false,
        descricao: '',
        data_parecer: '',
        parecer_juridico: '',
        observacoes: 'Não foi identificada necessidade de avaliação jurídica formal para este caso.'
    },
    11: {
        gravidade: 5,
        urgencia: 4,
        tendencia: 4,
        resultado_gut: 80,
        classificacao: 'crítica'
    },
    12: {
        esforco: 'baixo',
        impacto: 'alto',
        quadrante: 'Prioridade Máxima'
    },
    13: {
        categoria: 'Queda do residente no quarto',
        ramo_1: 'Ambiente: iluminação inadequada no período noturno',
        ramo_2: 'Equipamento: dispositivo de mobilidade incompatível',
        ramo_3: 'Processo: avaliação de risco de queda desatualizada',
        ramo_4: 'Pessoas: equipe seguiu protocolo de não movimentação',
        ramo_5: 'Comunicação: disclosure realizado adequadamente',
        ramo_6: 'Organização: periodicidade de reavaliação não padronizada'
    },
    14: {
        acoes_5w2h: [
            {
                o_que: 'Instalar sensores de presença com iluminação automática nos quartos de residentes Grau III',
                por_que: 'Reduzir risco de quedas durante deslocamentos noturnos por baixa visibilidade',
                onde: 'Todos os quartos de residentes classificados como Grau III na unidade Vivace Saúde',
                quem: 'Equipe de manutenção e facilities',
                quando: '2026-07-15',
                como: 'Contratação de instalação elétrica especializada com sensores de movimento',
                quanto_custa: 'R$ 8.500,00 (estimativa para 12 quartos)',
                status: 'aberta',
                data_conclusao: '',
                evidencia: ''
            },
            {
                o_que: 'Reavaliar periodicidade do protocolo de avaliação de risco de queda',
                por_que: 'Avaliação estava desatualizada em relação ao grau de dependência atual do residente',
                onde: 'Processo de qualidade e segurança do paciente, todas as unidades',
                quem: 'Equipe de qualidade e enfermagem',
                quando: '2026-06-30',
                como: 'Revisão do protocolo institucional e treinamento da equipe',
                quanto_custa: 'Sem custo adicional (revisão de processo)',
                status: 'em_progresso',
                data_conclusao: '',
                evidencia: ''
            }
        ]
    },
    15: {
        diario_bordo: [
            {
                data: '2026-06-17',
                participantes: ['Equipe de Qualidade', 'Coordenação de Enfermagem'],
                assunto: 'Reunião inicial de análise do caso',
                decisoes: 'Definido que o caso será tratado com prioridade máxima dado o resultado da matriz GUT.',
                pendencias: 'Levantamento de custos para instalação de sensores de iluminação.',
                proximos_passos: 'Agendar reunião com facilities para orçamento.',
                anotacoes: ''
            }
        ]
    },
    16: {
        monitoramento: [
            { status: 'aberta', prazo: '2026-07-15', responsavel: 'Equipe de manutenção e facilities', percentual_conclusao: 0, observacoes: 'Aguardando orçamento de fornecedores.' },
            { status: 'em_progresso', prazo: '2026-06-30', responsavel: 'Equipe de qualidade e enfermagem', percentual_conclusao: 40, observacoes: 'Minuta do protocolo revisado já em validação.' }
        ]
    }
};

async function preencherTudo() {
    console.log('Preenchendo etapas de teste para o protocolo: ' + uuid);

    for (const [numero, dados] of Object.entries(etapas)) {
        try {
            const response = await fetch(BASE_URL + '/api/protocolos/' + uuid + '/etapas/' + numero, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dados)
            });

            const json = await response.json();

            if (response.ok && json.sucesso) {
                console.log('OK - Etapa ' + numero + ' salva com sucesso');
            } else {
                console.log('ERRO - Etapa ' + numero + ' retornou erro: ' + (json.erro || 'desconhecido'));
            }
        } catch (err) {
            console.log('FALHA - Etapa ' + numero + ': ' + err.message);
        }

        await new Promise(r => setTimeout(r, 150));
    }

    console.log('Preenchimento concluido!');
    console.log('Proximo passo: abra a Etapa 17 no navegador, clique em "Gerar Rascunho" e depois "Baixar PDF".');
}

preencherTudo();
