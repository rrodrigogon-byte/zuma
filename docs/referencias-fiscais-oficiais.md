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

## Atualização de XML, QR Code e Schemas — 09/08/2026

| Fonte | Achado verificado | Decisão de implementação |
|---|---|---|
| [NT 2025.001](https://www.nfe.fazenda.gov.br/portal/exibirArquivo.aspx?conteudo=trSXReoZPuY=) | A NT introduz QR Code NFC-e versão 3, com assinatura de campos específicos para contingência, e define resposta síncrona para lote de uma NF-e. | O QR Code será construído por adaptador com versão explícita por UF. A emissão unitária será preparada como síncrona; nenhum envio será realizado nesta fase. |
| [Portal DFe SVRS](https://dfe-portal.svrs.rs.gov.br/NFe/Documentos) | O pacote de schemas de NF-e/NFC-e lista a NT 2025.001 e a NT 2025.002; o portal também registra atualizações de 2026. | A versão do schema será um artefato versionado, com verificação de hash e bloqueio explícito quando o pacote oficial não estiver instalado/validado. |
| [NT 2025.001, grupo ZX](https://www.nfe.fazenda.gov.br/portal/exibirArquivo.aspx?conteudo=trSXReoZPuY=) | `infNFeSupl` inclui `qrCode` e `urlChave` para NFC-e. As regras de pagamento, cartão e PIX são validadas pela SEFAZ. | O serializador validará campos de pagamento e manterá `infNFeSupl` isolado da assinatura do XML. |

> Em 2026 há novas notas técnicas de RTC e atualizações de documentação. Portanto, o Kytto não tratará um XSD estático como definitivo: o cadastro de schemas preservará versão, origem, data e SHA-256 do pacote oficial.

[4]: https://www.nfe.fazenda.gov.br/portal/exibirArquivo.aspx?conteudo=trSXReoZPuY= "Nota Técnica 2025.001 — QR Code NFC-e versão 3 e resposta síncrona"
[5]: https://dfe-portal.svrs.rs.gov.br/NFe/Documentos "Portal DFe SVRS — Schemas, manuais e notas técnicas"

## Evidência do pacote de schemas

Em 09/08/2026 foi obtido no portal oficial DFe/SVRS o pacote `PL_010b_NT2025_002_v1.30.zip`, identificado na página como **Pacote de Liberação nº 010b v1.30**, que contempla NT 2025.002 v1.30, NT 2024.003 e NT 2025.001. O arquivo será mantido como insumo de validação local, com SHA-256 registrado na instalação do artefato.


## Contingência, eventos e DANFE — referências consultadas em 09/08/2026

| Fonte | Constatação técnica | Decisão no Kytto |
|---|---|---|
| [MOC 7.00 — Anexo III](https://www.confaz.fazenda.gov.br/legislacao/arquivo-manuais/moc7-anexo-iii-manual-contingencia-nf-e.pdf) | Para NF-e 55, as modalidades descritas incluem normal, FS-DA, SVC e EPEC. A SVC somente é utilizável quando ativada pela SEFAZ de origem; `tpEmis` deve refletir a modalidade e documentos pendentes exigem tratamento posterior. | A contingência será uma fila local auditável. O motor não ativará SVC, não alterará `tpEmis` e não transmitirá por conta própria. |
| [Portal SVRS](https://dfe-portal.svrs.rs.gov.br/Nfce/Documentos) | O portal lista MOC 7.00, manual de contingência offline para NFC-e, Manual DANFE/QR Code e, em 2026, atualizações RTC e tabela de meios de pagamento. | Todo pacote de schema e tabela de domínio exigirá versão e hash; a homologação externa será bloqueada se a versão não for aprovada. |
| [Manual DANFE NFC-e v6.0](https://www.nfe.fazenda.gov.br/portal/exibirArquivo.aspx?conteudo=k/IuuaW4YiY=) | O DANFE é representação auxiliar baseada no XML. Em contingência, deve destacar “EMITIDA EM CONTINGÊNCIA Pendente de autorização”; em homologação, deve exibir “EMITIDA EM AMBIENTE DE HOMOLOGAÇÃO – SEM VALOR FISCAL”. | A representação Kytto será marcada como **rascunho sem valor fiscal** até autorização oficial; dados exibidos serão derivados exclusivamente do XML validado. |
| [SPED/PR — Eventos NF-e](https://sped.fazenda.pr.gov.br/NFe/Pagina/Eventos-NF-e) | Eventos são documentos eletrônicos assinados. Cancelamento requer NF-e autorizada; CC-e possui limitações materiais e o arquivo/protocolo integra a NF-e. | Antes de existir integração SEFAZ, o sistema registrará somente intenções e eventos internos auditáveis, que não terão semântica de cancelamento ou CC-e autorizados. |

> O motor fiscal preservará a separação entre **evento interno**, **rascunho local validado**, **documento pendente de transmissão** e **evento autorizado pela SEFAZ**. As últimas duas categorias permanecem bloqueadas até a fase de homologação formal.

[6]: https://www.confaz.fazenda.gov.br/legislacao/arquivo-manuais/moc7-anexo-iii-manual-contingencia-nf-e.pdf "MOC 7.00 — Anexo III, Manual de Contingência NF-e"
[7]: https://dfe-portal.svrs.rs.gov.br/Nfce/Documentos "Portal SVRS — Documentos NFC-e"
[8]: https://www.nfe.fazenda.gov.br/portal/exibirArquivo.aspx?conteudo=k/IuuaW4YiY= "Manual de Padrões DANFE NFC-e e QR Code v6.0"
[9]: https://sped.fazenda.pr.gov.br/NFe/Pagina/Eventos-NF-e "SPED/PR — Eventos NF-e"
