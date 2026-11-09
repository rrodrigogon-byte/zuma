# Guia Oficial de Arquitetura & Implantação On-Premise (Sovereign Edition)

**ERP Kytto Enterprise — Arquitetura Híbrida (SaaS & On-Premise)**  
**Versão:** 2026.11-Sovereign  
**Compatibilidade:** Linux Ubuntu 22.04/24.04 LTS, Debian 12, Rocky Linux 9, RHEL 9  
**Status de Homologação:** Produção Estável  

---

## 1. Visão Geral da Arquitetura Soberana

O **ERP Kytto** foi concebido sob o paradigma de **Soberania Operacional e Tecnológica (Sovereign Deploy)**. Isto permite que a plataforma opere tanto como um SaaS Multi-Tenant gerenciado em nuvem quanto em datacenters locais proprietários (On-Premise), garantindo:

1. **Conformidade Total LGPD & Sigilo Industrial:** Todos os registros contábeis, transações de clientes, notas fiscais e dados de equipes permanecem fisicamente confinados na infraestrutura do cliente.
2. **Resiliência Offline-First:** A operação de balcão (PDV), comandas de serviços e agendamentos locais continuam operando mesmo em contingência de link de internet externo.
3. **Gateway WhatsApp Integrado (WAHA):** Conexão direta com instâncias de WhatsApp no próprio servidor local, eliminando custos de terceiros e dependências de nuvens externas.
4. **Isolamento Criptográfico de Licença:** Verificação digital através de chave assinada (`KYTTO-LIC`), regulando cotas de canais, filiais, usuários e módulos ativos.

---

## 2. Requisitos Mínimos de Servidor (Hardware & SO)

| Componente | Requisito Mínimo (Até 5 Filiais) | Recomendado Enterprise (Até 25 Filiais) |
| :--- | :--- | :--- |
| **CPU** | 4 núcleos vCPU (x86_64) | 8 núcleos vCPU |
| **Memória RAM** | 8 GB RAM | 16 GB a 32 GB RAM |
| **Armazenamento** | 50 GB SSD / NVMe | 200 GB SSD NVMe (RAID 1) |
| **Sistema Operacional** | Ubuntu Server 22.04 LTS | Ubuntu Server 24.04 LTS |
| **Portas de Rede** | `8080/tcp` (Web/API), `3008/tcp` (WAHA) | `80/tcp`, `443/tcp` (com Nginx Reverse Proxy) |

---

## 3. Instalação Rápida Automatizada (1 Comando)

Em qualquer servidor Linux recém-provisionado, execute com privilégios de superusuário:

```bash
curl -fsSL https://kytto.com.br/install.sh | sudo bash
```

Ou execute diretamente a partir do repositório clonado:

```bash
sudo bash bin/kytto-install-onpremise.sh
```

O instalador executa automaticamente:
- Validação e instalação do Docker Engine e plugin Docker Compose;
- Criação dos volumes persistentes (`kytto-pgdata`, `kytto-redisdata`, `kytto-wahadata`, `kytto-backups`);
- Inicialização dos contêineres PostgreSQL 15, Redis 7, WAHA WhatsApp Gateway e Kytto ERP;
- Aplicação das migrações de banco e provisionamento do tenant inicial;
- Ativação do cron de backups diários automáticos com retenção de 30 dias.

---

## 4. Estrutura do Docker Compose On-Premise

O arquivo `docker-compose.onpremise.yml` gerencia a stack completa:

```yaml
version: '3.8'

services:
  kytto-db:
    image: postgres:15-alpine
    container_name: kytto-sovereign-db
    restart: always
    volumes:
      - kytto-pgdata:/var/lib/postgresql/data
      - ./app/migrations:/docker-entrypoint-initdb.d:ro

  kytto-redis:
    image: redis:7-alpine
    container_name: kytto-sovereign-redis
    restart: always

  kytto-waha:
    image: devlikeapro/waha:latest
    container_name: kytto-sovereign-waha
    restart: always

  kytto-erp:
    build: .
    container_name: kytto-sovereign-app
    restart: always
    ports:
      - "8080:8080"
    environment:
      KYTTO_DEPLOYMENT_MODE: on-premise
      DATABASE_URL: postgres://kytto_admin:senha@kytto-db:5432/kytto_enterprise

  kytto-backup:
    image: postgres:15-alpine
    container_name: kytto-sovereign-backup
    restart: always
    volumes:
      - kytto-backups:/backups
```

---

## 5. Licenciamento e Gestão de Cotas

Para ativar ou alterar limites de filiais e canais, utilize o endpoint `/api/admin/licenciamento/ativar` ou o painel web `/admin/licenciamento`.

### Formato da Chave de Licença:
```text
KYTTO-LIC.<payload_base64_assinado>.<hash_sha256_verificador>
```

A chave armazena de forma imutável:
- **`maxInstanciasWhatsapp`**: Número de conexões WhatsApp autorizadas;
- **`maxLojasUnidades`**: Número de filiais ou unidades conectadas;
- **`maxTerminaisPdv`**: Número de caixas/PDVs operando simultaneamente;
- **`modulosAtivos`**: Array com os recursos desbloqueados (`fiscal_completo`, `dre_financeiro`, `ia_advisor`, etc.).

---

## 6. Rotinas de Backup & Recuperação de Desastres

Os backups são gerados automaticamente a cada 24 horas no formato compactado do PostgreSQL (`pg_dump -Fc`):
- **Localização dos Dumps:** Volume Docker `kytto-backups` (`/var/lib/docker/volumes/kytto-backups/_data`);
- **Política de Retenção:** 30 dias contínuos;
- **Restauração em 1 Linha:**
  ```bash
  docker exec -i kytto-sovereign-db pg_restore -U kytto_admin -d kytto_enterprise --clean < backup.dump
  ```
