import React, { useState, useEffect } from 'react';
import { LayoutGrid, Eye, Plus, Layers, Barcode, CheckCircle2 } from 'lucide-react';
import { api } from '../../../lib/api';

export default function PlanogramaGondolaPanel({ toast }) {
  const [corredorAtivo, setCorredorAtivo] = useState('CORREDOR-01');
  const [planogramas, setPlanogramas] = useState([
    {
      id: 'PLANO-01',
      corredor: 'CORREDOR-01',
      nome: 'Gôndola Mercearia Básica · Grãos & Farinhas',
      modulos: 4,
      prateleiras: 5,
      itens: [
        { nivel: 5, posicao: 1, nome: 'Arroz Tio João 5kg', facings: 4, share: '35%', cor: '#10b981' },
        { nivel: 5, posicao: 2, nome: 'Arroz Camil 5kg', facings: 3, share: '25%', cor: '#0284c7' },
        { nivel: 4, posicao: 1, nome: 'Feijão Carioca Camil 1kg', facings: 5, share: '40%', cor: '#f59e0b' },
        { nivel: 3, posicao: 1, nome: 'Açúcar Cristal União 1kg', facings: 4, share: '30%', cor: '#8b5cf6' },
        { nivel: 2, posicao: 1, nome: 'Farinha de Trigo Especial 1kg', facings: 3, share: '20%', cor: '#ec4899' },
        { nivel: 1, posicao: 1, nome: 'Sal Refinado Cisne 1kg', facings: 2, share: '10%', cor: '#64748b' }
      ]
    },
    {
      id: 'PLANO-02',
      corredor: 'CORREDOR-02',
      nome: 'Gôndola Matinais & Bebidas Quentes',
      modulos: 3,
      prateleiras: 4,
      itens: [
        { nivel: 4, posicao: 1, nome: 'Café Pilão Tradicional 500g', facings: 5, share: '50%', cor: '#78350f' },
        { nivel: 3, posicao: 1, nome: 'Leite Condensado Moça 395g', facings: 4, share: '30%', cor: '#0284c7' },
        { nivel: 2, posicao: 1, nome: 'Achocolatado Nescau 400g', facings: 4, share: '35%', cor: '#dc2626' }
      ]
    }
  ]);

  const planoAtivo = planogramas.find(p => p.corredor === corredorAtivo) || planogramas[0];

  return (
    <div className="super-card animate-fadeIn">
      <div className="super-card-header">
        <div>
          <div className="super-card-tag">TRADE MARKETING · GÔNDOLA & VISUAL MERCHANDISING</div>
          <h2 className="super-card-title">Planograma Oficial de Gôndola (2D/3D)</h2>
          <p className="super-card-subtitle">
            Organização espacial das gôndolas, distribuição de facings (frentes) e share de gôndola por marca.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className={`super-btn ${corredorAtivo === 'CORREDOR-01' ? 'super-btn-primary' : 'super-btn-outline'}`}
            onClick={() => setCorredorAtivo('CORREDOR-01')}
          >
            Corredor 01 (Mercearia)
          </button>
          <button
            className={`super-btn ${corredorAtivo === 'CORREDOR-02' ? 'super-btn-primary' : 'super-btn-outline'}`}
            onClick={() => setCorredorAtivo('CORREDOR-02')}
          >
            Corredor 02 (Matinais)
          </button>
        </div>
      </div>

      <div style={{
        background: '#1e293b',
        borderRadius: 12,
        padding: 20,
        color: '#fff',
        marginBottom: 20
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>
            Visualizador de Prateleiras: {planoAtivo.nome}
          </h3>
          <span style={{ fontSize: 12, background: 'rgba(255,255,255,0.1)', padding: '4px 10px', borderRadius: 20 }}>
            Altura dos Olhos (Eye-Level): Níveis 4 e 5 (Maior Giro)
          </span>
        </div>

        {/* Simulação Visual de Gôndola */}
        <div style={{ display: 'grid', gap: 10 }}>
          {[5, 4, 3, 2, 1].map(nivel => {
            const itensNivel = planoAtivo.itens.filter(i => i.nivel === nivel);
            return (
              <div key={nivel} style={{
                background: '#0f172a',
                border: '1px solid #334155',
                borderRadius: 8,
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 16
              }}>
                <div style={{
                  width: 70,
                  fontSize: 11,
                  fontWeight: 800,
                  color: nivel >= 4 ? '#38bdf8' : '#94a3b8',
                  textTransform: 'uppercase'
                }}>
                  Nível {nivel} {nivel >= 4 && '★ Olhos'}
                </div>
                <div style={{ display: 'flex', gap: 10, flex: 1, flexWrap: 'wrap' }}>
                  {itensNivel.length > 0 ? itensNivel.map((item, idx) => (
                    <div key={idx} style={{
                      background: item.cor,
                      color: '#fff',
                      padding: '8px 12px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8
                    }}>
                      <span>{item.nome}</span>
                      <span style={{ fontSize: 10, background: 'rgba(0,0,0,0.25)', padding: '2px 6px', borderRadius: 4 }}>
                        {item.facings} facings ({item.share})
                      </span>
                    </div>
                  )) : (
                    <div style={{ fontSize: 12, color: '#64748b', fontStyle: 'italic' }}>
                      Espaço livre para giro promocional / ponta de gôndola
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
