#!/usr/bin/env python3
"""
Sincronizador e enriquecedor oficial do cardápio Zuma Cozinha Oriental
Extrai 100% dos dados reais de https://zumacozinhaoriental.com.br/loja/pedidos
e atualiza:
1. app/public/zuma/cardapio-real-zuma.json
2. app/zuma-cozinha-oriental-seed.js
3. app/public/zuma/index.html (PWA cliente)
"""
import json
import os
import re

RAW_DATA_PATH = '/tmp/zuma_initial_data.json'
REPO_ROOT = '/home/ubuntu/zuma-repo'
JSON_OUT_PATH = os.path.join(REPO_ROOT, 'app/public/zuma/cardapio-real-zuma.json')
SEED_PATH = os.path.join(REPO_ROOT, 'app/zuma-cozinha-oriental-seed.js')
INDEX_HTML_PATH = os.path.join(REPO_ROOT, 'app/public/zuma/index.html')

with open(RAW_DATA_PATH, 'r', encoding='utf-8') as f:
    live = json.load(f)

# Setores conhecidos por categoria
setores_map = {
    '57302': 'sushi_bar',
    '25994': 'balcao',
    '21728': 'balcao',
    '17077': 'sushi_bar',
    '144213': 'sushi_bar',
    '17087': 'sushi_bar',
    '17078': 'sushi_bar',
    '17079': 'sushi_bar',
    '17080': 'sushi_bar',
    '17094': 'sushi_bar',
    '17088': 'sushi_bar',
    '17091': 'sushi_bar',
    '17095': 'sushi_bar',
    '17082': 'sushi_bar',
    '31942': 'sushi_bar',
    '17090': 'cozinha',
    '17084': 'cozinha',
    '17083': 'cozinha',
    '17092': 'cozinha',
    '17093': 'cozinha',
    '17085': 'cozinha',
    '17086': 'cozinha',
    '17089': 'bar'
}

icones_map = {
    '57302': '🏷️',
    '25994': '➕',
    '21728': '🥢',
    '17077': '🥟',
    '144213': '🌯',
    '17087': '🍱',
    '17078': '🍙',
    '17079': '🍣',
    '17080': '🐟',
    '17094': '🔥',
    '17088': '🎯',
    '17091': '🍤',
    '17095': '🥗',
    '17082': '🌯',
    '31942': '🌭',
    '17090': '♨️',
    '17084': '🍜',
    '17083': '🍳',
    '17092': '🥢',
    '17093': '🍚',
    '17085': '🍟',
    '17086': '🍨',
    '17089': '🍶'
}

def slugify(text):
    text = text.lower()
    text = re.sub(r'[àáâãä]', 'a', text)
    text = re.sub(r'[èéêë]', 'e', text)
    text = re.sub(r'[ìíîï]', 'i', text)
    text = re.sub(r'[òóôõö]', 'o', text)
    text = re.sub(r'[ùúûü]', 'u', text)
    text = re.sub(r'[ç]', 'c', text)
    text = re.sub(r'[^a-z0-9]+', '-', text)
    return text.strip('-')

BANNER_PADRAO = 'https://alloydeliveryimages.ligafiles.com.br/loja_images/4212/69b490b2917fe4lx5c.webp'
BANNER_MOBILE = 'https://alloydeliveryimages.ligafiles.com.br/loja_images/4212/69b47c817ffa1pzzkt.webp'
LOGO_PADRAO = 'https://cdnimages.ligafiles.com.br/preset=logo_square_400/empresa_images/4304/6abafc96a35a9e82qq.webp'

live_cats = live.get('catalogo', {}).get('categorias', {})
destaques_live = live.get('catalogo', {}).get('destaques', {})
sugestoes_itens_ids = set()
sugestoes_capa = None
if 'sugestao_da_casa' in destaques_live:
    sugestoes_itens_ids = set(destaques_live['sugestao_da_casa'].get('itens', []))
    sugestoes_capa = (destaques_live['sugestao_da_casa'].get('capa') or {}).get('default')

categorias_out = []
produtos_out = []

for cat_id_str, cat in sorted(live_cats.items(), key=lambda x: x[1].get('ordem', 0)):
    cat_id = str(cat.get('id', cat_id_str))
    nome_cat = cat.get('nome', '').strip()
    slug_cat = slugify(nome_cat)
    ordem_cat = cat.get('ordem', 99)
    icone_cat = icones_map.get(cat_id, '🥢')
    setor_cat = setores_map.get(cat_id, 'sushi_bar')
    capa_cat = (cat.get('capa') or {}).get('default')
    
    itens = cat.get('itens', {})
    if isinstance(itens, dict):
        itens = list(itens.values())
        
    categorias_out.append({
        'id': cat_id,
        'codigo': slug_cat,
        'nome': f'{icone_cat} {nome_cat}',
        'nome_puro': nome_cat,
        'slug': slug_cat,
        'ordem': ordem_cat,
        'icone': icone_cat,
        'setor': setor_cat,
        'capa_url': capa_cat,
        'totalItens': len(itens),
        'total_itens': len(itens)
    })
    
    for it in itens:
        p_id = it.get('id')
        p_nome = it.get('nome', '').strip()
        p_slug = slugify(f'{p_nome}-{p_id}')
        p_desc = it.get('descricao', '').strip()
        p_preco = float(it.get('preco') or 0.0)
        p_preco_promo = float(it.get('preco_promocional') or 0.0)
        p_em_promo = (p_preco_promo > 0 and p_preco_promo < p_preco)
        
        foto_princ = it.get('foto_principal')
        foto_thumb = it.get('foto_thumbnail')
        fotos_arr = it.get('fotos') or []
        tem_foto = bool(foto_princ or len(fotos_arr) > 0)
        
        foto_final = foto_princ or (fotos_arr[0].get('url') if fotos_arr else None) or capa_cat or BANNER_PADRAO
        foto_thumb_final = foto_thumb or foto_final
        
        # Formatar complementos
        comps_raw = it.get('categorias_complementos', {})
        comps_formatados = []
        if isinstance(comps_raw, dict):
            for gid, grp in comps_raw.items():
                c_list = grp.get('complementos', {})
                if isinstance(c_list, dict):
                    c_list = list(c_list.values())
                comps_formatados.append({
                    'id': grp.get('id'),
                    'nome': grp.get('nome'),
                    'obrigatorio': bool(grp.get('obrigatorio')),
                    'qtd_minima': grp.get('qtd_minima', 0),
                    'qtd_maxima': grp.get('qtd_maxima', 0),
                    'tipo_calculo': grp.get('tipo_calculo', 'soma'),
                    'opcoes': [
                        {
                            'id': op.get('id'),
                            'nome': op.get('nome'),
                            'descricao': op.get('descricao', ''),
                            'preco': float(op.get('preco') or 0.0),
                            'status': op.get('status', 'disponivel'),
                            'disponivel': op.get('status') == 'disponivel',
                            'ordem': op.get('ordem', 0)
                        }
                        for op in c_list
                    ]
                })
        
        is_destaque = (p_id in sugestoes_itens_ids)
        
        prod_obj = {
            'id': p_id,
            'id_str': str(p_id),
            'codigo_pdv': it.get('cod_pdv') or f'ZUM-{p_id}',
            'cod_pdv': it.get('cod_pdv') or f'ZUM-{p_id}',
            'nome': p_nome,
            'slug': p_slug,
            'descricao': p_desc,
            'preco': p_preco,
            'preco_promocional': p_preco_promo,
            'em_promocao': p_em_promo,
            'categoria': nome_cat,
            'categoria_id': cat_id,
            'categoria_codigo': slug_cat,
            'categoria_slug': slug_cat,
            'categoria_ordem': ordem_cat,
            'setor': setor_cat,
            'setor_producao': setor_cat,
            'foto': foto_final,
            'foto_url': foto_final,
            'foto_principal': foto_princ,
            'foto_thumbnail': foto_thumb_final,
            'fotos': fotos_arr,
            'tem_foto_propria': tem_foto,
            'status': it.get('status', 'disponivel'),
            'disponivel': it.get('status') == 'disponivel',
            'ordem': it.get('ordem', 99),
            'unidade': it.get('unidade', 'unidade'),
            'carrinho_quick_add': bool(it.get('carrinho_quick_add', False)),
            'destaque': is_destaque,
            'categorias_complementos': comps_formatados
        }
        produtos_out.append(prod_obj)

# Carregar arquivo JSON existente para preservar mesas e CRM
with open(JSON_OUT_PATH, 'r', encoding='utf-8') as f:
    existing_json = json.load(f)

mesas = existing_json.get('mesas', [])
crm_vip = existing_json.get('crmVip', {})

full_catalog = {
    'empresa': {
        'id': 'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
        'lojaId': 'c3c3ac01-8e50-4b61-8c79-de4aaa916da0',
        'nome': 'Zuma Cozinha Oriental',
        'nomeFantasia': 'Zuma Cozinha Oriental',
        'razaoSocial': 'Zuma Cozinha Oriental LTDA',
        'cnpj': '36.296.848/0001-57',
        'cnpjNormalizado': '36296848000157',
        'inscricaoEstadual': '13.882.109-8',
        'inscricaoMunicipal': '94820',
        'tipoNegocio': 'restaurante',
        'segmento': 'alimentacao',
        'subsegmento': 'gastronomia_oriental_sushi',
        'grupoId': None,
        'grupoNome': 'Grupo Zuma Cozinha Oriental',
        'telefone': '(65) 99800-1447',
        'whatsapp': '(65) 99800-1447',
        'whatsappNumero': '5565998001447',
        'instagram': '@zuma_orientaltga',
        'instagramUrl': 'https://www.instagram.com/zuma_orientaltga/',
        'email': 'contato@zumacozinhaoriental.com.br',
        'website': 'https://zuma.kytto.com.br',
        'urlPedidosOriginal': 'https://zumacozinhaoriental.com.br/loja/pedidos',
        'enderecoLogradouro': 'Av. Brasil',
        'enderecoNumero': '1605',
        'enderecoComplemento': 'S',
        'enderecoBairro': 'Jardim Cidade Alta',
        'enderecoCidade': 'Tangará da Serra',
        'enderecoEstado': 'MT',
        'enderecoCep': '78300000',
        'coordenadas': {
            'latitude': -14.6288865,
            'longitude': -57.4991921
        },
        'horarioFuncionamento': 'Terça a Quinta das 18:00 às 22:40 | Sexta a Domingo das 18:00 às 22:45 (Segunda-feira fechado)',
        'tempoPreparoMedioMinutos': 40,
        'taxaEntregaPadrao': 12.00,
        'avaliacaoNota': '4.9 ★',
        'avaliacaoDestaque': 'Melhor cozinha oriental e sushi contemporâneo de Tangará da Serra',
        'logoUrl': LOGO_PADRAO,
        'bannerDesktop': BANNER_PADRAO,
        'bannerMobile': BANNER_MOBILE,
        'ativa': True
    },
    'banners': {
        'desktop': BANNER_PADRAO,
        'mobile': BANNER_MOBILE
    },
    'destaques': {
        'sugestao_da_casa': {
            'id': 'categoria-destaque-sugestoes-da-casa',
            'nome': 'Sugestões da Casa',
            'capa': sugestoes_capa or BANNER_PADRAO,
            'itens': list(sugestoes_itens_ids)
        }
    },
    'totalProdutos': len(produtos_out),
    'totalCategorias': len(categorias_out),
    'totalFotosReais': sum(1 for p in produtos_out if p['tem_foto_propria']),
    'categorias': categorias_out,
    'produtos': produtos_out,
    'mesas': mesas,
    'crmVip': crm_vip,
    'versao': '2026.11-official-live-sync'
}

# 1. Salvar JSON oficial enriquecido
with open(JSON_OUT_PATH, 'w', encoding='utf-8') as f:
    json.dump(full_catalog, f, ensure_ascii=False, indent=2)

print(f'✅ Salvo {JSON_OUT_PATH}: {len(produtos_out)} produtos, {len(categorias_out)} categorias.')

# 2. Atualizar seed app/zuma-cozinha-oriental-seed.js
seed_cats_json = json.dumps(categorias_out, ensure_ascii=False, indent=2)
seed_prods_json = json.dumps(produtos_out, ensure_ascii=False, indent=2)

with open(SEED_PATH, 'r', encoding='utf-8') as f:
    seed_content = f.read()

# Substituir ZUMA_CATEGORIAS
seed_content = re.sub(
    r'export const ZUMA_CATEGORIAS = \[.*?\];\nexport const ZUMA_CARDAPIO_COMPLETO',
    lambda m: f'export const ZUMA_CATEGORIAS = {seed_cats_json};\nexport const ZUMA_CARDAPIO_COMPLETO',
    seed_content,
    flags=re.DOTALL
)

# Substituir ZUMA_CARDAPIO_COMPLETO
seed_content = re.sub(
    r'export const ZUMA_CARDAPIO_COMPLETO = \[.*?\];\nexport const ZUMA_MESAS_INICIAIS',
    lambda m: f'export const ZUMA_CARDAPIO_COMPLETO = {seed_prods_json};\nexport const ZUMA_MESAS_INICIAIS',
    seed_content,
    flags=re.DOTALL
)

with open(SEED_PATH, 'w', encoding='utf-8') as f:
    f.write(seed_content)

print(f'✅ Atualizado {SEED_PATH} com ZUMA_CATEGORIAS e ZUMA_CARDAPIO_COMPLETO reais!')

# 3. Atualizar ZUMA_CATEGORIAS_OFICIAIS e ZUMA_CARDAPIO_OFICIAL em index.html
with open(INDEX_HTML_PATH, 'r', encoding='utf-8') as f:
    html_content = f.read()

idx_cats_json = json.dumps(categorias_out, ensure_ascii=False)
idx_prods_json = json.dumps(produtos_out, ensure_ascii=False)

html_content = re.sub(
    r'const ZUMA_CATEGORIAS_OFICIAIS = \[.*?\];',
    lambda m: f'const ZUMA_CATEGORIAS_OFICIAIS = {idx_cats_json};',
    html_content,
    flags=re.DOTALL
)

html_content = re.sub(
    r'const ZUMA_CARDAPIO_OFICIAL = \[.*?\];',
    lambda m: f'const ZUMA_CARDAPIO_OFICIAL = {idx_prods_json};',
    html_content,
    flags=re.DOTALL
)

with open(INDEX_HTML_PATH, 'w', encoding='utf-8') as f:
    f.write(html_content)

print(f'✅ Atualizado {INDEX_HTML_PATH} com catálogo offline oficial sincronizado!')
