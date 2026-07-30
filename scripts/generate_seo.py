#!/usr/bin/env python3
"""
Gera, a partir de data/articles.json:

  - artigo/<id>/index.html — uma página estática por notícia, com as tags
    Open Graph / Twitter Card / JSON-LD corretas, para que links compartilhados
    (WhatsApp, Facebook, X, etc.) mostrem título, imagem e resumo. O corpo da
    página (nav, rodapé, scripts) é copiado de noticia.html, então o mesmo
    dist/main.js hidrata o conteúdo normalmente (main.ts lê o id do caminho
    /artigo/<id>/, ver getArticleIdFromPath). Não usamos "/noticia/<id>/"
    porque isso criaria uma pasta "noticia/" na raiz, colidindo com a URL
    limpa de noticia.html (/noticia).

  - rss.xml — feed RSS 2.0 com as notícias mais recentes, para agregadores
    (Google News, Apple News, leitores de feed, etc.).

Rodado localmente (para conferir o resultado) ou pela GitHub Action em
.github/workflows/generate-seo.yml a cada push que altera data/articles.json.
Todo o conteúdo gerado é derivado — não edite noticia/ ou rss.xml à mão.
"""
import html
import json
import mimetypes
import os
import re
import shutil
from datetime import datetime, timedelta, timezone
from email.utils import format_datetime
from xml.sax.saxutils import escape as xml_escape

from PIL import Image

SITE_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE_URL = "https://astrobotanica.com.br"
RSS_MAX_ITEMS = 30
# Horário de Brasília, sem horário de verão (extinto no Brasil desde 2019).
BRT = timezone(timedelta(hours=-3))


def parse_pub_date(date_str, time_str):
    """Combina date ("YYYY-MM-DD") e time opcional ("HH:MM", horário de
    Brasília) num datetime. Sem time (conteúdo antigo, cadastrado antes do
    campo existir), mantém o comportamento anterior: meia-noite UTC."""
    if time_str:
        dt = datetime.strptime(f"{date_str} {time_str}", "%Y-%m-%d %H:%M")
        return dt.replace(tzinfo=BRT)
    return datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
EXCERPT_MAX_CHARS = 220
# WhatsApp (e crawlers de social preview em geral) falham silenciosamente —
# sem preview nenhum, nem texto — se o og:image demorar/for pesado demais.
# Por isso og:image usa uma cópia redimensionada/recomprimida, não a capa
# original (que pode ter vários MB); o corpo da notícia continua intacto.
OG_IMAGE_MAX_WIDTH = 1200
OG_IMAGE_JPEG_QUALITY = 82


def load_json(relpath):
    with open(os.path.join(SITE_ROOT, relpath), encoding="utf-8") as f:
        return json.load(f)


def strip_html(value):
    # remove blocos <style>/<script> inteiros (conteúdo, não só a tag) antes
    # de tirar as demais tags — senão CSS/JS colado no corpo vaza pro resumo
    text = re.sub(r"(?is)<(style|script)\b[^>]*>.*?</\1>", " ", value)
    text = re.sub(r"<[^>]+>", " ", text)
    text = html.unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def excerpt_for(article):
    text = article.get("subtitle") or strip_html(article.get("body", ""))
    if len(text) <= EXCERPT_MAX_CHARS:
        return text
    cut = text[:EXCERPT_MAX_CHARS].rsplit(" ", 1)[0]
    return cut + "…"


def canonical_url(article_id):
    return f"{BASE_URL}/artigo/{article_id}/"


def absolute_asset_url(path):
    return f"{BASE_URL}/{path.lstrip('/')}"


def build_social_image(article, article_dir):
    src_path = os.path.join(SITE_ROOT, article.get("image") or "")
    if not article.get("image") or not os.path.isfile(src_path):
        return None
    with Image.open(src_path) as im:
        im = im.convert("RGB")
        if im.width > OG_IMAGE_MAX_WIDTH:
            ratio = OG_IMAGE_MAX_WIDTH / im.width
            im = im.resize((OG_IMAGE_MAX_WIDTH, round(im.height * ratio)), Image.LANCZOS)
        out_path = os.path.join(article_dir, "og-image.jpg")
        im.save(out_path, "JPEG", quality=OG_IMAGE_JPEG_QUALITY, optimize=True)
    return f"artigo/{article['id']}/og-image.jpg"


def build_head(article, brand_name, social_image_rel):
    title = f"{article['title']} — {brand_name}"
    desc = excerpt_for(article)
    url = canonical_url(article["id"])
    esc_title = html.escape(title, quote=True)
    esc_desc = html.escape(desc, quote=True)

    image_tags = ""
    json_ld_images = []
    if social_image_rel:
        image_url = absolute_asset_url(social_image_rel)
        json_ld_images.append(image_url)
        image_tags = (
            f'<meta property="og:image" content="{html.escape(image_url, quote=True)}" />\n'
            f'<meta name="twitter:image" content="{html.escape(image_url, quote=True)}" />\n'
            f'<meta name="twitter:card" content="summary_large_image" />'
        )
    else:
        image_tags = '<meta name="twitter:card" content="summary" />'

    json_ld = {
        "@context": "https://schema.org",
        "@type": "NewsArticle",
        "headline": article["title"],
        "description": desc,
        "datePublished": article["date"],
        "author": {"@type": "Person", "name": article.get("author") or brand_name},
        "publisher": {"@type": "Organization", "name": brand_name},
        "mainEntityOfPage": {"@type": "WebPage", "@id": url},
    }
    if json_ld_images:
        json_ld["image"] = json_ld_images

    return f"""<base href="/" />
<title>{esc_title}</title>
<meta name="description" content="{esc_desc}" />
<link rel="canonical" href="{url}" />
<meta property="og:type" content="article" />
<meta property="og:site_name" content="{html.escape(brand_name, quote=True)}" />
<meta property="og:locale" content="pt_BR" />
<meta property="og:url" content="{url}" />
<meta property="og:title" content="{esc_title}" />
<meta property="og:description" content="{esc_desc}" />
{image_tags}
<meta name="twitter:title" content="{esc_title}" />
<meta name="twitter:description" content="{esc_desc}" />
<meta property="article:published_time" content="{article['date']}" />
<link rel="alternate" type="application/rss+xml" title="{html.escape(brand_name, quote=True)} — Notícias" href="{BASE_URL}/rss.xml" />
<script type="application/ld+json">{json.dumps(json_ld, ensure_ascii=False)}</script>
<link rel="stylesheet" href="/css/style.css" />"""


def generate_article_pages(articles, brand_name):
    template_path = os.path.join(SITE_ROOT, "noticia.html")
    with open(template_path, encoding="utf-8") as f:
        template = f.read()

    match = re.search(r"<title.*?</head>", template, re.S)
    if not match:
        raise RuntimeError("noticia.html: não encontrei o bloco <title>...</head> esperado")
    before_head, after_head = template[: match.start()], template[match.end() :]
    # noticia.html usa caminhos relativos (css/style.css, dist/main.js) porque
    # vive na raiz; as páginas geradas vivem em /artigo/<id>/, então esses
    # caminhos precisam ser absolutos a partir da raiz do site.
    after_head = after_head.replace('src="dist/main.js"', 'src="/dist/main.js"')

    output_dir = os.path.join(SITE_ROOT, "artigo")
    shutil.rmtree(output_dir, ignore_errors=True)

    for article in articles:
        article_dir = os.path.join(output_dir, article["id"])
        os.makedirs(article_dir, exist_ok=True)
        social_image_rel = build_social_image(article, article_dir)
        head = build_head(article, brand_name, social_image_rel)
        page = before_head + head + after_head
        with open(os.path.join(article_dir, "index.html"), "w", encoding="utf-8") as f:
            f.write(page)

    return len(articles)


def build_rss(articles, brand_name, brand_tagline):
    items_xml = []
    for article in articles[:RSS_MAX_ITEMS]:
        url = canonical_url(article["id"])
        dt = parse_pub_date(article["date"], article.get("time"))
        pub_date = format_datetime(dt)
        desc = excerpt_for(article)
        enclosure = ""
        if article.get("image"):
            image_url = absolute_asset_url(article["image"])
            mime = mimetypes.guess_type(image_url)[0] or "image/jpeg"
            enclosure = f'\n      <enclosure url="{xml_escape(image_url)}" type="{mime}" />'
        items_xml.append(f"""    <item>
      <title>{xml_escape(article["title"])}</title>
      <link>{xml_escape(url)}</link>
      <guid isPermaLink="true">{xml_escape(url)}</guid>
      <pubDate>{pub_date}</pubDate>
      <category>{xml_escape(article.get("category", ""))}</category>
      <description>{xml_escape(desc)}</description>{enclosure}
    </item>""")

    now = format_datetime(datetime.now(timezone.utc))
    items_block = "\n".join(items_xml)
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>{xml_escape(brand_name)} — Notícias</title>
    <link>{BASE_URL}/noticias</link>
    <description>{xml_escape(brand_tagline)}</description>
    <language>pt-br</language>
    <lastBuildDate>{now}</lastBuildDate>
    <atom:link href="{BASE_URL}/rss.xml" rel="self" type="application/rss+xml" />
{items_block}
  </channel>
</rss>
"""


def main():
    articles = load_json("data/articles.json")
    site = load_json("data/site.json")
    brand_name = (site.get("brand", {}) or {}).get("name") or "Astrobotânica"
    brand_name = brand_name[:1].upper() + brand_name[1:] if brand_name else "Astrobotânica"
    brand_tagline = (site.get("brand", {}) or {}).get("footerTagline") or ""

    count = generate_article_pages(articles, brand_name)
    print(f"artigo/<id>/index.html gerado para {count} notícia(s)")

    rss = build_rss(articles, brand_name, brand_tagline)
    with open(os.path.join(SITE_ROOT, "rss.xml"), "w", encoding="utf-8") as f:
        f.write(rss)
    print("rss.xml gerado")


if __name__ == "__main__":
    main()
