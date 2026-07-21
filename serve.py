#!/usr/bin/env python3
"""
Servidor estático local que imita o comportamento de URLs limpas do
GitHub Pages: uma requisição para /podcast serve podcast.html (sem
redirecionar, sem exigir a extensão .html na barra de endereço) — assim
os links do site funcionam localmente do mesmo jeito que no site publicado.

Uso: python3 serve.py [porta]
(porta padrão: 8000)
"""
import http.server
import os
import sys


class CleanURLHandler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        translated = super().translate_path(path)
        if os.path.isdir(translated) or os.path.exists(translated):
            return translated
        html_candidate = translated + ".html"
        if os.path.isfile(html_candidate):
            return html_candidate
        return translated


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    http.server.test(HandlerClass=CleanURLHandler, port=port)
