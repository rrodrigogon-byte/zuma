# Notas visuais — logo Dino

A captura fornecida mostra o painel administrativo do Kytto com o logo Dino no cabeçalho do menu lateral, sobre fundo azul muito claro, dentro de um cartão arredondado. O asset antigo `web/public/brand/dino-logo.png` tinha 760×512 px, fundo transparente e um wordmark escuro com contraste baixo; em tamanho de sidebar, o subtítulo ficava pouco legível.

Foi gerado um novo lockup horizontal `web/public/brand/dino-logo-horizontal.png` em 2304×1536 px, com marca original em azul-marinho, dourado champanhe e detalhe lavanda, contendo “Dino” e “PERFUMARIA”.

Também foi gerado um emblema compacto para o menu. O gerador entregou um padrão quadriculado em RGB; uma operação determinística removeu o padrão externo e gerou `web/public/brand/dino-logo.png` em 1920×1920 px, RGBA, com transparência real. O emblema combina lâmina/razor, curva de cabelo e forma sutil de D, adequado para tamanhos pequenos.

O componente `web/src/components/Sidebar.jsx` usa `/brand/dino-logo.png` na classe `sidebar-brand-dino`. O storefront `web/src/pages/public/Ecommerce.jsx` também usa esse caminho no brandbar; ele será ajustado para usar o lockup horizontal, enquanto a Sidebar continuará usando o emblema compacto.
