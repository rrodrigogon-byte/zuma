const BASE = "https://setpoint-tm5n.onrender.com";

async function run() {
  const loginRes = await fetch(`${BASE}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user: "dino", senha: "123456" }),
  });
  const loginData = await loginRes.json();
  const token = loginData.token;

  const headers = {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json",
    "X-Empresa-Id": "d0d0ac01-8e50-4b61-8c79-de4aaa916da6",
    "X-Loja-Id": "ab049a75-6e2e-4cc9-abbc-6fd11cdda1d8"
  };

  const ids = [
    "age-mv2kz6ah-902", // Luiz Sergio 07:30
    "age-mv2hpe9s-431", // Luiz Sergio 08:00
    "age-mw261k8e-1912", // Willian N'eris 08:30
    "age-mv2hwq6i-754",  // Rafael Gubert 11:00
    "age-mw3ubnc6-1984", // Felipe Laurini 14:45
    "age-mw3vkaou-1989"  // Jose Antonio 15:30
  ];

  for (const id of ids) {
    const r = await fetch(`${BASE}/api/admin/barbearia/agenda/${id}/status`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        status: "confirmado",
        observacoes: "Presença confirmada pelo cliente no WhatsApp"
      })
    });
    const json = await r.json();
    console.log(`Agendamento ${id}: HTTP ${r.status} | Novo Status: ${json?.agendamento?.status || json?.error}`);
  }
}

run().catch(console.error);
