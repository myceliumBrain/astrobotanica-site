#!/usr/bin/env python3
"""
Gera sitemap.xml a partir das páginas estáticas do site, de data/articles.json
e de data/estudos.json + data/categorias_estudo.json.

Rodado localmente (para conferir o resultado) ou pela GitHub Action em
.github/workflows/generate-seo.yml a cada push que altera algum desses dados.
Não edite sitemap.xml à mão — ele é sempre sobrescrito.
"""
import json
import os
from datetime import date
from xml.sax.saxutils import escape as xml_escape

SITE_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE_URL = "https://astrobotanica.com.br"

# path -> changefreq (páginas que não têm data própria, ex: artigo/estudo)
STATIC_PAGES = [
    ("/", "weekly"),
    ("/noticias", "daily"),
    ("/estudos", "weekly"),
    ("/podcast", "weekly"),
    ("/sobre", "monthly"),
    ("/contato", "yearly"),
]


def load_json(relpath):
    with open(os.path.join(SITE_ROOT, relpath), encoding="utf-8") as f:
        return json.load(f)


def url_entry(loc, lastmod=None, changefreq=None):
    parts = [f"    <loc>{xml_escape(loc)}</loc>"]
    if lastmod:
        parts.append(f"    <lastmod>{lastmod}</lastmod>")
    if changefreq:
        parts.append(f"    <changefreq>{changefreq}</changefreq>")
    body = "\n".join(parts)
    return f"  <url>\n{body}\n  </url>"


def main():
    today = date.today().isoformat()
    entries = []

    for path, changefreq in STATIC_PAGES:
        entries.append(url_entry(f"{BASE_URL}{path}", today, changefreq))

    articles = load_json("data/articles.json")
    for article in articles:
        url = f"{BASE_URL}/artigo/{article['id']}/"
        entries.append(url_entry(url, article.get("date"), "monthly"))

    estudos = load_json("data/estudos.json")
    categorias = {c["id"]: c for c in load_json("data/categorias_estudo.json")}
    for verbete in estudos:
        if not verbete.get("publicado"):
            continue
        categoria = categorias.get(verbete.get("categoriaId"))
        if not categoria:
            continue
        url = f"{BASE_URL}/estudos/{categoria['slug']}/{verbete['slug']}/"
        entries.append(url_entry(url, verbete.get("dataAtualizacao"), "monthly"))

    body = "\n".join(entries)
    sitemap = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        f"{body}\n"
        "</urlset>\n"
    )
    with open(os.path.join(SITE_ROOT, "sitemap.xml"), "w", encoding="utf-8") as f:
        f.write(sitemap)
    print(f"sitemap.xml gerado com {len(entries)} URL(s)")


if __name__ == "__main__":
    main()
