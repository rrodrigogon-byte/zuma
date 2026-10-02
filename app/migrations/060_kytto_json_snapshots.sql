-- Cópias do banco JSON legado (agenda, clientes, comandas, clube, cobranças da
-- barbearia) guardadas fora do disco do servidor. Cada cópia é o arquivo inteiro,
-- comprimido (gzip), com o hash SHA-256 do conteúdo original e a marca de que a
-- restauração foi conferida (descomprimir + ler o JSON + bater o hash).
CREATE TABLE IF NOT EXISTS kytto_json_snapshots (
  id BIGSERIAL PRIMARY KEY,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  tipo TEXT NOT NULL CHECK (tipo IN ('horario', 'diario', 'manual')),
  dia_local DATE NOT NULL,
  bytes_original BIGINT NOT NULL CHECK (bytes_original >= 0),
  bytes_gzip BIGINT NOT NULL CHECK (bytes_gzip >= 0),
  sha256 TEXT NOT NULL,
  origem TEXT NOT NULL DEFAULT '',
  verificado_em TIMESTAMPTZ,
  conteudo BYTEA NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_kytto_json_snapshots_tipo ON kytto_json_snapshots (tipo, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_kytto_json_snapshots_dia ON kytto_json_snapshots (dia_local, tipo);
