// Dados de ranking/notícias de tênis: AO VIVO via API (se configurada) ou SNAPSHOT (fallback).
// Configure as variáveis no .env para ativar o modo ao vivo. Sem elas, usa o snapshot local.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const readSnap = f => JSON.parse(fs.readFileSync(path.join(__dirname,'data',f),'utf8'));

const cache = {}; // memo simples com TTL
function memo(key, ttlMs, fn){
  const c = cache[key];
  if(c && (Date.now()-c.t) < ttlMs) return Promise.resolve(c.v);
  return Promise.resolve(fn()).then(v=>{ cache[key]={t:Date.now(),v}; return v; });
}

// --- RANKING (ATP/WTA) ---
// Suporta provedores via RapidAPI (ex.: "tennis-api-atp-wta-itf"). Ajuste o parser conforme seu provedor.
async function fetchRankingLive(tour){
  const host = process.env.RAPIDAPI_TENNIS_HOST;     // ex.: tennis-api-atp-wta-itf.p.rapidapi.com
  const key  = process.env.RAPIDAPI_KEY;
  if(!host || !key) return null;
  const url = `https://${host}/tennis/v2/${tour.toLowerCase()}/ranking/singles/`;
  const res = await fetch(url, { headers: { 'x-rapidapi-host': host, 'x-rapidapi-key': key } });
  if(!res.ok) throw new Error('API ranking '+res.status);
  const data = await res.json();
  // Normaliza para o nosso formato (ajuste os campos conforme a resposta do provedor)
  const rows = (data.data || data.rankings || []).slice(0,30).map(r=>({
    pos: r.ranking||r.rank||r.position,
    nome: r.player?.name || r.name || r.full_name,
    pais: r.player?.country || r.country || r.nationality || '',
    pontos: r.points || r.ranking_points || null
  }));
  return { tour, atualizado: new Date().toISOString().slice(0,10), fonte:'API ao vivo', live:true, top: rows.slice(0,10), brasileiros: rows.filter(x=>/BRA|Brazil/i.test(x.pais)) };
}

export function ranking(tour){
  const t = tour.toUpperCase()==='WTA' ? 'WTA' : 'ATP';
  return memo('rank_'+t, 60*60*1000, async ()=>{
    try { const live = await fetchRankingLive(t); if(live) return live; }
    catch(e){ console.warn('Ranking ao vivo falhou, usando snapshot:', e.message); }
    return { ...readSnap(t==='WTA'?'snapshot-wta.json':'snapshot-atp.json'), live:false };
  });
}

// --- NOTÍCIAS ---
// Suporta NewsAPI (newsapi.org) com NEWSAPI_KEY, buscando "tennis". Sem chave, usa snapshot.
async function fetchNewsLive(){
  const key = process.env.NEWSAPI_KEY;
  if(!key) return null;
  const url = `https://newsapi.org/v2/everything?q=tennis%20ATP%20OR%20WTA&language=pt&sortBy=publishedAt&pageSize=8&apiKey=${key}`;
  const res = await fetch(url);
  if(!res.ok) throw new Error('API news '+res.status);
  const data = await res.json();
  const itens = (data.articles||[]).map(a=>({ titulo:a.title, resumo:a.description||'', fonte:a.source?.name||'', url:a.url, data:a.publishedAt }));
  return { atualizado: new Date().toISOString().slice(0,10), fonte:'NewsAPI (ao vivo)', live:true, itens, fontes_oficiais: readSnap('snapshot-news.json').fontes_oficiais };
}

export function noticias(){
  return memo('news', 30*60*1000, async ()=>{
    try { const live = await fetchNewsLive(); if(live) return live; }
    catch(e){ console.warn('Notícias ao vivo falharam, usando snapshot:', e.message); }
    return { ...readSnap('snapshot-news.json'), live:false };
  });
}
