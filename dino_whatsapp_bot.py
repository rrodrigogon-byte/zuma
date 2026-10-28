import datetime
import json

# Base de dados simulada dos clientes (Dino Barbearia)
# A data de hoje no ambiente é 2026-10-28.
# Colocamos as datas de última visita há mais de 15 dias para os 3 clientes solicitados.
clients = [
    {
        "id": 1, 
        "name": "Rodrigo Ribeiro Gonçalves", 
        "phone": "+5511999999991", 
        "last_visit": "2026-10-10" # 18 dias atrás
    },
    {
        "id": 2, 
        "name": "Rodrigo da Silva", 
        "phone": "+5511999999992", 
        "last_visit": "2026-10-12" # 16 dias atrás
    },
    {
        "id": 3, 
        "name": "Lucas dos Passos Silva", 
        "phone": "+5511999999993", 
        "last_visit": "2026-10-13" # 15 dias atrás
    },
    {
        "id": 4, 
        "name": "Cliente Fiel", 
        "phone": "+5511999999994", 
        "last_visit": "2026-10-25" # 3 dias atrás (Não deve receber a mensagem)
    }
]

def check_15_days_absence(last_visit_str):
    """Verifica se o cliente está há 15 dias ou mais sem ir à barbearia."""
    last_visit = datetime.datetime.strptime(last_visit_str, "%Y-%m-%d").date()
    today = datetime.date(2026, 10, 28) # Data atual fixada para o contexto
    delta = today - last_visit
    return delta.days >= 15

def get_available_slots():
    """Simula uma busca na agenda da Dino Barbearia para encontrar 3 horários vagos."""
    return [
        "Amanhã às 10:00",
        "Amanhã às 14:30",
        "Sábado às 09:00"
    ]

def send_whatsapp_message(client, slots):
    """Simula o envio da mensagem interativa pelo WhatsApp usando a Kytto."""
    message = f"""Olá, {client['name']}! 👋

Aqui é do Dino Barbearia. Tudo bem? 
Sentimos a sua falta! Notamos que já faz uns dias que você não vem dar aquele trato no visual e adoraríamos te receber novamente. 😊

Para facilitar a sua vida, demos uma olhada na nossa agenda e separamos 3 sugestões de horários exclusivos para você:

✅ Opção 1: {slots[0]}
✅ Opção 2: {slots[1]}
✅ Opção 3: {slots[2]}

Qual desses horários fica melhor para você? É só clicar em um dos botões abaixo para confirmar.

(Caso prefira outro horário, basta responder a esta mensagem!) ✨"""

    print(f"[{datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] 📲 ENVIANDO WHATSAPP PARA: {client['name']} ({client['phone']})")
    print("=" * 60)
    print(message)
    print("-" * 60)
    print("🔘 BOTÕES INTERATIVOS (API do WhatsApp):")
    print(f"[ Confirmar Opção 1 ]  [ Confirmar Opção 2 ]  [ Confirmar Opção 3 ]")
    print("=" * 60, "\n")

def run_automation():
    print(f"[{datetime.date(2026, 10, 28)}] INICIANDO AUTOMAÇÃO DINO BARBEARIA - GATILHO: 15+ DIAS\n")
    for client in clients:
        if check_15_days_absence(client["last_visit"]):
            print(f"🔎 Cliente {client['name']} está ausente há 15+ dias (Última visita: {client['last_visit']}).")
            slots = get_available_slots()
            send_whatsapp_message(client, slots)
        else:
            print(f"✅ Cliente {client['name']} esteve na barbearia recentemente (Última visita: {client['last_visit']}). Ignorando.\n")

if __name__ == "__main__":
    run_automation()
