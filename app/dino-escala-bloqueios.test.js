import test from "node:test";
import assert from "node:assert/strict";
import {
  estadoEmpresa,
  criarBloqueio,
  validarCalendarioAgendamento,
  listarHorariosDisponiveis,
  ehProfissionalDino,
} from "./barbearia-erp-kytto.js";

test("Dino Escala & Bloqueios Suite", async (t) => {
  const empresaId = "teste-escala-dino-" + Date.now();
  const estado = estadoEmpresa(empresaId);

  // Setup profissional Dino com folga segunda e terça (atende quarta a sábado: 3, 4, 5, 6)
  estado.profissionais["prof-dino"] = {
    id: "prof-dino",
    nome: "Dino",
    apelido: "Dino",
    ativo: true,
    atendimento24x7: true,
    horarioInicio: "08:00",
    horarioFim: "20:00",
    diasTrabalho: [3, 4, 5, 6], // Quarta a Sábado
  };

  // Setup profissional Bruno (atende seg a sab: 1, 2, 3, 4, 5, 6)
  estado.profissionais["prof-bruno"] = {
    id: "prof-bruno",
    nome: "Bruno",
    ativo: true,
    horarioInicio: "08:00",
    horarioFim: "20:00",
    diasTrabalho: [1, 2, 3, 4, 5, 6],
  };

  // Setup servico
  estado.servicos["srv-corte"] = {
    id: "srv-corte",
    nome: "Corte Masculino",
    duracaoMinutos: 30,
    preco: 100,
    ativo: true,
    permiteAgendamentoOnline: true,
  };

  await t.test("Dino não pode ser agendado em dia que não faz parte da sua escala (segunda-feira 2026-11-09)", () => {
    // 2026-11-09 é Segunda-feira (dia 1)
    const candidatoSegunda = {
      dataAgenda: "2026-11-09",
      horaLocal: "10:00",
      dataHora: "2026-11-09T14:00:00.000Z",
      duracaoMinutos: 30,
      servicoId: "srv-corte",
      profissionalId: "prof-dino",
    };

    assert.throws(
      () => validarCalendarioAgendamento(estado, candidatoSegunda, estado.profissionais["prof-dino"]),
      /não atende neste dia da semana/
    );
  });

  await t.test("Bruno PODE ser agendado na segunda-feira 2026-11-09 pois trabalha seg a sab", () => {
    const candidatoSegundaBruno = {
      dataAgenda: "2026-11-09",
      horaLocal: "10:00",
      dataHora: "2026-11-09T14:00:00.000Z",
      duracaoMinutos: 30,
      servicoId: "srv-corte",
      profissionalId: "prof-bruno",
    };

    assert.doesNotThrow(() => {
      validarCalendarioAgendamento(estado, candidatoSegundaBruno, estado.profissionais["prof-bruno"]);
    });
  });

  await t.test("Dino PODE ser agendado na quarta-feira 2026-11-11 pois está na sua escala (dia 3)", () => {
    // 2026-11-11 é Quarta-feira (dia 3)
    const candidatoQuartaDino = {
      dataAgenda: "2026-11-11",
      horaLocal: "10:00",
      dataHora: "2026-11-11T14:00:00.000Z",
      duracaoMinutos: 30,
      servicoId: "srv-corte",
      profissionalId: "prof-dino",
    };

    assert.doesNotThrow(() => {
      validarCalendarioAgendamento(estado, candidatoQuartaDino, estado.profissionais["prof-dino"]);
    });
  });

  await t.test("criarBloqueio detecta conflitos com agendamentos existentes no período", () => {
    // Insere um agendamento prévio para o Dino na quarta às 14h
    estado.agendamentos["ag-123"] = {
      id: "ag-123",
      clienteNome: "João Cliente",
      clienteTelefone: "65999998888",
      profissionalId: "prof-dino",
      servicoId: "srv-corte",
      dataHora: "2026-11-11T18:00:00.000Z", // 14h local Cuiabá (-04:00)
      duracaoMinutos: 45,
      horaLocal: "14:00",
      status: "agendado",
    };

    // Cria bloqueio que cobre o horário das 13h às 15h
    const resBloqueio = criarBloqueio(empresaId, {
      titulo: "Médico Dino",
      motivo: "Consulta médica",
      inicio: "2026-11-11T17:00:00.000Z",
      fim: "2026-11-11T19:00:00.000Z",
      profissionalId: "prof-dino",
    });

    assert.equal(resBloqueio.titulo, "Médico Dino");
    assert.equal(resBloqueio.conflitos.length, 1);
    assert.equal(resBloqueio.conflitos[0].clienteNome, "João Cliente");
  });
});
