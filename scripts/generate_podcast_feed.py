#!/usr/bin/env python3
"""
Gera podcast.xml a partir de data/episodes.json — feed RSS 2.0 com a
extensão "itunes" (namespace usado por Apple Podcasts, Spotify, Pocket
Casts, Overcast etc.) para que os episódios sejam reconhecidos como
podcast de verdade nesses apps, e não só como itens de RSS comuns.

Rodado localmente (para conferir o resultado) ou pela GitHub Action em
.github/workflows/generate-seo.yml a cada push que altera data/episodes.json.
Não edite podcast.xml à mão — é todo derivado.
"""
import html
import json
import mimetypes
import os
import re
from datetime import datetime, timezone
from email.utils import format_datetime
from xml.sax.saxutils import escape as xml_escape

SITE_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE_URL = "https://astrobotanica.com.br"
# Categoria declarada no próprio feed (taxonomia fixa do Apple Podcasts) —
# ajuste aqui se "Science" > "Natural Sciences" não for a mais adequada.
ITUNES_CATEGORY = "Science"
ITUNES_SUBCATEGORY = "Natural Sciences"


def load_json(relpath):
    with open(os.path.join(SITE_ROOT, relpath), encoding="utf-8") as f:
        return json.load(f)


def absolute_asset_url(path):
    return f"{BASE_URL}/{path.lstrip('/')}"


def itunes_duration(duration):
    # duration vem como "6:32 min" (ver interface Episode em src/main.ts);
    # itunes:duration aceita HH:MM:SS, MM:SS ou segundos — extrai só a parte
    # numérica MM:SS/HH:MM:SS, descartando o sufixo " min".
    match = re.search(r"\d{1,2}(:\d{2}){1,2}", duration)
    return match.group(0) if match else duration


def enclosure_length(audio_src):
    audio_path = os.path.join(SITE_ROOT, audio_src)
    return os.path.getsize(audio_path) if os.path.isfile(audio_path) else 0


def build_item(episode):
    url = f"{BASE_URL}/episodio?id={episode['id']}"
    dt = datetime.strptime(episode["date"], "%Y-%m-%d").replace(tzinfo=timezone.utc)
    pub_date = format_datetime(dt)
    audio_url = absolute_asset_url(episode["audioSrc"])
    mime = mimetypes.guess_type(audio_url)[0] or "audio/mpeg"
    length = enclosure_length(episode["audioSrc"])

    image_tag = ""
    if episode.get("image"):
        image_url = absolute_asset_url(episode["image"])
        image_tag = f'\n      <itunes:image href="{xml_escape(image_url)}" />'

    return f"""    <item>
      <title>{xml_escape(episode["title"])}</title>
      <link>{xml_escape(url)}</link>
      <guid isPermaLink="true">{xml_escape(url)}</guid>
      <pubDate>{pub_date}</pubDate>
      <description>{xml_escape(episode.get("description", ""))}</description>
      <enclosure url="{xml_escape(audio_url)}" type="{mime}" length="{length}" />
      <itunes:duration>{xml_escape(itunes_duration(episode["duration"]))}</itunes:duration>
      <itunes:episode>{episode["number"]}</itunes:episode>
      <itunes:episodeType>full</itunes:episodeType>
      <itunes:explicit>false</itunes:explicit>{image_tag}
    </item>"""


def channel_image_url(episodes):
    # Sem uma capa dedicada de podcast (quadrada, 1400-3000px) em data/site.json,
    # cai pra imagem do episódio mais recente que tiver uma. Recomendado:
    # criar uma arte de capa própria do podcast e apontar pra ela aqui.
    for episode in sorted(episodes, key=lambda e: e["date"], reverse=True):
        if episode.get("image"):
            return absolute_asset_url(episode["image"])
    return None


def build_podcast_xml(episodes, podcast_title, podcast_description, owner_name, owner_email):
    items_xml = "\n".join(build_item(e) for e in sorted(episodes, key=lambda e: e["date"], reverse=True))
    now = format_datetime(datetime.now(timezone.utc))
    image_url = channel_image_url(episodes)
    image_tag = f'\n    <itunes:image href="{xml_escape(image_url)}" />' if image_url else ""
    image_rss_tag = (
        f'\n    <image>\n      <url>{xml_escape(image_url)}</url>\n      <title>{xml_escape(podcast_title)}</title>\n      <link>{BASE_URL}/podcast</link>\n    </image>'
        if image_url
        else ""
    )

    return f"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>{xml_escape(podcast_title)}</title>
    <link>{BASE_URL}/podcast</link>
    <description>{xml_escape(podcast_description)}</description>
    <language>pt-br</language>
    <lastBuildDate>{now}</lastBuildDate>
    <atom:link href="{BASE_URL}/podcast.xml" rel="self" type="application/rss+xml" />
    <itunes:author>{xml_escape(owner_name)}</itunes:author>
    <itunes:explicit>false</itunes:explicit>
    <itunes:type>episodic</itunes:type>
    <itunes:owner>
      <itunes:name>{xml_escape(owner_name)}</itunes:name>
      <itunes:email>{xml_escape(owner_email)}</itunes:email>
    </itunes:owner>
    <itunes:category text="{xml_escape(ITUNES_CATEGORY)}">
      <itunes:category text="{xml_escape(ITUNES_SUBCATEGORY)}" />
    </itunes:category>{image_tag}{image_rss_tag}
{items_xml}
  </channel>
</rss>
"""


def main():
    episodes = load_json("data/episodes.json")
    site = load_json("data/site.json")
    podcast_title = (site.get("podcast", {}) or {}).get("title") or "Astrobotânica"
    podcast_description = (site.get("podcast", {}) or {}).get("intro") or (site.get("podcast", {}) or {}).get("metaDescription") or ""
    brand_name = (site.get("brand", {}) or {}).get("name") or "Astrobotânica"
    owner_name = brand_name[:1].upper() + brand_name[1:] if brand_name else "Astrobotânica"
    owner_email = (site.get("contato", {}) or {}).get("email") or ""

    xml = build_podcast_xml(episodes, podcast_title, podcast_description, owner_name, owner_email)
    with open(os.path.join(SITE_ROOT, "podcast.xml"), "w", encoding="utf-8") as f:
        f.write(xml)
    print(f"podcast.xml gerado para {len(episodes)} episódio(s)")


if __name__ == "__main__":
    main()
