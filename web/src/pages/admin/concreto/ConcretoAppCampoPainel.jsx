import React, { useState } from 'react';
import { 
  Truck, Smartphone, Download, QrCode, CheckCircle2, Clock, 
  Camera, Share2, Printer, ExternalLink, ShieldCheck, MapPin, 
  FileText, Copy, RefreshCw, Eye, AlertCircle
} from 'lucide-react';

export default function ConcretoAppCampoPainel({ cargas = [], frota = [], onRecarregar }) {
  const [modalCanhotoAberto, setModalCanhotoAberto] = useState(null);
  const [modalQrCarga, setModalQrCarga] = useState(null);
  const [copiado, setCopiado] = useState(false);

  const urlBaseApp = `${window.location.origin}/concreto/app`;

  // Cálculos de KPIs
  const totalCargas = cargas.length;
  const cargasAssinadas = cargas.filter(c => c.assinaturaEntrega && c.assinaturaEntrega.status === 'assinado').length;
  const cargasEmTransito = cargas.filter(c => c.status === 'em_transito').length;
  const totalFotosColetadas = cargas.reduce((acc, c) => acc + (c.assinaturaEntrega?.fotos?.length || 0), 0);

  const copiarLinkApp = () => {
    navigator.clipboard.writeText(urlBaseApp);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  };

  const baixarApk = () => {
    window.location.href = '/api/public/concreto/download-apk';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ─── BANNER PRINCIPAL DO APP DE CAMPO ─── */}
      <div style={{
        background: 'linear-gradient(135deg, #161F30 0%, #0F172A 100%)',
        border: '2px solid rgba(255, 107, 44, 0.4)',
        borderRadius: 16,
        padding: 24,
        boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
        display: 'flex',
        flexDirection: 'column',
        gap: 18
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{
                background: '#FF6B2C',
                color: '#FFF',
                fontSize: 11,
                fontWeight: 900,
                padding: '3px 10px',
                borderRadius: 20,
                textTransform: 'uppercase',
                letterSpacing: 0.5
              }}>
                App PWA &amp; APK Android
              </span>
              <span style={{ color: '#D4AF37', fontSize: 12, fontWeight: 800 }}>
                ★ Serrano Concreto · Campo &amp; Canteiro de Obras
              </span>
            </div>
            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: '#FFF', letterSpacing: -0.5 }}>
              Central de Assinatura Digital &amp; Validação Fotográfica na Obra
            </h2>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: '#CBD5E1', maxWidth: 850, lineHeight: 1.5 }}>
              Aplicativo PWA móvel e instalador APK Android para os motoristas da frota Serrano Concreto coletarem a <strong>assinatura digital do cliente</strong>, fotos do <strong>Slump Test (tronco de cone)</strong> e da <strong>descarga na forma</strong>, com geolocalização GPS e emissão do canhoto eletrônico conforme a NBR 7212.
            </p>
          </div>

          {/* BOTÕES DE DISTRIBUIÇÃO */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={baixarApk}
              style={{
                background: '#10B981',
                color: '#064E3B',
                border: 'none',
                padding: '10px 16px',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 900,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
              }}
            >
              <Download size={16} />
              <span>Baixar APK Android</span>
            </button>

            <button
              type="button"
              onClick={() => window.open(urlBaseApp, '_blank')}
              style={{
                background: '#FF6B2C',
                color: '#FFF',
                border: 'none',
                padding: '10px 16px',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 900,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: '0 4px 12px rgba(255, 107, 44, 0.3)'
              }}
            >
              <Smartphone size={16} />
              <span>Abrir App PWA de Campo</span>
            </button>
          </div>
        </div>

        {/* 4 CARDS DE INDICADORES DE CAMPO */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 14 }}>
            <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase' }}>Cargas do Dia</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#FFF', marginTop: 2 }}>{totalCargas}</div>
            <div style={{ fontSize: 11, color: '#CBD5E1', marginTop: 2 }}>Programação total</div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 14 }}>
            <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase' }}>Canhotos Homologados</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#34D399', marginTop: 2 }}>{cargasAssinadas}</div>
            <div style={{ fontSize: 11, color: '#CBD5E1', marginTop: 2 }}>Assinaturas digitais NBR 7212</div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 14 }}>
            <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase' }}>Em Trânsito / Canteiro</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#FCD34D', marginTop: 2 }}>{cargasEmTransito}</div>
            <div style={{ fontSize: 11, color: '#CBD5E1', marginTop: 2 }}>Aguardando entrega</div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 14 }}>
            <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase' }}>Fotos de Campo</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#60A5FA', marginTop: 2 }}>{totalFotosColetadas}</div>
            <div style={{ fontSize: 11, color: '#CBD5E1', marginTop: 2 }}>Slump test &amp; descargas</div>
          </div>
        </div>
      </div>

      {/* ─── CARDS DE DISTRIBUIÇÃO DO APP: QR CODE & INSTRUÇÕES DE INSTALAÇÃO ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        
        {/* CARD 1: QR CODE DE ACESSO RÁPIDO DO MOTORISTA */}
        <div style={{
          background: '#131B2E',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 14,
          padding: 20,
          display: 'flex',
          gap: 16,
          alignItems: 'center'
        }}>
          <div style={{
            background: '#FFF',
            padding: 10,
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(0,0,0,0.3)'
          }}>
            {/* QR CODE GERADO VIA API DE ALTA DISPONIBILIDADE */}
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=${encodeURIComponent(urlBaseApp)}`}
              alt="QR Code App de Campo Serrano"
              style={{ width: 110, height: 110, display: 'block' }}
            />
          </div>

          <div style={{ flex: 1 }}>
            <h4 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: '#FFF' }}>
              QR Code do App para a Frota
            </h4>
            <p style={{ margin: '4px 0 10px', fontSize: 12, color: '#94A3B8', lineHeight: 1.4 }}>
              O motorista aponta a câmera do celular para este QR Code antes de sair da balança rodoviária 80t para abrir o app de campo instantaneamente.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={copiarLinkApp}
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: '#FFF',
                  padding: '6px 10px',
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  cursor: 'pointer'
                }}
              >
                <Copy size={13} />
                <span>{copiado ? '✓ Link Copiado!' : 'Copiar Link'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* CARD 2: PACOTE APK ANDROID DA SERRANO CONCRETO */}
        <div style={{
          background: '#131B2E',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 14,
          padding: 20,
          display: 'flex',
          gap: 16,
          alignItems: 'center'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #10B981 0%, #047857 100%)',
            width: 74,
            height: 74,
            borderRadius: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(16, 185, 129, 0.3)',
            flexShrink: 0
          }}>
            <Smartphone size={36} color="#FFF" />
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <h4 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: '#FFF' }}>
                APK Android Oficial
              </h4>
              <span style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#34D399', fontSize: 10, fontWeight: 900, padding: '2px 6px', borderRadius: 4 }}>
                v1.0.0-PROD
              </span>
            </div>
            <p style={{ margin: '4px 0 10px', fontSize: 12, color: '#94A3B8', lineHeight: 1.4 }}>
              Instale o aplicativo nativo nos smartphones da equipe (Samsung, Motorola, Xiaomi). Funciona mesmo em áreas de canteiro com sinal fraco.
            </p>
            <button
              type="button"
              onClick={baixarApk}
              style={{
                background: '#10B981',
                color: '#064E3B',
                border: 'none',
                padding: '6px 12px',
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 900,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                cursor: 'pointer'
              }}
            >
              <Download size={13} />
              <span>Baixar Serrano-Campo.apk</span>
            </button>
          </div>
        </div>

      </div>

      {/* ─── TABELA DE CARGAS & STATUS DO CANHOTO DIGITAL ─── */}
      <div style={{
        background: '#131B2E',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 14,
        padding: 20
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#FFF' }}>
              Cargas em Trânsito &amp; Canhotos Assinados em Campo
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#94A3B8' }}>
              Acompanhamento ao vivo do recebimento no canteiro e coleta de fotos dos ensaios NBR 7212.
            </p>
          </div>
          <button
            type="button"
            onClick={onRecarregar}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#CBD5E1',
              padding: '6px 12px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={13} />
            <span>Atualizar Cargas</span>
          </button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94A3B8', fontSize: 11, textTransform: 'uppercase' }}>
                <th style={{ padding: '10px 8px' }}>Carga</th>
                <th style={{ padding: '10px 8px' }}>Cliente / Obra</th>
                <th style={{ padding: '10px 8px' }}>Betoneira / Motorista</th>
                <th style={{ padding: '10px 8px' }}>Traço / Volume</th>
                <th style={{ padding: '10px 8px' }}>Status Canhoto</th>
                <th style={{ padding: '10px 8px' }}>Fotos Obra</th>
                <th style={{ padding: '10px 8px', textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {cargas.map(carga => {
                const ass = carga.assinaturaEntrega;
                const estaAssinado = ass && ass.status === 'assinado';
                const fotosCount = ass?.fotos?.length || 0;
                const urlCargaApp = `${window.location.origin}/concreto/app?carga=${carga.id}`;

                return (
                  <tr key={carga.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '12px 8px', fontWeight: 900, color: '#FF6B2C' }}>
                      #{carga.numero || carga.id}
                    </td>

                    <td style={{ padding: '12px 8px' }}>
                      <div style={{ fontWeight: 800, color: '#FFF' }}>{carga.cliente}</div>
                      <div style={{ fontSize: 11, color: '#94A3B8' }}>{carga.obra}</div>
                    </td>

                    <td style={{ padding: '12px 8px' }}>
                      <div style={{ fontWeight: 700, color: '#CBD5E1' }}>
                        {carga.viagens?.[0]?.veiculo || 'BT-01'}
                      </div>
                      <div style={{ fontSize: 11, color: '#94A3B8' }}>
                        {carga.viagens?.[0]?.motorista || 'Marcos Silveira'}
                      </div>
                    </td>

                    <td style={{ padding: '12px 8px' }}>
                      <div style={{ fontWeight: 800, color: '#FCD34D' }}>
                        {carga.volumeM3} m³
                      </div>
                      <div style={{ fontSize: 11, color: '#CBD5E1' }}>
                        {carga.fck}
                      </div>
                    </td>

                    <td style={{ padding: '12px 8px' }}>
                      {estaAssinado ? (
                        <span style={{
                          background: 'rgba(16, 185, 129, 0.15)',
                          color: '#34D399',
                          fontSize: 11,
                          fontWeight: 900,
                          padding: '3px 8px',
                          borderRadius: 6,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4
                        }}>
                          <CheckCircle2 size={12} />
                          <span>Assinado por {ass.recebedorNome}</span>
                        </span>
                      ) : (
                        <span style={{
                          background: 'rgba(245, 158, 11, 0.15)',
                          color: '#FBBF24',
                          fontSize: 11,
                          fontWeight: 800,
                          padding: '3px 8px',
                          borderRadius: 6,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4
                        }}>
                          <Clock size={12} />
                          <span>Pendente em Campo</span>
                        </span>
                      )}
                    </td>

                    <td style={{ padding: '12px 8px' }}>
                      {fotosCount > 0 ? (
                        <span style={{
                          background: 'rgba(96, 165, 250, 0.15)',
                          color: '#60A5FA',
                          fontSize: 11,
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: 6,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4
                        }}>
                          <Camera size={12} />
                          <span>{fotosCount} fotos</span>
                        </span>
                      ) : (
                        <span style={{ color: '#64748B', fontSize: 11 }}>Sem fotos</span>
                      )}
                    </td>

                    <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        {/* BOTÃO QR CODE PARA O MOTORISTA */}
                        <button
                          type="button"
                          onClick={() => setModalQrCarga({ carga, url: urlCargaApp })}
                          title="Gerar QR Code desta carga para o motorista"
                          style={{
                            background: 'rgba(255, 107, 44, 0.15)',
                            border: '1px solid #FF6B2C',
                            color: '#FF9E66',
                            padding: '6px',
                            borderRadius: 6,
                            cursor: 'pointer'
                          }}
                        >
                          <QrCode size={14} />
                        </button>

                        {/* BOTÃO ABRIR CANHOTO OFICIAL */}
                        <button
                          type="button"
                          onClick={() => window.open(`/api/public/concreto/cargas/${carga.id}/canhoto-digital-html`, '_blank')}
                          title="Visualizar Canhoto Oficial NBR 7212"
                          style={{
                            background: 'rgba(255,255,255,0.08)',
                            border: '1px solid rgba(255,255,255,0.15)',
                            color: '#FFF',
                            padding: '6px 10px',
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            cursor: 'pointer'
                          }}
                        >
                          <Eye size={13} />
                          <span>Canhoto</span>
                        </button>

                        {/* BOTÃO ABRIR NO PWA */}
                        <button
                          type="button"
                          onClick={() => window.open(urlCargaApp, '_blank')}
                          title="Abrir no PWA de Campo"
                          style={{
                            background: '#FF6B2C',
                            border: 'none',
                            color: '#FFF',
                            padding: '6px 10px',
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 800,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            cursor: 'pointer'
                          }}
                        >
                          <Smartphone size={13} />
                          <span>App</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── MODAL QR CODE DA CARGA PARA O MOTORISTA ─── */}
      {modalQrCarga && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: 20
        }}>
          <div style={{
            background: '#1E293B',
            color: '#FFF',
            borderRadius: 16,
            padding: 24,
            maxWidth: 380,
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
            border: '1px solid rgba(255, 107, 44, 0.4)'
          }}>
            <h3 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 900, color: '#FF6B2C' }}>
              QR Code · Carga #{modalQrCarga.carga.numero || modalQrCarga.carga.id}
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: 12, color: '#94A3B8' }}>
              Motorista, aponte a câmera do seu celular para abrir a carga direto no canteiro de obras.
            </p>

            <div style={{
              background: '#FFF',
              padding: 14,
              borderRadius: 12,
              display: 'inline-block',
              boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
              marginBottom: 16
            }}>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(modalQrCarga.url)}`}
                alt="QR Code da Carga"
                style={{ width: 180, height: 180, display: 'block' }}
              />
            </div>

            <div style={{ fontSize: 12, color: '#CBD5E1', marginBottom: 16, textAlign: 'left', background: 'rgba(0,0,0,0.2)', padding: 10, borderRadius: 8 }}>
              <div><strong>Cliente:</strong> {modalQrCarga.carga.cliente}</div>
              <div><strong>Obra:</strong> {modalQrCarga.carga.obra}</div>
              <div><strong>Traço:</strong> {modalQrCarga.carga.fck} ({modalQrCarga.carga.volumeM3}m³)</div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => setModalQrCarga(null)}
                style={{ flex: 1, background: 'rgba(255,255,255,0.08)', color: '#FFF', border: 'none', padding: '10px', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={() => window.open(modalQrCarga.url, '_blank')}
                style={{ flex: 1, background: '#FF6B2C', color: '#FFF', border: 'none', padding: '10px', borderRadius: 8, fontWeight: 900, cursor: 'pointer' }}
              >
                Abrir App
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
