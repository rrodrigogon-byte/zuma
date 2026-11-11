# Dependências auditadas

## SheetJS Community Edition

- Versão `0.20.3`, licença Apache-2.0, verificada no arquivo `LICENSE` do pacote oficial em 11/11/2026.
- Usada para gerar planilhas da DRE. Os dois manifestos apontam para a mesma versão e os arquivos de trava conferem a integridade SHA-512.
- A versão anterior `0.18.5` está nos intervalos afetados pelos avisos CVE-2023-30533 e CVE-2024-22363. A `0.20.3` está acima dos intervalos afetados documentados.
- A instalação limpa do servidor e a exportação de uma DRE local com reabertura da planilha passaram.

[Distribuição e versão oficiais](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/) · [CVE-2023-30533](https://github.com/advisories/GHSA-4r6h-8v6p-xvw6) · [CVE-2024-22363](https://github.com/advisories/GHSA-5pgg-2g8v-p4x9)
