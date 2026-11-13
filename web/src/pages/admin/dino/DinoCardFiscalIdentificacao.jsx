import React, { useState } from "react";
import { Link } from "react-router-dom";

export default function DinoCardFiscalIdentificacao({ empresaAtiva, configuracao }) {
  const [expandido, setExpandido] = useState(false);

  const razaoSocial = empresaAtiva?.razaoSocial || "DINO BARBEARIA LTDA";
  const nomeFantasia = empresaAtiva?.nome || empresaAtiva?.nomeFantasia || "BARBEARIA DINO";
  const cnpj = empresaAtiva?.cnpj || "50.073.355/0001-89";
  const ie = empresaAtiva?.inscricaoEstadual || "14.229.191-9";
  const im = empresaAtiva?.inscricaoMunicipal || "30297";
  const endereco = empresaAtiva?.endereco || "Rua Avelina Jaci Bohn, nº 80, Sala 01 (Setor W), Centro, Tangará da Serra/MT - CEP 78300-060";

  return (
    <div
      style={{
        background: "linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.9) 100%)",
        border: "1px solid rgba(16, 185, 129, 0.35)",
        borderRadius: "14px",
        padding: "16px 20px",
        marginBottom: "20px",
        boxShadow: "0 8px 24px -6px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(16, 185, 129, 0.15)",
        color: "#f8fafc",
        position: "relative",
        overflow: "hidden"
      }}
    >
      {/* Faixa decorativa superior com gradiente SEFAZ */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "3px",
          background: "linear-gradient(90deg, #10b981 0%, #3b82f6 50%, #f59e0b 100%)"
        }}
      />

      {/* Topo do Card com Órgãos Fiscais e Badges */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          paddingBottom: "12px",
          marginBottom: "14px"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "10px",
              background: "rgba(16, 185, 129, 0.15)",
              border: "1px solid rgba(16, 185, 129, 0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "18px",
              flexShrink: 0
            }}
          >
            🏛️
          </div>
          <div>
            <div style={{ fontSize: "11px", fontWeight: 800, color: "#10b981", textTransform: "uppercase", letterSpacing: "0.6px" }}>
              SEFAZ/MT · Secretaria de Estado de Fazenda &amp; Prefeitura de Tangará da Serra/MT
            </div>
            <div style={{ fontSize: "14px", fontWeight: 700, color: "#ffffff", display: "flex", alignItems: "center", gap: "8px" }}>
              <span>Cadastro Fiscal de Contribuinte · Regular &amp; Homologado</span>
              <span style={{ fontSize: "10px", background: "#10b981", color: "#064e3b", padding: "1px 7px", borderRadius: "4px", fontWeight: 800 }}>
                ATIVO · PRODUÇÃO
              </span>
            </div>
          </div>
        </div>

        {/* Badges de Status Fiscal Sincronizado */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "5px", padding: "4px 8px", background: "rgba(16, 185, 129, 0.12)", border: "1px solid rgba(16, 185, 129, 0.3)", borderRadius: "6px", fontSize: "11px", color: "#34d399", fontWeight: 700 }}>
            <span>●</span> SEFAZ-MT Habilitada
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "5px", padding: "4px 8px", background: "rgba(59, 130, 246, 0.12)", border: "1px solid rgba(59, 130, 246, 0.3)", borderRadius: "6px", fontSize: "11px", color: "#60a5fa", fontWeight: 700 }}>
            <span>🔒</span> Certificado A1 Válido (2027)
          </div>
          <button
            type="button"
            onClick={() => setExpandido(!expandido)}
            style={{
              background: "rgba(255, 255, 255, 0.08)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              color: "#e2e8f0",
              borderRadius: "6px",
              padding: "4px 10px",
              fontSize: "11px",
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px"
            }}
          >
            {expandido ? "Ocultar Detalhes ▲" : "Ver Detalhes Fiscais ▼"}
          </button>
        </div>
      </div>

      {/* Grid com as 3 Inscrições Canônicas (CNPJ, IE, IM) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "12px",
          marginBottom: expandido ? "14px" : "10px"
        }}
      >
        {/* CNPJ */}
        <div
          style={{
            background: "rgba(15, 23, 42, 0.6)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: "10px",
            padding: "10px 14px"
          }}
        >
          <div style={{ fontSize: "10px", fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            CNPJ Matriz (Receita Federal)
          </div>
          <div style={{ fontSize: "16px", fontWeight: 800, color: "#ffffff", fontFamily: "monospace", letterSpacing: "0.5px", marginTop: "2px" }}>
            {cnpj}
          </div>
          <div style={{ fontSize: "10px", color: "#10b981", fontWeight: 700, marginTop: "2px" }}>
            ✓ Situação Cadastral: ATIVA
          </div>
        </div>

        {/* Inscrição Estadual (SEFAZ-MT) */}
        <div
          style={{
            background: "rgba(15, 23, 42, 0.6)",
            border: "1px solid rgba(16, 185, 129, 0.25)",
            borderRadius: "10px",
            padding: "10px 14px"
          }}
        >
          <div style={{ fontSize: "10px", fontWeight: 800, color: "#34d399", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Inscrição Estadual (SEFAZ/MT)
          </div>
          <div style={{ fontSize: "16px", fontWeight: 800, color: "#34d399", fontFamily: "monospace", letterSpacing: "0.5px", marginTop: "2px" }}>
            {ie}
          </div>
          <div style={{ fontSize: "10px", color: "#6ee7b7", fontWeight: 700, marginTop: "2px" }}>
            ✓ CCE Ativo · Habilitado NFC-e &amp; NF-e
          </div>
        </div>

        {/* Inscrição Municipal (Tangará da Serra) */}
        <div
          style={{
            background: "rgba(15, 23, 42, 0.6)",
            border: "1px solid rgba(56, 189, 248, 0.25)",
            borderRadius: "10px",
            padding: "10px 14px"
          }}
        >
          <div style={{ fontSize: "10px", fontWeight: 800, color: "#38bdf8", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Inscrição Municipal (Pref. Tangará da Serra)
          </div>
          <div style={{ fontSize: "16px", fontWeight: 800, color: "#38bdf8", fontFamily: "monospace", letterSpacing: "0.5px", marginTop: "2px" }}>
            {im}
          </div>
          <div style={{ fontSize: "10px", color: "#7dd3fc", fontWeight: 700, marginTop: "2px" }}>
            ✓ Cód. Município IBGE: 5107958 · NFS-e ISSQN
          </div>
        </div>

        {/* Razão Social e Nome Fantasia */}
        <div
          style={{
            background: "rgba(15, 23, 42, 0.6)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: "10px",
            padding: "10px 14px"
          }}
        >
          <div style={{ fontSize: "10px", fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Razão Social &amp; Nome Fantasia
          </div>
          <div style={{ fontSize: "14px", fontWeight: 700, color: "#ffffff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: "2px" }}>
            {razaoSocial}
          </div>
          <div style={{ fontSize: "11px", color: "#cbd5e1", marginTop: "2px" }}>
            Fantasia: <strong style={{ color: "#f8fafc" }}>{nomeFantasia}</strong>
          </div>
        </div>
      </div>

      {/* Painel Expandido com Detalhamento Tributário e Endereço */}
      {expandido && (
        <div
          style={{
            background: "rgba(15, 23, 42, 0.8)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: "10px",
            padding: "14px 16px",
            marginBottom: "14px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "14px",
            fontSize: "12px",
            animation: "fadeIn 0.15s ease"
          }}
        >
          <div>
            <div style={{ fontSize: "10px", fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", marginBottom: "4px" }}>
              Enquadramento Tributário &amp; Natureza Jurídica
            </div>
            <div style={{ color: "#f8fafc", fontWeight: 600 }}>
              Simples Nacional (CRT 1) · Sociedade Empresária Limitada (2062)
            </div>
            <div style={{ color: "#10b981", fontSize: "11px", marginTop: "4px", lineHeight: "1.4" }}>
              ✓ Optante pelo Simples Nacional: <strong>SIM</strong><br />
              ✓ Microempreendedor Individual (MEI): <strong>NÃO</strong><br />
              ✓ Regime Especial de Tributação: <strong>Padrão</strong>
            </div>
          </div>

          <div>
            <div style={{ fontSize: "10px", fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", marginBottom: "4px" }}>
              Atividades Econômicas (CNAE)
            </div>
            <div style={{ color: "#ffffff", fontWeight: 600 }}>
              • 9602-5/01 · Cabeleireiros, manicure e pedicure (Principal)
            </div>
            <div style={{ color: "#cbd5e1", fontSize: "11px", marginTop: "3px", lineHeight: "1.4" }}>
              • 4772-5/00 · Comércio varejista de cosméticos e perfumaria<br />
              • 4763-6/01 · Comércio varejista de artigos recreativos
            </div>
          </div>

          <div>
            <div style={{ fontSize: "10px", fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", marginBottom: "4px" }}>
              Endereço Fiscal &amp; Operacional
            </div>
            <div style={{ color: "#f8fafc", lineHeight: "1.4" }}>
              {endereco}
            </div>
            <div style={{ color: "#94a3b8", fontSize: "11px", marginTop: "4px" }}>
              📞 (65) 9672-2055 / (65) 99905-6008 · ✉️ guicunha136@gmail.com
            </div>
          </div>
        </div>
      )}

      {/* Barra de Ações Fiscais Rápidas */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "10px",
          paddingTop: "6px"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "#94a3b8" }}>
          <span>ℹ️</span> Todas as notas fiscais (NFC-e e NFS-e) emitidas na comanda utilizam automaticamente estes dados fiscais auditados.
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <Link
            to="/admin/fiscal/config"
            style={{
              padding: "5px 12px",
              borderRadius: "6px",
              background: "rgba(16, 185, 129, 0.15)",
              border: "1px solid rgba(16, 185, 129, 0.3)",
              color: "#34d399",
              fontSize: "11px",
              fontWeight: 700,
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: "5px"
            }}
          >
            <span>⚙️</span> Configuração Fiscal SEFAZ-MT
          </Link>

          <Link
            to="/admin/notas"
            style={{
              padding: "5px 12px",
              borderRadius: "6px",
              background: "rgba(59, 130, 246, 0.15)",
              border: "1px solid rgba(59, 130, 246, 0.3)",
              color: "#60a5fa",
              fontSize: "11px",
              fontWeight: 700,
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: "5px"
            }}
          >
            <span>🧾</span> Notas Emitidas (NFC-e)
          </Link>

          <Link
            to="/admin/fiscal/classificacao"
            style={{
              padding: "5px 12px",
              borderRadius: "6px",
              background: "rgba(255, 255, 255, 0.08)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              color: "#e2e8f0",
              fontSize: "11px",
              fontWeight: 700,
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: "5px"
            }}
          >
            <span>🏷️</span> Classificação NCM/CEST
          </Link>

          <Link
            to="/admin/cadastros-mestres"
            style={{
              padding: "5px 12px",
              borderRadius: "6px",
              background: "rgba(255, 255, 255, 0.08)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              color: "#e2e8f0",
              fontSize: "11px",
              fontWeight: 700,
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: "5px"
            }}
          >
            <span>🏢</span> Cadastros Mestres
          </Link>
        </div>
      </div>
    </div>
  );
}
