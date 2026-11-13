import re

with open("/home/ubuntu/agro-open/web/src/pages/admin/BarbeariaERP.jsx", "r", encoding="utf-8") as f:
    code = f.read()

target = "    return null;\n  }\n\n  function renderIntegracoes() {"

new_functions = '''    return null;
  }

  function renderModalItemValor() {
    if (!modalItemValor) return null;
    const { comanda, itemId, itemNome, itemTipo, quantidade, valorAtual, novoValor, senhaGerente, motivo, salvando: salvandoItem } = modalItemValor;
    const ehFinalizada = ["paga", "em_conta"].includes(comanda.status);
    const valNum = parseFloat(String(novoValor).replace(",", ".")) || 0;
    const novoSubtotalItem = valNum * Number(quantidade || 1);
    const subtotalAntigoItem = Number(valorAtual || 0) * Number(quantidade || 1);
    const diferencaEstimada = novoSubtotalItem - subtotalAntigoItem;
    const novoTotalEstimado = Math.max(0, Number(comanda.total || 0) + diferencaEstimada);

    return (
      <Modal
        title={`✏️ Alterar Valor do Item — ${itemNome}`}
        zIndex={1100}
        onClose={() => !salvandoItem && setModalItemValor(null)}
      >
        <div style={{ display: "grid", gap: 16, minWidth: 320, maxWidth: 480 }}>
          <div style={{ padding: 14, borderRadius: 10, background: "var(--card)", border: "1px solid var(--line)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <div>
                <strong style={{ fontSize: 16 }}>{itemNome}</strong>
                <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>
                  {itemTipo} · Quantidade: <strong>{quantidade}</strong>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <span style={{ fontSize: 12, color: "var(--muted)", display: "block" }}>Valor cobrado atual</span>
                <strong style={{ fontSize: 16, color: "#e05c5c" }}>{moeda(valorAtual)}</strong>
              </div>
            </div>
          </div>

          {comanda.itens?.length > 1 && (
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
                Item a ser alterado:
              </label>
              <select
                style={inputStyle}
                value={itemId}
                onChange={(e) => {
                  const sel = (comanda.itens || []).find((i, idx) => (i.id || `${i.tipo}-${idx}`) === e.target.value);
                  if (sel) {
                    const v = sel.precoUnitario ?? sel.preco ?? 0;
                    setModalItemValor((prev) => ({
                      ...prev,
                      itemId: sel.id || e.target.value,
                      itemNome: sel.nome,
                      itemTipo: sel.tipo === "produto" ? "Produto de revenda" : "Serviço",
                      quantidade: sel.quantidade || sel.qtd || 1,
                      valorAtual: v,
                      novoValor: v,
                    }));
                  }
                }}
              >
                {(comanda.itens || []).map((i, idx) => (
                  <option key={i.id || idx} value={i.id || `${i.tipo}-${idx}`}>
                    {i.nome} — Atual: {moeda(i.precoUnitario || i.preco || 0)}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
              Novo Valor Unitário (R$):
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              autoFocus
              style={{ ...inputStyle, fontSize: 18, fontWeight: 800, color: "var(--fg)" }}
              value={novoValor}
              onChange={(e) => setModalItemValor((prev) => ({ ...prev, novoValor: e.target.value }))}
              placeholder="Ex: 20.00"
            />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6, fontSize: 13 }}>
              <span style={{ color: "var(--muted)" }}>
                Subtotal deste item: <strong>{moeda(novoSubtotalItem)}</strong>
              </span>
              <span style={{ color: "#14b87a", fontWeight: 700 }}>
                Novo Total da Comanda: {moeda(novoTotalEstimado)}
              </span>
            </div>
          </div>

          {ehFinalizada && (
            <div style={{ padding: 14, borderRadius: 10, background: "rgba(2, 132, 199, 0.07)", border: "1px solid rgba(2, 132, 199, 0.35)" }}>
              <strong style={{ color: "#0284c7", display: "flex", alignItems: "center", gap: 6, fontSize: 14 }}>
                🔒 Trava de Segurança — Senha de Gerente Obrigatória
              </strong>
              <span style={{ fontSize: 12, color: "var(--fg)", display: "block", margin: "4px 0 8px" }}>
                Como esta comanda já foi finalizada ({comanda.status === "em_conta" ? "Lançada em Conta" : "Paga"}), a alteração recalcula automaticamente o faturamento e o saldo do cliente e exige a senha do gerente:
              </span>
              <input
                type="password"
                placeholder="Digite a senha do gerente / administrador"
                style={{ ...inputStyle, background: "#fff", color: "#111" }}
                value={senhaGerente}
                onChange={(e) => setModalItemValor((prev) => ({ ...prev, senhaGerente: e.target.value }))}
              />
            </div>
          )}

          <div>
            <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>
              Justificativa / Motivo da correção (opcional):
            </label>
            <input
              type="text"
              style={inputStyle}
              value={motivo}
              onChange={(e) => setModalItemValor((prev) => ({ ...prev, motivo: e.target.value }))}
              placeholder="Ex: Valor da sobrancelha digitado errado"
            />
          </div>

          <div style={{ ...styles.modalActions, marginTop: 10, display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button
              type="button"
              style={styles.secondary}
              disabled={salvandoItem}
              onClick={() => setModalItemValor(null)}
            >
              Cancelar
            </button>
            <button
              type="button"
              style={{ ...styles.primary, background: "#10b981", borderColor: "#059669", fontWeight: 800, fontSize: 14, padding: "10px 20px" }}
              disabled={salvandoItem}
              onClick={confirmarAlteracaoValorItem}
            >
              {salvandoItem ? "Salvando e refinalizando…" : "💾 Salvar Novo Valor & Refinalizar Comanda"}
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  function renderModalReabrir() {
    if (!modalReabrir) return null;
    const { comanda, senhaGerente, motivo, salvando: salvandoReabrir } = modalReabrir;

    return (
      <Modal
        title={`🔄 Reabrir Comanda para Edição Completa (#${comanda.id})`}
        zIndex={1100}
        onClose={() => !salvandoReabrir && setModalReabrir(null)}
      >
        <div style={{ display: "grid", gap: 16, minWidth: 320, maxWidth: 480 }}>
          <div style={{ padding: 14, borderRadius: 10, background: "rgba(2, 132, 199, 0.06)", border: "1px solid rgba(2, 132, 199, 0.25)" }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#0284c7" }}>
              Reabertura de Comanda Finalizada
            </div>
            <div style={{ fontSize: 13, marginTop: 4, color: "var(--fg)" }}>
              Cliente: <strong>{comanda.clienteNome || "Cliente Eventual"}</strong> · Total faturado atual: <strong>{moeda(comanda.total)}</strong>
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>
              Esta ação reabre a comanda para que você possa adicionar ou remover serviços e produtos livremente. Ao concluir a edição, basta clicar em <strong>"Finalizar Novamente em Conta"</strong>.
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
              🔒 Senha de Gerente / Administrador:
            </label>
            <input
              type="password"
              autoFocus
              placeholder="Digite a senha para autorizar a reabertura"
              style={{ ...inputStyle, background: "#fff", color: "#111" }}
              value={senhaGerente}
              onChange={(e) => setModalReabrir((prev) => ({ ...prev, senhaGerente: e.target.value }))}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>
              Motivo da Reabertura:
            </label>
            <input
              type="text"
              style={inputStyle}
              value={motivo}
              onChange={(e) => setModalReabrir((prev) => ({ ...prev, motivo: e.target.value }))}
              placeholder="Ex: Ajuste de itens e serviços"
            />
          </div>

          <div style={{ ...styles.modalActions, marginTop: 10, display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button
              type="button"
              style={styles.secondary}
              disabled={salvandoReabrir}
              onClick={() => setModalReabrir(null)}
            >
              Cancelar
            </button>
            <button
              type="button"
              style={{ ...styles.primary, background: "#0284c7", borderColor: "#0284c7", fontWeight: 800, fontSize: 14, padding: "10px 20px" }}
              disabled={salvandoReabrir}
              onClick={confirmarReaberturaComanda}
            >
              {salvandoReabrir ? "Reabrindo comanda…" : "🔄 Confirmar Reabertura"}
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  function renderIntegracoes() {'''

if target in code:
    code = code.replace(target, new_functions, 1)
    code = code.replace("{renderModal()}", "{renderModal()}\n        {renderModalItemValor()}\n        {renderModalReabrir()}")
    with open("/home/ubuntu/agro-open/web/src/pages/admin/BarbeariaERP.jsx", "w", encoding="utf-8") as f:
        f.write(code)
    print("SUCCESS: BarbeariaERP.jsx patched successfully!")
else:
    print("ERROR: Target not found in BarbeariaERP.jsx")
