#!/usr/bin/env python3
"""
Consulta a API do GoatCounter (https://www.goatcounter.com/) e gera
data/pageviews.json com o ranking de notícias mais acessadas (por caminho
/artigo/<id>/), usado na seção "Mais acessadas" da barra lateral (ver
buildArticleSidebar em src/main.ts).

Precisa de duas coisas configuradas fora daqui, que este script não pode
fazer sozinho:
  1. Uma conta em https://www.goatcounter.com/ (grátis) com um site criado
     — o "código" do site (ex.: astrobotanica.goatcounter.com) precisa
     bater com o valor usado no <script data-goatcounter="..."> em
     noticia.html.
  2. Um token de API (Configurações → API → novo token, só precisa de
     permissão de leitura) guardado como secret do repositório no GitHub
     (Settings → Secrets and variables → Actions), com o nome
     GOATCOUNTER_API_TOKEN — é o que o workflow agendado usa (ver
     .github/workflows/pageviews.yml).

Sem o token configurado, roda sem erro e não sobrescreve nada — assim o
pipeline não quebra antes de alguém terminar essa configuração manual.
"""
import json
import os
import re
import urllib.request
from urllib.error import HTTPError, URLError

SITE_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GOATCOUNTER_CODE = os.environ.get("GOATCOUNTER_CODE", "astrobotanica")
GOATCOUNTER_API_TOKEN = os.environ.get("GOATCOUNTER_API_TOKEN")
MAX_RESULTS = 10
ARTICLE_PATH_RE = re.compile(r"^/artigo/([^/]+)/?$")


def fetch_hits():
    base_url = f"https://{GOATCOUNTER_CODE}.goatcounter.com/api/v0/stats/hits"
    counts = {}
    after = None
    for _ in range(20):  # até 20 páginas (2000 caminhos) é mais que suficiente
        url = f"{base_url}?limit=100"
        if after:
            url += f"&after={after}"
        req = urllib.request.Request(url, headers={"Authorization": f"Bearer {GOATCOUNTER_API_TOKEN}"})
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = json.loads(resp.read())
        for hit in data.get("hits", []):
            match = ARTICLE_PATH_RE.match(hit.get("path", ""))
            if match:
                article_id = match.group(1)
                counts[article_id] = counts.get(article_id, 0) + hit.get("count", 0)
        if not data.get("more"):
            break
        after = data.get("after")
        if not after:
            break
    return counts


def main():
    if not GOATCOUNTER_API_TOKEN:
        print("GOATCOUNTER_API_TOKEN não configurado — pulando (ver instruções no topo deste arquivo).")
        return

    try:
        counts = fetch_hits()
    except (HTTPError, URLError) as e:
        raise SystemExit(f"Falha ao consultar a API do GoatCounter: {e}")

    # Lista simples de ids, mais acessada primeiro — mesmo formato de
    # articles.json/episodes.json, pra reaproveitar loadJSON() em main.ts.
    ranked = sorted(counts, key=counts.get, reverse=True)[:MAX_RESULTS]
    with open(os.path.join(SITE_ROOT, "data", "pageviews.json"), "w", encoding="utf-8") as f:
        json.dump(ranked, f, ensure_ascii=False, indent=2)
    print(f"data/pageviews.json gerado com {len(ranked)} notícia(s): {ranked}")


if __name__ == "__main__":
    main()
