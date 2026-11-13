import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import {
  HOLDING_PALATARE_EMPRESA_ID,
  PALATARE_PIZZARIA_EMPRESA_ID,
  SERRANO_CONCRETO_EMPRESA_ID,
  GRUPO_PALATARE_EMPRESAS,
  isGrupoPalatareEmpresa
} from "../lib/palatare-constants";

function iconeEmpresa(emp) {
  if (!emp) return "🏢";
  const nome = String(emp.nome || emp.nomeFantasia || emp.razaoSocial || '').toLowerCase();
  const tipo = String(emp.tipoNegocio || '').toLowerCase();
  if (emp.logoUrl) {
    return <img src={emp.logoUrl} alt={emp.nome || ''} style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover' }} />;
  }
  if (tipo === "restaurante" || nome.includes("palatare") || nome.includes("pizza")) return "🍕";
  if (tipo === "concreto" || nome.includes("concreto") || nome.includes("serrano") || nome.includes("usina")) return "🚚";
  if (tipo === 'barbearia' || nome.includes('dino')) return '💈';
  if (tipo === 'supermercado') return '🛒';
  if (tipo === 'esporte' || nome.includes('agro')) return '🎾';
  if (tipo === 'loja' || nome.includes('stallone')) return '🏪';
  return '🏢';
}

export default function EmpresaSwitcher() {
  const [empresas, setEmpresas] = useState([]);
  const [empresaAtiva, setEmpresaAtiva] = useState(null);
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [ehAdminPlataforma, setEhAdminPlataforma] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  // Carregar empresa ativa inicial do localStorage
  useEffect(() => {
    try {
      const empRaw = localStorage.getItem("empresa_ativa") || localStorage.getItem("sp_empresa_ativa");
      if (empRaw) {
        setEmpresaAtiva(JSON.parse(empRaw));
      }
    } catch {}
  }, []);

  // Buscar lista de empresas da API respeitando isolamento
  const carregarEmpresas = async () => {
    try {
      setCarregando(true);
      const res = await api.get("/api/admin/empresas");
      const bruta = res?.empresas || res || [];
      const ehAdmin = Boolean(res?.ehAdminPlataforma);
      setEhAdminPlataforma(ehAdmin);

      // Filtra estritamente apenas empresas legítimas (remover qualquer resquício de Imperial ou testes)
      let lista = (Array.isArray(bruta) ? bruta : []).filter(e => {
        const nome = String(e.nome || "").toLowerCase();
        const cnpj = String(e.cnpj || "").replace(/\D/g, "");
        if (nome.includes("imperial") || nome.includes("homologação alterada") || cnpj === "98765432000199") {
          return false;
        }
        return true;
      });

      // Garante SEMPRE as 3 empresas canônicas do Grupo Palatare (Holding, Pizzaria, Concreto)
      for (const empGp of GRUPO_PALATARE_EMPRESAS) {
        const jaTem = lista.some(e => String(e.id || '').toLowerCase() === empGp.id.toLowerCase());
        if (!jaTem) {
          lista.push(empGp);
        }
      }

      if (lista.length > 0) {
        setEmpresas(lista);
        
        let empAtual = null;
        try {
          const empRaw = localStorage.getItem("empresa_ativa") || localStorage.getItem("sp_empresa_ativa");
          if (empRaw) empAtual = JSON.parse(empRaw);
        } catch {}

        const autorizada = empAtual && lista.find(e => e.id === empAtual.id || (e.cnpj && empAtual.cnpj && String(e.cnpj).replace(/\D/g, "") === String(empAtual.cnpj).replace(/\D/g, "")));
        
        if (!autorizada) {
          selecionarEmpresa(lista[0], false);
        } else {
          setEmpresaAtiva(autorizada);
        }
      }
    } catch (e) {
      console.warn("Erro ao carregar empresas:", e);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarEmpresas();
  }, []);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const clickFora = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setAberto(false);
      }
    };
    document.addEventListener("mousedown", clickFora);
    return () => document.removeEventListener("mousedown", clickFora);
  }, []);

  const selecionarEmpresa = (emp, recarregar = true) => {
    setEmpresaAtiva(emp);
    try {
      localStorage.setItem("empresa_ativa", JSON.stringify(emp));
      localStorage.setItem("sp_empresa_ativa", JSON.stringify(emp));
      localStorage.setItem("empresaAtivaId", emp.id);
      
      if (emp.lojas && emp.lojas.length > 0) {
        localStorage.setItem("loja_ativa", JSON.stringify(emp.lojas[0]));
        localStorage.setItem("sp_loja_ativa", JSON.stringify(emp.lojas[0]));
      }
      window.dispatchEvent(new CustomEvent("empresa_alterada", { detail: emp }));
    } catch {}
    setAberto(false);
    if (emp.id === HOLDING_PALATARE_EMPRESA_ID || emp.tipoNegocio === 'holding') {
      navigate('/admin/concreto?secao=empresa-holding');
    } else if (emp.id === PALATARE_PIZZARIA_EMPRESA_ID || emp.tipoNegocio === 'restaurante') {
      navigate('/admin/pizzaria');
    } else if (emp.id === SERRANO_CONCRETO_EMPRESA_ID || emp.tipoNegocio === 'concreto') {
      navigate('/admin/concreto');
    } else if (recarregar) {
      window.location.reload();
    }
  };

  const podeTrocar = empresas.length > 1;
  const nome = empresaAtiva?.nome || empresaAtiva?.nomeFantasia || empresaAtiva?.razaoSocial || (empresas[0]?.nome) || "Barbearia Dino";
  const ie = empresaAtiva?.inscricaoEstadual || (empresas[0]?.inscricaoEstadual) || "Isento";
  const cnpj = empresaAtiva?.cnpj || (empresas[0]?.cnpj) || "";

  return (
    <div ref={ref} style={{ position: "relative", display: "flex", alignItems: "center" }}>
      <button
        type="button"
        onClick={() => {
          if (podeTrocar) setAberto(!aberto);
        }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "4px 10px",
          background: aberto ? "rgba(99, 102, 241, 0.12)" : "var(--card, #0f172a)",
          border: aberto ? "1px solid var(--accent, #6366f1)" : "1px solid var(--line, #334155)",
          borderRadius: "10px",
          color: "var(--text, #f8fafc)",
          cursor: podeTrocar ? "pointer" : "default",
          transition: "all 0.15s ease"
        }}
        title={podeTrocar ? "Alternar Empresa Ativa (Acesso Superadmin Global)" : `Empresa Vinculada: ${nome}`}
      >
        <span style={{ fontSize: "16px", display: "inline-flex", alignItems: "center" }}>{iconeEmpresa(empresaAtiva)}</span>
        <div style={{ textAlign: "left", lineHeight: 1.2 }}>
          <div style={{
            fontSize: "12px",
            fontWeight: 800,
            color: "var(--text, #f8fafc)",
            maxWidth: "150px",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis"
          }}>
            {nome}
          </div>
          <div style={{
            fontSize: "10px",
            color: ie && ie !== "Isento" ? "#10b981" : "var(--muted, #94a3b8)",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: "3px"
          }}>
            <span>●</span> {ie && ie !== "Isento" ? `IE: ${ie} (SEFAZ-MT)` : (cnpj ? `CNPJ: ${cnpj}` : "Empresa Ativa")}
          </div>
        </div>
        {podeTrocar && (
          <span style={{ fontSize: "10px", color: "var(--muted, #94a3b8)", marginLeft: "2px" }}>
            {aberto ? "▲" : "▼"}
          </span>
        )}
      </button>

      {/* Dropdown Exclusivo para Superadmin Global com múltiplas empresas */}
      {aberto && podeTrocar && (
        <div style={{
          position: "absolute",
          top: "46px",
          left: 0,
          width: "320px",
          background: "var(--surface, #1e293b)",
          border: "1px solid var(--line, #334155)",
          borderRadius: "12px",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)",
          zIndex: 1000,
          overflow: "hidden",
          animation: "fadeIn 0.12s ease"
        }}>
          <div style={{
            padding: "10px 14px",
            borderBottom: "1px solid var(--line, #334155)",
            background: "var(--card, #0f172a)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
          }}>
            <span style={{ fontSize: "11px", fontWeight: 800, color: "var(--muted, #94a3b8)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Seletor de Empresas &amp; Holding
            </span>
            <span style={{ fontSize: "10px", background: "rgba(16, 185, 129, 0.15)", color: "#10b981", padding: "1px 6px", borderRadius: "4px", fontWeight: 700 }}>
              {empresas.length} disponível(is)
            </span>
          </div>

          <div style={{ maxHeight: "300px", overflowY: "auto", padding: "6px" }}>
            {/* 1. SEÇÃO GRUPO PALATARE (HOLDING E CONTROLADAS) */}
            {(() => {
              const empresasPalatare = empresas.filter(e => isGrupoPalatareEmpresa(e.id) || isGrupoPalatareEmpresa(e.nome));
              const outrasEmpresas = empresas.filter(e => !isGrupoPalatareEmpresa(e.id) && !isGrupoPalatareEmpresa(e.nome));
              return (
                <>
                  {empresasPalatare.length > 0 && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={{
                        padding: "6px 10px 4px",
                        fontSize: "10px",
                        fontWeight: 800,
                        color: "#C5A059",
                        textTransform: "uppercase",
                        letterSpacing: "0.6px",
                        display: "flex",
                        alignItems: "center",
                        gap: 6
                      }}>
                        <span>🏛️</span> GRUPO PALATARE · HOLDING
                      </div>
                      {empresasPalatare.map((emp) => {
                        const selecionada = (empresaAtiva?.id === emp.id) || (empresaAtiva?.cnpj === emp.cnpj);
                        const isH = emp.id === HOLDING_PALATARE_EMPRESA_ID || emp.tipoNegocio === 'holding';
                        return (
                          <div
                            key={emp.id}
                            onClick={() => selecionarEmpresa(emp)}
                            style={{
                              padding: "8px 12px",
                              borderRadius: "8px",
                              cursor: "pointer",
                              background: selecionada ? "rgba(197, 160, 89, 0.18)" : "transparent",
                              border: selecionada ? "1px solid rgba(197, 160, 89, 0.4)" : "1px solid transparent",
                              display: "flex",
                              alignItems: "center",
                              gap: "10px",
                              marginBottom: "4px",
                              marginLeft: isH ? 0 : 8,
                              transition: "all 0.1s ease"
                            }}
                          >
                            <div style={{
                              width: "30px",
                              height: "30px",
                              borderRadius: "6px",
                              background: isH ? "#C5A059" : emp.tipoNegocio === 'restaurante' ? "#EF4444" : "#FF7000",
                              color: isH ? "#000" : "#ffffff",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "14px",
                              fontWeight: 700,
                              flexShrink: 0
                            }}>
                              {isH ? "🏢" : emp.tipoNegocio === 'restaurante' ? "🍕" : "🚚"}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{
                                fontSize: "13px",
                                fontWeight: 700,
                                color: selecionada ? "#ffffff" : "var(--text, #f8fafc)",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis"
                              }}>
                                {emp.nome || emp.nomeFantasia || emp.razaoSocial}
                                {isH && <span style={{ marginLeft: 6, fontSize: 10, background: "#C5A059", color: "#000", padding: "1px 5px", borderRadius: 4, fontWeight: 800 }}>Controladora</span>}
                              </div>
                              {emp.cnpj && (
                                <div style={{ fontSize: "11px", color: "var(--muted, #94a3b8)" }}>
                                  CNPJ: {emp.cnpj}
                                </div>
                              )}
                              {emp.inscricaoEstadual && emp.inscricaoEstadual !== "Isento" && (
                                <div style={{ fontSize: "10px", color: "#10b981", fontWeight: 600 }}>
                                  IE: {emp.inscricaoEstadual} (SEFAZ-MT)
                                </div>
                              )}
                            </div>
                            {selecionada && (
                              <span style={{ color: "#10b981", fontSize: "12px", fontWeight: 800 }}>✓</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* 2. OUTRAS EMPRESAS DA PLATAFORMA */}
                  {outrasEmpresas.length > 0 && (
                    <div>
                      <div style={{
                        padding: "6px 10px 4px",
                        fontSize: "10px",
                        fontWeight: 800,
                        color: "var(--muted)",
                        textTransform: "uppercase",
                        letterSpacing: "0.6px"
                      }}>
                        Outras Empresas
                      </div>
                      {outrasEmpresas.map((emp) => {
                        const selecionada = (empresaAtiva?.id === emp.id) || (empresaAtiva?.cnpj === emp.cnpj);
                        return (
                          <div
                            key={emp.id}
                            onClick={() => selecionarEmpresa(emp)}
                            style={{
                              padding: "8px 12px",
                              borderRadius: "8px",
                              cursor: "pointer",
                              background: selecionada ? "rgba(99, 102, 241, 0.15)" : "transparent",
                              border: selecionada ? "1px solid rgba(99, 102, 241, 0.3)" : "1px solid transparent",
                              display: "flex",
                              alignItems: "center",
                              gap: "10px",
                              marginBottom: "4px",
                              transition: "all 0.1s ease"
                            }}
                          >
                            <div style={{
                              width: "30px",
                              height: "30px",
                              borderRadius: "6px",
                              background: selecionada ? "var(--accent, #6366f1)" : "var(--card, #0f172a)",
                              color: "#ffffff",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "14px",
                              fontWeight: 700,
                              flexShrink: 0
                            }}>
                              {iconeEmpresa(emp)}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{
                                fontSize: "13px",
                                fontWeight: 700,
                                color: selecionada ? "#ffffff" : "var(--text, #f8fafc)",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis"
                              }}>
                                {emp.nome || emp.nomeFantasia || emp.razaoSocial}
                              </div>
                              {emp.cnpj && (
                                <div style={{ fontSize: "11px", color: "var(--muted, #94a3b8)" }}>
                                  CNPJ: {emp.cnpj}
                                </div>
                              )}
                            </div>
                            {selecionada && (
                              <span style={{ color: "#10b981", fontSize: "12px", fontWeight: 800 }}>✓</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              );
            })()}
          </div>

          <div style={{
            padding: "8px 12px",
            borderTop: "1px solid var(--line, #334155)",
            background: "var(--card, #0f172a)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}>
            <button
              type="button"
              onClick={() => { setAberto(false); navigate("/admin/empresas"); }}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--accent, #6366f1)",
                fontSize: "11px",
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "4px"
              }}
            >
              ⚙️ Gerenciar Empresas & Filiais
            </button>
            <span style={{ fontSize: "10px", color: "var(--muted, #94a3b8)" }}>
              Acesso Proprietário
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
