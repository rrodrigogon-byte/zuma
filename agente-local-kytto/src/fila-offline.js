import fs from 'fs/promises';
import path from 'path';

export class FilaOfflineDuravel {
  constructor(arquivo) {
    this.arquivo = arquivo;
    this.eventos = [];
    this.carregada = false;
  }

  async carregar() {
    if (this.carregada) return this.eventos;
    try {
      const texto = await fs.readFile(this.arquivo, 'utf8');
      const dados = JSON.parse(texto);
      this.eventos = Array.isArray(dados.eventos) ? dados.eventos : [];
    } catch (erro) {
      if (erro.code !== 'ENOENT') throw erro;
      this.eventos = [];
    }
    this.carregada = true;
    return this.eventos;
  }

  async salvar() {
    await fs.mkdir(path.dirname(this.arquivo), { recursive: true });
    const temporario = `${this.arquivo}.tmp`;
    const conteudo = JSON.stringify({ versao: 1, atualizado_em: new Date().toISOString(), eventos: this.eventos }, null, 2);
    await fs.writeFile(temporario, conteudo, { mode: 0o600 });
    await fs.rename(temporario, this.arquivo);
  }

  async adicionar(eventos) {
    await this.carregar();
    const existentes = new Set(this.eventos.map((evento) => evento.id));
    const aceitos = [];
    for (const evento of eventos) {
      if (!evento?.id || existentes.has(evento.id)) {
        if (evento?.id) aceitos.push(evento.id);
        continue;
      }
      this.eventos.push({ ...evento, recebido_pelo_agente_em: new Date().toISOString(), tentativas_agente: 0 });
      existentes.add(evento.id);
      aceitos.push(evento.id);
    }
    this.eventos.sort((a, b) => Number(a.sequencia || 0) - Number(b.sequencia || 0));
    await this.salvar();
    return aceitos;
  }

  async pendentes(limite = 100) {
    await this.carregar();
    return this.eventos.filter((evento) => !evento.bloqueado).slice(0, limite);
  }

  async registrarResultado(resultados = []) {
    await this.carregar();
    const porId = new Map(resultados.map((resultado) => [resultado.id, resultado]));
    const mantidos = [];
    for (const evento of this.eventos) {
      const resultado = porId.get(evento.id);
      if (!resultado) {
        mantidos.push(evento);
        continue;
      }
      if (['processado', 'conflito'].includes(resultado.status)) continue;
      const proximaTentativa = Number(evento.tentativas_agente || 0) + 1;
      // Erros de validação ou autorização são preservados para investigação,
      // mas bloqueados para não gerar reenvio contínuo da mesma operação.
      mantidos.push({
        ...evento,
        tentativas_agente: proximaTentativa,
        ultimo_erro: resultado.resultado?.erro || 'Falha de sincronização',
        bloqueado: proximaTentativa >= 3 || Boolean(resultado.bloqueado),
        atualizado_em: new Date().toISOString(),
      });
    }
    this.eventos = mantidos;
    await this.salvar();
  }

  async resumo() {
    await this.carregar();
    return this.eventos.reduce((resumo, evento) => {
      resumo.total += 1;
      if (evento.bloqueado) resumo.bloqueados += 1;
      else resumo.pendentes += 1;
      return resumo;
    }, { total: 0, pendentes: 0, bloqueados: 0 });
  }
}
