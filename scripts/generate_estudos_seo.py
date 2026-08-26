#!/usr/bin/env python3
"""
Gera, a partir de data/estudos.json e data/categorias_estudo.json:

  - estudos/<categoria-slug>/<verbete-slug>/index.html — uma página estática
    por verbete publicado, com as tags Open Graph / Twitter Card / JSON-LD
    corretas (mesmo mecanismo de scripts/generate_seo.py para notícias). O
    corpo da página (nav, rodapé, scripts) é copiado de estudo.html, então o
    mesmo dist/main.js hidrata o conteúdo normalmente (main.ts lê o slug do
    caminho /estudos/<categoria>/<verbete>/, ver getVerbeteSlugFromPath).

estudos/index.html (a página-índice, /estudos) NÃO é gerado por este script —
é um arquivo editado à mão, versionado normalmente, que vive na mesma pasta
só para reservar /estudos como diretório de verdade (ver comentário em
clean_generated_subdirs abaixo). Por isso a limpeza antes de regenerar remove
só as subpastas de categoria/verbete, nunca o index.html da raiz da pasta.

Rodado localmente (para conferir o resultado) ou pela GitHub Action em
.github/workflows/generate-seo.yml a cada push que altera data/estudos.json
ou data/categorias_estudo.json. Todo o conteúdo gerado é derivado — não edite
as subpastas de estudos/ à mão.
"""
import html
import json
import os
import re
import shutil

from PIL import Image

SITE_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE_URL = "https://astrobotanica.com.br"
EXCERPT_MAX_CHARS = 220
OG_IMAGE_MAX_WIDTH = 1200
OG_IMAGE_JPEG_QUALITY = 82


def load_json(relpath):
    with open(os.path.join(SITE_ROOT, relpath), encoding="utf-8") as f:
        return json.load(f)


def strip_html(value):
    text = re.sub(r"(?is)<(style|script)\b[^>]*>.*?</\1>", " ", value)
    text = re.sub(r"<[^>]+>", " ", text)
    text = html.unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def excerpt_for(verbete):
    text = verbete.get("definicaoCurta") or strip_html(verbete.get("conteudo", ""))
    if len(text) <= EXCERPT_MAX_CHARS:
        return text
    cut = text[:EXCERPT_MAX_CHARS].rsplit(" ", 1)[0]
    return cut + "…"


def canonical_url(categoria_slug, verbete_slug):
    return f"{BASE_URL}/estudos/{categoria_slug}/{verbete_slug}/"


def absolute_asset_url(path):
    return f"{BASE_URL}/{path.lstrip('/')}"


def build_social_image(verbete, verbete_dir):
    src_path = os.path.join(SITE_ROOT, verbete.get("imagemCapa") or "")
    if not verbete.get("imagemCapa") or not os.path.isfile(src_path):
        return None
    with Image.open(src_path) as im:
        im = im.convert("RGB")
        if im.width > OG_IMAGE_MAX_WIDTH:
            ratio = OG_IMAGE_MAX_WIDTH / im.width
            im = im.resize((OG_IMAGE_MAX_WIDTH, round(im.height * ratio)), Image.LANCZOS)
        out_path = os.path.join(verbete_dir, "og-image.jpg")
        im.save(out_path, "JPEG", quality=OG_IMAGE_JPEG_QUALITY, optimize=True)
    categoria_slug = os.path.basename(os.path.dirname(verbete_dir))
    return f"estudos/{categoria_slug}/{verbete['slug']}/og-image.jpg"


def build_head(verbete, categoria, brand_name, social_image_rel):
    title = f"{verbete['titulo']} — {brand_name}"
    desc = excerpt_for(verbete)
    url = canonical_url(categoria["slug"], verbete["slug"])
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
        "@type": "DefinedTerm",
        "name": verbete["titulo"],
        "description": desc,
        "inDefinedTermSet": categoria["nome"],
        "url": url,
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
<script type="application/ld+json">{json.dumps(json_ld, ensure_ascii=False)}</script>
<link rel="stylesheet" href="/css/style.css" />"""


# estudos/index.html é editado à mão (não gerado) — apagar a pasta inteira
# antes de regenerar a apagaria junto. Em vez disso, remove só as subpastas
# (uma por categoria), que é tudo que este script de fato produz.
def clean_generated_subdirs(estudos_dir):
    if not os.path.isdir(estudos_dir):
        return
    for name in os.listdir(estudos_dir):
        full = os.path.join(estudos_dir, name)
        if os.path.isdir(full):
            shutil.rmtree(full)


def generate_verbete_pages(estudos, categorias, brand_name):
    template_path = os.path.join(SITE_ROOT, "estudo.html")
    with open(template_path, encoding="utf-8") as f:
        template = f.read()

    match = re.search(r"<title.*?</head>", template, re.S)
    if not match:
        raise RuntimeError("estudo.html: não encontrei o bloco <title>...</head> esperado")
    before_head, after_head = template[: match.start()], template[match.end() :]
    after_head = after_head.replace('src="dist/main.js"', 'src="/dist/main.js"')

    categorias_by_id = {c["id"]: c for c in categorias}
    estudos_dir = os.path.join(SITE_ROOT, "estudos")
    clean_generated_subdirs(estudos_dir)

    count = 0
    for verbete in estudos:
        if not verbete.get("publicado"):
            continue
        categoria = categorias_by_id.get(verbete.get("categoriaId"))
        if not categoria:
            print(f"aviso: verbete '{verbete.get('id')}' sem categoria válida — pulando")
            continue

        verbete_dir = os.path.join(estudos_dir, categoria["slug"], verbete["slug"])
        os.makedirs(verbete_dir, exist_ok=True)
        social_image_rel = build_social_image(verbete, verbete_dir)
        head = build_head(verbete, categoria, brand_name, social_image_rel)
        page = before_head + head + after_head
        with open(os.path.join(verbete_dir, "index.html"), "w", encoding="utf-8") as f:
            f.write(page)
        count += 1

    return count


def main():
    estudos = load_json("data/estudos.json")
    categorias = load_json("data/categorias_estudo.json")
    site = load_json("data/site.json")
    brand_name = (site.get("brand", {}) or {}).get("name") or "Astrobotânica"
    brand_name = brand_name[:1].upper() + brand_name[1:] if brand_name else "Astrobotânica"

    count = generate_verbete_pages(estudos, categorias, brand_name)
    print(f"estudos/<categoria>/<verbete>/index.html gerado para {count} verbete(s)")


if __name__ == "__main__":
    main()
