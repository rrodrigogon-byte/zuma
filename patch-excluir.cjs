const fs = require('fs');
let code = fs.readFileSync('/home/ubuntu/agro-open/web/src/pages/admin/BarbeariaPlanosAssinaturasPanel.jsx', 'utf8');

const oldBtns = `                  <button
                    type="button"
                    onClick={() => abrirModalCriarPlano(plano)}
                    style={{
                      padding: '7px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--line)',
                      background: 'transparent',
                      color: 'var(--fg)',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Editar
                  </button>`;

const newBtns = `                  <button
                    type="button"
                    onClick={() => abrirModalCriarPlano(plano)}
                    style={{
                      padding: '7px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--line)',
                      background: 'transparent',
                      color: 'var(--fg)',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Excluir este plano?')) {
                        onExcluirPlano && onExcluirPlano(plano)
                      }
                    }}
                    style={{
                      padding: '7px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--line)',
                      background: 'transparent',
                      color: '#e05c5c',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Excluir
                  </button>`;

code = code.replace(oldBtns, newBtns);
fs.writeFileSync('/home/ubuntu/agro-open/web/src/pages/admin/BarbeariaPlanosAssinaturasPanel.jsx', code, 'utf8');
console.log('Patched Excluir');
