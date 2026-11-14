#!/usr/bin/env python3
"""
Gerador de Imagens Industriais Realistas de CFTV para o CCO Serrano Concreto
Cria snapshots de alta definição com sobreposição OSD de telemetria, marca d'água de fabricante e dados de usina.
Utiliza fontes TrueType com suporte nativo a UTF-8 e acentuação brasileira.
"""
import os
import math
import random
from PIL import Image, ImageDraw, ImageFont

OUTPUT_DIRS = [
    "/tmp/repo/app/public/assets/cftv",
    "/tmp/repo/web/public/assets/cftv",
    "/tmp/repo/web/dist/assets/cftv"
]

for d in OUTPUT_DIRS:
    os.makedirs(d, exist_ok=True)

# Fontes TrueType
FONT_PATH = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_BOLD_PATH = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

font_osd = ImageFont.truetype(FONT_BOLD_PATH, 14)
font_osd_small = ImageFont.truetype(FONT_PATH, 12)
font_badge = ImageFont.truetype(FONT_BOLD_PATH, 12)
font_elem = ImageFont.truetype(FONT_BOLD_PATH, 13)
font_lpr = ImageFont.truetype(FONT_BOLD_PATH, 18)

def create_base_canvas(w=1280, h=720, bg_style="dark_industrial"):
    img = Image.new("RGB", (w, h), (18, 24, 33))
    draw = ImageDraw.Draw(img)
    
    if bg_style == "dark_industrial":
        for y in range(h):
            r = int(12 + (y / h) * 18)
            g = int(16 + (y / h) * 24)
            b = int(24 + (y / h) * 36)
            draw.line([(0, y), (w, y)], fill=(r, g, b))
    elif bg_style == "thermal_flir":
        # Gradiente térmico Ironbow FLIR
        for y in range(h):
            ratio = y / h
            r = int(min(255, ratio * 300))
            g = int(min(255, max(0, (ratio - 0.25) * 280)))
            b = int(min(255, max(0, 200 - ratio * 180)))
            draw.line([(0, y), (w, y)], fill=(r, g, b))
    elif bg_style == "starlight":
        for y in range(h):
            v = int(22 + (y / h) * 32)
            draw.line([(0, y), (w, y)], fill=(v, int(v * 1.1), v))
    else:
        for y in range(h):
            r = int(32 + (y / h) * 22)
            g = int(40 + (y / h) * 28)
            b = int(50 + (y / h) * 35)
            draw.line([(0, y), (w, y)], fill=(r, g, b))
            
    return img, draw

def add_cctv_osd(img, draw, cam_title, ip, brand, model, fps=30, codec="H.265", lpr_box=None, telemetry_extra=None):
    w, h = img.size
    
    # Retícula central de mira industrial
    draw.line([(w // 2 - 25, h // 2), (w // 2 + 25, h // 2)], fill=(56, 189, 248, 140), width=1)
    draw.line([(w // 2, h // 2 - 25), (w // 2, h // 2 + 25)], fill=(56, 189, 248, 140), width=1)
    
    # Barra superior semitransparente OSD
    draw.rectangle([(0, 0), (w, 42)], fill=(10, 15, 24))
    
    # Textos OSD superiores com fontes DejaVu
    header_left = f"🔴 REC  {cam_title[:38]}  |  {brand[:12].upper()}"
    header_right = f"2026-11-13 21:40:12 BRT  |  {ip}:554  |  {fps}FPS  {codec}"
    
    draw.text((16, 12), header_left, fill=(240, 240, 240), font=font_osd)
    draw.text((w - 420, 12), header_right, fill=(56, 189, 248), font=font_osd_small)
    
    # Barra inferior OSD
    draw.rectangle([(0, h - 36), (w, h)], fill=(10, 15, 24))
    footer_left = f"SERRANO CONCRETO CCO  ·  MOTOR KYTTOIA VISION AI  ·  LATÊNCIA: {random.randint(5, 12)}ms"
    footer_right = telemetry_extra or "CANAL 01  ·  STREAM PRINCIPAL 1080P  ·  ONVIF PROFILE S/T"
    
    draw.text((16, h - 26), footer_left, fill=(16, 185, 129), font=font_osd_small)
    draw.text((w - 520, h - 26), footer_right, fill=(203, 213, 225), font=font_osd_small)
    
    # Marca d'água no canto superior direito
    draw.rectangle([(w - 200, 52), (w - 16, 84)], fill=(15, 23, 42))
    draw.rectangle([(w - 200, 52), (w - 16, 84)], outline=(56, 189, 248), width=1)
    draw.text((w - 190, 60), f"★ {brand[:16].upper()}", fill=(56, 189, 248), font=font_badge)
    
    # Se houver bounding box LPR
    if lpr_box:
        bx, by, bw, bh, plate, conf = lpr_box
        draw.rectangle([(bx, by), (bx + bw, by + bh)], outline=(16, 185, 129), width=3)
        draw.rectangle([(bx, by - 26), (bx + bw, by)], fill=(16, 185, 129))
        draw.text((bx + 6, by - 22), f"{plate} ({conf}%)", fill=(0, 0, 0), font=font_elem)

def generate_all_snapshots():
    cameras_data = [
        {
            "filename": "cftv_cam07_bosch_celulas.jpg",
            "title": "Balança 80t - Células de Carga C1-C8 Toledo Prix",
            "brand": "Bosch Security",
            "model": "Dinion IP Starlight 7000 HD",
            "ip": "192.168.1.130",
            "style": "starlight",
            "extra": "CÉLULAS C1-C8: 100% BALANCEADAS  ·  IPEM-MT APROVADO",
            "draw_func": "balanca_celulas"
        },
        {
            "filename": "cftv_cam08_avigilon_traseira.jpg",
            "title": "Balança 80t - Totem Traseiro LPR",
            "brand": "Motorola / Avigilon",
            "model": "H5A Bullet 5.0 MP LPR OCR",
            "ip": "192.168.1.132",
            "style": "dark_industrial",
            "lpr": (520, 360, 240, 90, "RRA-4E80", "99.8"),
            "extra": "LEITURA LPR TRASEIRA MERCOSUL CONFIRMADA",
            "draw_func": "truck_rear"
        },
        {
            "filename": "cftv_cam09_toledo_totem.jpg",
            "title": "Balança 80t - Totem Motorista Autoatendimento",
            "brand": "Toledo Prix LPR",
            "model": "Totem Prix 9094 / Indicador 720i",
            "ip": "192.168.1.135",
            "style": "dark_industrial",
            "extra": "INDICADOR 720i: 33.480 kg BRUTO  ·  TICKET NBR 7212",
            "draw_func": "totem_toledo"
        },
        {
            "filename": "cftv_cam10_uniview_mineracao.jpg",
            "title": "Balança 02 Mineração Rio Sangue - Totem LPR",
            "brand": "Uniview (UNV)",
            "model": "IPC2324EBR-DPZ28-D 4MP LPR",
            "ip": "192.168.1.127",
            "style": "dark_industrial",
            "lpr": (480, 380, 220, 80, "SRO-9A12", "99.4"),
            "extra": "MINERAÇÃO SERRANO  ·  AREIA MÉDIA LAVADA CFEM",
            "draw_func": "mineracao"
        },
        {
            "filename": "cftv_cam11_tplink_vigi_baias.jpg",
            "title": "Baias de Agregados & Britas 0, 1 e Pedrisco",
            "brand": "TP-Link VIGI",
            "model": "VIGI C340-W 4MP Full-Color",
            "ip": "192.168.1.138",
            "style": "day_dusk",
            "extra": "ESTOQUE: BRITA 0 (140t) · BRITA 1 (210t) · PEDRISCO (95t)",
            "draw_func": "baias"
        },
        {
            "filename": "cftv_cam12_flir_termica.jpg",
            "title": "Termografia de Silos & Temperatura de Balão",
            "brand": "Teledyne FLIR",
            "model": "FLIR A50 Smart Thermal Sensor",
            "ip": "192.168.1.150",
            "style": "thermal_flir",
            "extra": "TERMOGRAFIA BALÃO: 28.4°C CONFORME NBR 7212 (MAX 32°C)",
            "draw_func": "thermal"
        },
        {
            "filename": "cftv_cam13_hanwha_silos.jpg",
            "title": "Silos de Cimento CP II-F e CP V-ARI (96t)",
            "brand": "Hanwha Vision",
            "model": "QNO-8080R 5MP Wisenet IR",
            "ip": "192.168.1.140",
            "style": "dark_industrial",
            "extra": "SILO 1 (CP II-F): 68.4t  |  SILO 2 (CP V-ARI): 74.2t",
            "draw_func": "silos"
        },
        {
            "filename": "cftv_cam14_pelco_lavagem.jpg",
            "title": "Lavagem de Betoneiras & Reciclador de Água",
            "brand": "Pelco by Motorola",
            "model": "Pelco Sarix Pro 4 IBP341",
            "ip": "192.168.1.145",
            "style": "dark_industrial",
            "extra": "BAIA DE LAVAGEM 01 LIVRE  ·  RECIRCULAÇÃO 100% OK",
            "draw_func": "lavagem"
        },
        {
            "filename": "cftv_cam15_vivotek_portao.jpg",
            "title": "Portão da Usina - Cancela Primária MT-358",
            "brand": "Vivotek",
            "model": "IB9387-LPR Embedded Industrial",
            "ip": "192.168.1.142",
            "style": "dark_industrial",
            "lpr": (510, 410, 210, 75, "RRA-4E80", "99.7"),
            "extra": "CANCELA AUTOMÁTICA LIBERADA VIA LPR KYTTOIA",
            "draw_func": "portao"
        },
        {
            "filename": "cftv_cam16_geovision_manobras.jpg",
            "title": "Pátio de Manobra & Pré-Pesagem",
            "brand": "GeoVision",
            "model": "GV-LPR 2800-FD Industrial",
            "ip": "192.168.1.152",
            "style": "dark_industrial",
            "extra": "FILA ESTIMADA: 2 CAMINHÕES  ·  TEMPO MÉDIO: 3.5 MIN",
            "draw_func": "manobras"
        },
        {
            "filename": "cftv_cam17_giga_almoxarifado.jpg",
            "title": "Almoxarifado & Tanques de Aditivos",
            "brand": "Giga Security",
            "model": "GS0081 Orion Full HD",
            "ip": "192.168.1.128",
            "style": "dark_industrial",
            "extra": "ADITIVO PLASTIFICANTE: 4.800L  ·  RETARDADOR: 2.200L",
            "draw_func": "almoxarifado"
        },
        {
            "filename": "cftv_cam18_tecvoz_estacionamento.jpg",
            "title": "Estacionamento de Espera de Betoneiras",
            "brand": "Tecvoz",
            "model": "Flex IP 2MP Bullet",
            "ip": "192.168.1.129",
            "style": "dark_industrial",
            "extra": "BETONEIRAS DISPONÍVEIS: BT-01, BT-02, BT-04 PRONTAS",
            "draw_func": "estacionamento"
        },
        {
            "filename": "cftv_cam19_onvif_perimetro.jpg",
            "title": "Perímetro Industrial & Subestação Elétrica",
            "brand": "ONVIF Genérico",
            "model": "Profile S/T Industrial Ready",
            "ip": "192.168.1.160",
            "style": "dark_industrial",
            "extra": "CERCA VIRTUAL ATIVA  ·  ZERO INTRUSÕES DETECTADAS",
            "draw_func": "perimetro"
        }
    ]

    for c in cameras_data:
        img, draw = create_base_canvas(1280, 720, c["style"])
        w, h = img.size
        
        fn = c["draw_func"]
        if fn == "balanca_celulas":
            # Plataforma de pesagem metálica 21m
            draw.rectangle([(160, 260), (1120, 500)], fill=(30, 41, 59), outline=(71, 85, 105), width=3)
            draw.line([(160, 380), (1120, 380)], fill=(234, 179, 8), width=3)
            # 8 Células de Carga Toledo Prix digitais
            for i in range(8):
                cx = 240 + i * 110
                draw.rectangle([(cx - 20, 275), (cx + 20, 305)], fill=(16, 185, 129), outline=(255, 255, 255))
                draw.text((cx - 12, 282), f"C{i+1}", fill=(0, 0, 0), font=font_elem)
                draw.rectangle([(cx - 20, 455), (cx + 20, 485)], fill=(16, 185, 129), outline=(255, 255, 255))
                draw.text((cx - 12, 462), f"C{i+1}", fill=(0, 0, 0), font=font_elem)
        elif fn == "thermal":
            # FLIR Thermal Ironbow
            draw.rectangle([(280, 160), (460, 560)], fill=(234, 88, 12), outline=(251, 191, 36), width=2)
            draw.rectangle([(540, 160), (720, 560)], fill=(180, 83, 9), outline=(251, 191, 36), width=2)
            draw.ellipse([(820, 240), (1140, 480)], fill=(220, 38, 38), outline=(254, 240, 138), width=3)
            draw.text((860, 350), "TAMBOR 28.4°C [OK]", fill=(255, 255, 255), font=font_elem)
            draw.text((310, 320), "SILO 1 (31.2°C)", fill=(255, 255, 255), font=font_elem)
            draw.text((570, 320), "SILO 2 (29.8°C)", fill=(255, 255, 255), font=font_elem)
        elif fn == "truck_rear":
            # Traseira de caminhão betoneira
            draw.rectangle([(420, 200), (860, 560)], fill=(30, 58, 138), outline=(59, 130, 246), width=3)
            draw.ellipse([(480, 220), (800, 460)], fill=(29, 78, 216), outline=(96, 165, 250), width=2)
            draw.polygon([(600, 440), (680, 440), (660, 540), (620, 540)], fill=(100, 116, 139))
            draw.rectangle([(550, 480), (730, 540)], fill=(255, 255, 255), outline=(0, 0, 0), width=2)
            draw.rectangle([(550, 480), (730, 498)], fill=(0, 51, 153))
            draw.text((575, 504), "RRA-4E80", fill=(0, 0, 0), font=font_lpr)
        elif fn == "silos":
            draw.rectangle([(320, 120), (540, 580)], fill=(51, 65, 85), outline=(148, 163, 184), width=3)
            draw.polygon([(320, 120), (430, 60), (540, 120)], fill=(71, 85, 105))
            draw.rectangle([(700, 120), (920, 580)], fill=(51, 65, 85), outline=(148, 163, 184), width=3)
            draw.polygon([(700, 120), (810, 60), (920, 120)], fill=(71, 85, 105))
            draw.text((345, 300), "SILO 01 · CP II-F", fill=(255, 255, 255), font=font_elem)
            draw.text((725, 300), "SILO 02 · CP V-ARI", fill=(255, 255, 255), font=font_elem)
        elif fn == "baias":
            for b_idx, b_nome in enumerate(["BRITA 0", "BRITA 1", "PEDRISCO"]):
                bx = 180 + b_idx * 330
                draw.rectangle([(bx, 280), (bx + 280, 580)], fill=(40, 50, 65), outline=(100, 116, 139), width=2)
                draw.polygon([(bx + 20, 560), (bx + 140, 360), (bx + 260, 560)], fill=(75, 85, 99))
                draw.text((bx + 75, 300), b_nome, fill=(245, 158, 11), font=font_elem)
        elif fn == "portao":
            draw.rectangle([(160, 240), (320, 580)], fill=(30, 41, 59), outline=(71, 85, 105), width=2)
            draw.text((175, 260), "PORTARIA MT-358", fill=(255, 255, 255), font=font_elem)
            for z in range(12):
                zx = 320 + z * 60
                cor = (239, 68, 68) if z % 2 == 0 else (255, 255, 255)
                draw.rectangle([(zx, 440), (zx + 60, 460)], fill=cor)
        elif fn == "totem_toledo":
            # Totem Toledo Prix 9094 com display 720i
            draw.rectangle([(480, 180), (800, 600)], fill=(15, 23, 42), outline=(37, 99, 235), width=3)
            draw.rectangle([(520, 220), (760, 340)], fill=(2, 6, 23), outline=(16, 185, 129), width=2)
            draw.text((545, 240), "TOLEDO PRIX 720i", fill=(16, 185, 129), font=font_elem)
            draw.text((545, 280), "33.480 kg BRUTO", fill=(255, 255, 255), font=font_lpr)
            draw.text((530, 380), "APROXIME O CRACHÁ / QR CODE", fill=(203, 213, 225), font=font_elem)
        else:
            draw.rectangle([(120, 300), (1160, 620)], fill=(24, 30, 42), outline=(51, 65, 85), width=2)
            draw.line([(120, 460), (1160, 460)], fill=(234, 179, 8), width=2)
            draw.text((w // 2 - 160, 340), f"PÁTIO INDUSTRIAL · {c['title']}", fill=(148, 163, 184), font=font_elem)
            
        add_cctv_osd(
            img, 
            draw, 
            c["title"], 
            c["ip"], 
            c["brand"], 
            c["model"], 
            fps=30, 
            codec="H.265", 
            lpr_box=c.get("lpr"), 
            telemetry_extra=c.get("extra")
        )
        
        for out_dir in OUTPUT_DIRS:
            target_path = os.path.join(out_dir, c["filename"])
            img.save(target_path, "JPEG", quality=90)
            print(f"Salvo com sucesso: {target_path}")

if __name__ == "__main__":
    generate_all_snapshots()
    print("Todos os snapshots com tipografia TrueType e OSD perfeito foram gerados!")
