import test from "node:test";
import assert from "node:assert/strict";
import {
  learnFromSingleSession,
  currentDay,
  dayString,
} from "./core/ai-learning.js";
import {
  memoryPhone,
  isSensitiveFact,
  normalizeFact,
  initialFactStatus,
  FACT_CATEGORIES,
} from "./core/ai-memory.js";

test("Cérebro KyttoIA: funções de aprendizado e memória", async (t) => {
  await t.test("currentDay e dayString retornam datas no fuso correto (YYYY-MM-DD)", () => {
    const hoje = currentDay();
    assert.match(hoje, /^\d{4}-\d{2}-\d{2}$/);
    const custom = dayString(new Date("2026-11-20T12:00:00Z"));
    assert.match(custom, /^\d{4}-\d{2}-\d{2}$/);
  });

  await t.test("memoryPhone normaliza telefones brasileiros", () => {
    assert.equal(memoryPhone("5565999887766"), "5565999887766");
    assert.equal(memoryPhone("65999887766"), "5565999887766");
    assert.equal(memoryPhone("+55 (65) 99988-7766"), "5565999887766");
  });

  await t.test("isSensitiveFact detecta dados sensíveis LGPD para descarte", () => {
    assert.equal(isSensitiveFact("Cliente mencionou que tem dívida e serasa"), true);
    assert.equal(isSensitiveFact("Prefere corte degradê na zero"), false);
  });

  await t.test("normalizeFact sanitiza chaves e categorias válidas", () => {
    const norm = normalizeFact({
      categoria: "estilo",
      chave: "estilo preferido",
      valor: "Degradê navalhado",
      confianca: 0.95,
    });
    assert.ok(norm);
    assert.equal(norm.categoria, "estilo");
    assert.equal(norm.chave, "estilo_preferido");
    assert.equal(norm.valor, "Degradê navalhado");
  });

  await t.test("initialFactStatus respeita autonomia e confiança", () => {
    assert.equal(initialFactStatus(0.9, 1), "ativo");
    assert.equal(initialFactStatus(0.7, 1), "proposto");
    assert.equal(initialFactStatus(0.95, 0), "proposto");
  });

  await t.test("learnFromSingleSession ignora conversas vazias com segurança", async () => {
    const result = await learnFromSingleSession("5565999887766", []);
    assert.equal(result, null);
  });
});
