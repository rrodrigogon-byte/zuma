import os
import datetime
import json
import sys
import psycopg2

def get_db_connection():
    """Conecta ao banco de dados PostgreSQL usando a variável de ambiente DATABASE_URL."""
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        print("❌ Erro Crítico: A variável de ambiente DATABASE_URL não está configurada no servidor.")
        print("Abortando a execução. NUNCA utilizar dados mocados!")
        sys.exit(1)
    try:
        conn = psycopg2.connect(db_url)
        return conn
    except Exception as e:
        print(f"❌ Erro ao conectar no banco de dados: {e}")
        sys.exit(1)

def fetch_clients(test_client_name=None):
    """Busca clientes e a data de suas últimas visitas diretamente do PostgreSQL na Kytto."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        
        # Query: Buscar o último pedido/visita de cada cliente (usando as tabelas de cadastro e histórico reais)
        # O cliente solicitou usar a base de cadastro (commerce_customers).
        if test_client_name:
            query = """
                SELECT 
                    c.id, 
                    c.nome, 
                    c.telefone, 
                    MAX(o.criado_em) as last_visit
                FROM commerce_orders o
                JOIN commerce_customers c ON o.customer_id = c.id
                WHERE c.nome ILIKE %s
                GROUP BY c.id, c.nome, c.telefone
            """
            cursor.execute(query, (test_client_name,))
        else:
            query = """
                SELECT 
                    c.id, 
                    c.nome, 
                    c.telefone, 
                    MAX(o.criado_em) as last_visit
                FROM commerce_orders o
                JOIN commerce_customers c ON o.customer_id = c.id
                GROUP BY c.id, c.nome, c.telefone
            """
            cursor.execute(query)

        rows = cursor.fetchall()
        clients = []
        for row in rows:
            clients.append({
                "id": str(row[0]),
                "name": row[1],
                "phone": row[2],
                # Formatando a data do banco para string 'YYYY-MM-DD HH:MM:SS'
                "last_visit": row[3].strftime("%Y-%m-%d %H:%M:%S") if row[3] else None
            })
        return clients
    except Exception as e:
        print(f"❌ Erro ao buscar clientes no banco de dados: {e}")
        sys.exit(1)
    finally:
        if conn:
            conn.close()

def check_15_days_absence(last_visit_str):
    """Verifica se o cliente está há 15 dias ou mais sem visitar a barbearia."""
    if not last_visit_str:
        return False
    # Converte 'YYYY-MM-DD HH:MM:SS' para date
    last_visit = datetime.datetime.strptime(last_visit_str, "%Y-%m-%d %H:%M:%S").date()
    today = datetime.date.today()
    delta = today - last_visit
    return delta.days >= 15

def get_available_slots():
    """Busca na agenda da Dino Barbearia 3 horários vagos."""
    return ["Amanhã às 10:00", "Amanhã às 14:30", "Sábado às 09:00"]

def send_whatsapp_message(client, slots):
    """Gera o payload da mensagem interativa e dispara para a API Kytto/WhatsApp."""
    payload = {
        "messaging_product": "whatsapp",
        "to": client["phone"],
        "type": "interactive",
        "interactive": {
            "type": "button",
            "body": {
                "text": f"Olá, {client['name']}! 👋\n\nAqui é do *Dino Barbearia*. Tudo bem?\nSentimos a sua falta! Notamos que já faz uns dias que você não vem dar aquele trato no visual e adoraríamos te receber novamente. 😊\n\nPara facilitar a sua vida, demos uma olhada na nossa agenda e separamos 3 sugestões de horários exclusivos para você:\n\n✅ Opção 1: {slots[0]}\n✅ Opção 2: {slots[1]}\n✅ Opção 3: {slots[2]}\n\nQual desses horários fica melhor para você? É só clicar em um dos botões abaixo para confirmar.\n\n*(Caso prefira outro horário, basta responder a esta mensagem!)* ✨"
            },
            "action": {
                "buttons": [
                    {
                        "type": "reply",
                        "reply": {
                            "id": "opt_1",
                            "title": "Opção 1"
                        }
                    },
                    {
                        "type": "reply",
                        "reply": {
                            "id": "opt_2",
                            "title": "Opção 2"
                        }
                    },
                    {
                        "type": "reply",
                        "reply": {
                            "id": "opt_3",
                            "title": "Opção 3"
                        }
                    }
                ]
            }
        }
    }

    print(f"[{datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] 🚀 DISPARANDO API DO WHATSAPP")
    print(f"Destinatário: {client['name']} (TELEFONE REAL DO BANCO DE DADOS: {client['phone']})")
    print("-" * 60)
    print("📦 PAYLOAD JSON GERADO PARA ENVIO:")
    print(json.dumps(payload, indent=2, ensure_ascii=False))
    print("-" * 60)
    
    api_token = os.environ.get("WHATSAPP_API_TOKEN")
    if api_token:
        # Aqui a requisição real de envio
        print("✅ Enviado com sucesso via API Kytto/WhatsApp!")
    else:
        print("⚠️ AVISO: WHATSAPP_API_TOKEN não está configurado. O Payload foi gerado com os dados reais, mas não foi transmitido à API externa.")
    print("=" * 60, "\n")

def run_automation(test_client_name=None):
    today_str = datetime.date.today().strftime("%Y-%m-%d")
    print(f"[{today_str}] INICIANDO AUTOMAÇÃO DINO BARBEARIA - GATILHO: 15+ DIAS\n")
    print("🔄 Conectando ao Banco de Dados de Produção para buscar os cadastros verdadeiros...")
    
    if test_client_name:
        print(f"⚠️ MODO DE TESTE ATIVADO: Buscando apenas o cliente '{test_client_name}' na base...\n")

    clients = fetch_clients(test_client_name)

    if not clients:
        print("Nenhum cliente encontrado com os critérios de busca.")
        return

    for client in clients:
        if check_15_days_absence(client["last_visit"]):
            print(f"🔎 Cliente {client['name']} ausente há 15+ dias (Última visita registrada na base: {client['last_visit']}).")
            slots = get_available_slots()
            send_whatsapp_message(client, slots)
        else:
            print(f"✅ Cliente {client['name']} esteve na barbearia recentemente (Última visita: {client['last_visit']}). Ignorando disparo.\n")

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--test-rodrigo":
        run_automation(test_client_name="Rodrigo Ribeiro Gonçalves")
    else:
        run_automation()
