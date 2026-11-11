import React from 'react';
import { Link } from 'react-router-dom';

export function TrilhaDeMigalhas({ itens = [] }) {
  const lista = Array.isArray(itens) && itens.length > 0
    ? itens
    : [{ rotulo: 'Início', caminho: '/admin' }];

  return (
    <nav aria-label="Navegação estrutural" style={{ marginBottom: 12 }}>
      <ol
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 6,
          listStyle: 'none',
          margin: 0,
          padding: 0,
          fontSize: 13,
          color: '#64748b',
        }}
      >
        {lista.map((item, idx) => {
          const ultimo = idx === lista.length - 1;
          return (
            <li key={`${item.rotulo}-${idx}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {idx > 0 && <span aria-hidden="true">›</span>}
              {!ultimo && item.caminho ? (
                <Link to={item.caminho} style={{ color: '#0284c7', textDecoration: 'none', fontWeight: 500 }}>
                  {item.rotulo}
                </Link>
              ) : (
                <span aria-current={ultimo ? 'page' : undefined} style={{ fontWeight: ultimo ? 700 : 500, color: ultimo ? '#0f172a' : '#64748b' }}>
                  {item.rotulo}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default TrilhaDeMigalhas;
