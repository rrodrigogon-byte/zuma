# Referências Oficiais — Motor Fiscal Kytto

**Coleta**: 09 de agosto de 2026  
**Finalidade**: orientar o domínio fiscal, a camada de XML e o adaptador SEFAZ sem codificar regras obsoletas.

| Fonte | Constatação técnica relevante | Uso no Kytto |
|---|---|---|
| [MOC 7.00 — Portal NF-e](https://www.nfe.fazenda.gov.br/portal/exibirArquivo.aspx?conteudo=LrBx7WT9PuA=) | O MOC contempla NF-e 55 e NFC-e 65, chave de acesso, contingência, assinatura, comunicação, validação de schemas e serviços de autorização. | Contratos do domínio fiscal, chave 44 dígitos, interfaces de assinatura/XML/transporte. |
| [Portal DFe — SVRS](https://dfe-portal.svrs.rs.gov.br/NFe/Documentos) | Publica schemas e notas técnicas; em 2026 há atualizações de RTC, meios de pagamento e alterações de DANFE/contingência. | O motor deve carregar versões de schema por tabela, não hardcodar uma estrutura eterna. |
| [SEFAZ-MT NFC-e](https://www.sefaz.mt.gov.br/portal/nfce/?pg=cGdJbmZvcm1hY2Fv) | Informa endpoints de homologação e produção 4.00 para autorização, retorno, inutilização, consulta, status e recepção de eventos. | Dados iniciais do adaptador MT, mantidos fora do domínio tributário e versionados por UF/ambiente. |

## Diretrizes absorvidas

1. O layout-base da NF-e/NFC-e permanece na família 4.00, mas a versão operacional do schema e as notas técnicas precisam ser monitoradas e versionadas.
2. O cálculo tributário deve ser separado da geração de XML, para permitir alterações regulatórias sem afetar PDV, estoque ou financeiro.
3. A configuração de endpoints deve ser orientada por UF, ambiente e serviço; a primeira implantação será MT, com estrutura pronta para expansão.
4. Nenhum documento será enviado para a SEFAZ durante desenvolvimento ou testes locais; somente rascunhos e cálculos serão criados.

> A parametrização de NCM, CFOP, CST/CSOSN, alíquotas e cenários especiais requer revisão do contador responsável antes de homologação ou produção.

## Fontes

[1]: https://www.nfe.fazenda.gov.br/portal/exibirArquivo.aspx?conteudo=LrBx7WT9PuA= "Manual de Orientação do Contribuinte — MOC 7.00"
[2]: https://dfe-portal.svrs.rs.gov.br/NFe/Documentos "Portal DFe da SEFAZ Virtual do Rio Grande do Sul — Documentos"
[3]: https://www.sefaz.mt.gov.br/portal/nfce/?pg=cGdJbmZvcm1hY2Fv "SEFAZ-MT — NFC-e: endereços de Web Service"
