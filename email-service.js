// ============================================================
// SERVIÇO DE EMAIL — Protocolo de Londres (BSL Saúde)
// Usa Resend (https://resend.com) — gratuito até 3k emails/mês
// ============================================================
'use strict';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.EMAIL_FROM || 'Protocolo de Londres <onboarding@resend.dev>';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function enviarEmail({ para, assunto, html }) {
    if (!RESEND_API_KEY) {
        console.warn('RESEND_API_KEY nao configurado — email nao enviado');
        return { sucesso: false, motivo: 'RESEND_API_KEY nao configurado' };
    }
    try {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + RESEND_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ from: FROM_EMAIL, to: [para], subject: assunto, html: html })
        });
        const data = await response.json();
        if (!response.ok) {
            console.error('Erro Resend:', data);
            return { sucesso: false, motivo: data.message || 'Erro desconhecido' };
        }
        console.log('Email enviado para ' + para + ': ' + assunto);
        return { sucesso: true, id: data.id };
    } catch (err) {
        console.error('Falha ao enviar email:', err.message);
        return { sucesso: false, motivo: err.message };
    }
}

function templateBase(titulo, subtitulo, conteudo) {
    return '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>' + titulo + '</title></head><body style="margin:0;padding:0;background:#f4f6f9;font-family:Segoe UI,Arial,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:32px 0;"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);"><tr><td style="background:linear-gradient(135deg,#1A6B7A,#2DACA4);padding:0;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td width="33%" height="4" style="background:#D4A020;"></td><td width="34%" height="4" style="background:#C0272D;"></td><td width="33%" height="4" style="background:#1A6B7A;"></td></tr></table><table width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:24px 32px;"><div style="font-size:11px;color:rgba(255,255,255,0.7);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:6px;">BSL Saude — Qualidade e Seguranca</div><div style="font-size:22px;font-weight:700;color:#ffffff;">' + titulo + '</div>' + (subtitulo ? '<div style="font-size:14px;color:rgba(255,255,255,0.85);margin-top:4px;">' + subtitulo + '</div>' : '') + '</td></tr></table></td></tr><tr><td style="padding:32px;">' + conteudo + '</td></tr><tr><td style="padding:20px 32px;background:#f8fafb;border-top:1px solid #e8ecf0;"><div style="font-size:12px;color:#98a2b3;text-align:center;">Protocolo de Londres — Sistema de Qualidade e Seguranca do Paciente — BSL Saude<br>Este e um email automatico, nao responda.</div></td></tr></table></td></tr></table></body></html>';
}

async function emailNovoProtocolo({ para, numero, nomeResidente, tipoIncidente, dataOcorrencia, unidade, responsavel }) {
    const conteudo = '<p style="font-size:15px;color:#374151;margin:0 0 20px;">Ola,</p><p style="font-size:15px;color:#374151;margin:0 0 24px;">Um novo protocolo de investigacao foi aberto no sistema.</p><table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafb;border-radius:10px;border:1px solid #e0e6ed;margin-bottom:24px;"><tr><td style="padding:20px 24px;"><div style="font-size:11px;color:#98a2b3;letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;">Numero do Protocolo</div><div style="font-size:24px;font-weight:700;color:#1A6B7A;margin-bottom:16px;">' + numero + '</div><table width="100%"><tr><td width="50%" style="padding-bottom:10px;"><div style="font-size:11px;color:#98a2b3;text-transform:uppercase;">Residente</div><div style="font-size:14px;font-weight:600;color:#1a2332;">' + (nomeResidente||'—') + '</div></td><td width="50%" style="padding-bottom:10px;"><div style="font-size:11px;color:#98a2b3;text-transform:uppercase;">Tipo de Incidente</div><div style="font-size:14px;font-weight:600;color:#1a2332;">' + (tipoIncidente||'—') + '</div></td></tr><tr><td width="50%"><div style="font-size:11px;color:#98a2b3;text-transform:uppercase;">Data do Evento</div><div style="font-size:14px;font-weight:600;color:#1a2332;">' + (dataOcorrencia||'—') + '</div></td><td width="50%"><div style="font-size:11px;color:#98a2b3;text-transform:uppercase;">Unidade</div><div style="font-size:14px;font-weight:600;color:#1a2332;">' + (unidade||'—') + '</div></td></tr></table></td></tr></table><p style="font-size:14px;color:#6b7280;margin:0 0 24px;">Responsavel pela abertura: <strong>' + (responsavel||'—') + '</strong></p><a href="' + BASE_URL + '/protocolos.html" style="display:inline-block;background:linear-gradient(135deg,#1A6B7A,#2DACA4);color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:700;">Acessar o Sistema</a>';
    return enviarEmail({ para, assunto: 'Novo Protocolo Aberto — ' + numero, html: templateBase('Novo Protocolo de Investigacao', 'Protocolo ' + numero + ' foi aberto', conteudo) });
}

async function emailLembretePendente({ para, numero, nomeResidente, etapasPendentes, diasAberto }) {
    const listaEtapas = (etapasPendentes||[]).map(e => '<li style="padding:4px 0;color:#374151;font-size:14px;">' + e + '</li>').join('');
    const conteudo = '<p style="font-size:15px;color:#374151;margin:0 0 20px;">Ola,</p><p style="font-size:15px;color:#374151;margin:0 0 24px;">O protocolo abaixo esta com etapas pendentes ha <strong>' + diasAberto + ' dias</strong>.</p><table width="100%" cellpadding="0" cellspacing="0" style="background:#fdf6e3;border-radius:10px;border:1px solid #f0d080;margin-bottom:24px;"><tr><td style="padding:20px 24px;"><div style="font-size:18px;font-weight:700;color:#D4A020;margin-bottom:4px;">' + numero + '</div><div style="font-size:14px;color:#6b7280;margin-bottom:16px;">Residente: ' + (nomeResidente||'—') + '</div><div style="font-size:13px;font-weight:700;color:#374151;margin-bottom:8px;">Etapas pendentes:</div><ul style="margin:0;padding-left:20px;">' + listaEtapas + '</ul></td></tr></table><a href="' + BASE_URL + '/protocolos.html" style="display:inline-block;background:linear-gradient(135deg,#D4A020,#c49010);color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:700;">Completar Protocolo</a>';
    return enviarEmail({ para, assunto: 'Protocolo com Etapas Pendentes — ' + numero, html: templateBase('Etapas Pendentes', 'Protocolo ' + numero + ' aguarda conclusao', conteudo) });
}

async function emailProtocoloEncerrado({ para, numero, nomeResidente, tipoIncidente, dataEncerramento, totalAcoes, responsavel }) {
    const conteudo = '<p style="font-size:15px;color:#374151;margin:0 0 20px;">Ola,</p><p style="font-size:15px;color:#374151;margin:0 0 24px;">A investigacao do protocolo abaixo foi <strong>concluida e encerrada</strong>.</p><table width="100%" cellpadding="0" cellspacing="0" style="background:#e3f5ee;border-radius:10px;border:1px solid #a8dfc4;margin-bottom:24px;"><tr><td style="padding:20px 24px;"><div style="font-size:11px;color:#00875A;letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;">Protocolo Encerrado</div><div style="font-size:22px;font-weight:700;color:#00875A;margin-bottom:16px;">' + numero + '</div><table width="100%"><tr><td width="50%" style="padding-bottom:10px;"><div style="font-size:11px;color:#6b7280;text-transform:uppercase;">Residente</div><div style="font-size:14px;font-weight:600;color:#1a2332;">' + (nomeResidente||'—') + '</div></td><td width="50%" style="padding-bottom:10px;"><div style="font-size:11px;color:#6b7280;text-transform:uppercase;">Tipo de Incidente</div><div style="font-size:14px;font-weight:600;color:#1a2332;">' + (tipoIncidente||'—') + '</div></td></tr><tr><td width="50%"><div style="font-size:11px;color:#6b7280;text-transform:uppercase;">Data de Encerramento</div><div style="font-size:14px;font-weight:600;color:#1a2332;">' + (dataEncerramento||'—') + '</div></td><td width="50%"><div style="font-size:11px;color:#6b7280;text-transform:uppercase;">Acoes Corretivas</div><div style="font-size:14px;font-weight:600;color:#1a2332;">' + (totalAcoes||0) + ' acao(oes)</div></td></tr></table></td></tr></table><p style="font-size:14px;color:#6b7280;margin:0 0 24px;">Encerrado por: <strong>' + (responsavel||'—') + '</strong></p><a href="' + BASE_URL + '/protocolos.html?filtro=encerrado" style="display:inline-block;background:linear-gradient(135deg,#00875A,#006644);color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:700;">Ver Relatorio Final</a>';
    return enviarEmail({ para, assunto: 'Protocolo Encerrado — ' + numero, html: templateBase('Investigacao Concluida', 'Protocolo ' + numero + ' foi encerrado', conteudo) });
}

module.exports = { emailNovoProtocolo, emailLembretePendente, emailProtocoloEncerrado };
