---
title: "STELLA: Instrumento Open Science da NASA (Sensoriamento Remoto)"
description: ""
date: "2026-07-29"
updated: ""
author: "Pedro Henrique Tenorio Alvarenga"
orcid: ""
lattes: ""
fonte:
  citacao: ""
  doi: ""
  url: ""
tipo_estudo: ""
revisor_tecnico: ""
tags: []
lang: "pt"
boletim:
  volume: ""
  numero: ""
erratas: []
# --- campos do site atual, preservados como estão ---
id: "noticia-6"
ordem: 9
time: "23:00"
category: "Hardwares e Softwares"
subtitle: "O artigo denominado \"Educação em Ciência e Tecnologia para Avaliação da Terra e da Vida (STELLA): Democratizando a Ciência do Sensoriamento Remoto com Instrumentos de Baixo Custo e Código Aberto para Pesquisa e Educação\", da NASA, propôe a elaboração de equipamento de baixo custo para ser usado em laboratórios."
readingTime: "4 min"
image: "images/noticias/noticia-6-imagem-principal.png"
imageCaption: "O instrumento STELLA-Q2 medindo uma folha de peperômia. (a) O instrumento STELLA-Q2 montado em uma haste de suporte. (b) O instrumento STELLA-Q em uma carcaça impressa em 3D. (c) A parte traseira do instrumento STELLA-Q2 com a tampa removida, mostrando a fiação interna composta apenas por conectores."
imageVertical: "images/noticias/noticia-6-imagem-vertical.png"
authorAvatar: "images/integrantes/integrante-pedro.jpeg"
references:
  - text: "MIREL, P., et al, \"Science and Technology Education for Land / Life Assessment (STELLA): Democratizing Remote Sensing Science With Low-Cost Open-Source Instruments for Research and Education\", 2025."
    url: "https://agupubs.onlinelibrary.wiley.com/doi/10.1029/2025CN000284"
---
<p>Cientistas e engenheiros da NASA, em colaboração com pesquisadores universitários, publicaram recentemente os detalhes do <b>projeto STELLA</b> (Science and Technology Education for Land/Life Assessment). O objetivo é democratizar o acesso ao sensoriamento remoto de alta precisão biológica através de <b>instrumentos open-source e de baixo custo</b>, permitindo que qualquer pessoa com conhecimentos básicos de eletrônica possa monitorar a saúde vegetal com ferramentas comparáveis às tecnologias orbitais.</p><h3>Hardware e Engenharia: O "Tricorder" da Botânica Moderna</h3><p>O ecossistema STELLA é composto por duas séries principais de instrumentos, ambos baseados em microcontroladores e sensores comerciais de última geração.</p><p><b>STELLA-Q (Quick-to-assemble)</b>: Uma versão de montagem rápida que não exige ferramentas, apenas a conexão de cabos. Com um custo aproximado de US$ 200, o dispositivo utiliza uma tríade de sensores espectroscópicos (AS72561/62/63 da AMS-Osram) para medir irradiação em 18 canais no espectro visível e infravermelho próximo (VNIR), cobrindo de 410 a 940 nm.</p><p><b>STELLA-1 (Séries 1.1 e 1.2)</b>: Versões mais avançadas que exigem soldagem em placas de prototipagem, permitindo a integração de sensores adicionais. O STELLA-1.2, por exemplo, possui módulos intercambiáveis que podem incluir sensores de temperatura e umidade ambiente, GPS, e até detectores de CO2 e ozônio.</p><p>Para o público tech, o destaque é a escolha do <i>CircuitPython</i> como linguagem de programação, facilitando a modificação do código e a implementação de novos sensores por entusiastas. Os dados são registrados em formato .CSV em cartões micro-SD, prontos para análise imediata.</p><h3>Fisiologia Vegetal e Índices de Reflectância</h3><p>Para botânicos e ecologistas, os instrumentos STELLA preenchem uma lacuna crítica entre os dados em nível de folha e os dados de satélite. A capacidade de medir a reflectância em 18 bandas permite o cálculo de índices fundamentais para a saúde vegetal:</p><p>1.&nbsp; <b>NDVI (Normalized Difference Vegetation Index)</b>: Utiliza canais de vermelho (680 nm) e infravermelho próximo (810 nm ou 860 nm) para quantificar a biomassa e o vigor da vegetação.</p><p>2.&nbsp; <b>NIRV (Near-Infrared Reflectance of Vegetation)</b>: Um preditor robusto da produtividade primária bruta (GPP) e da fluorescência induzida pelo sol, essencial para estimar a absorção de carbono em tempo real.</p><p>3.&nbsp; <b>Balanço de Energia e Estresse Hídrico</b>: Ao integrar sensores de infravermelho térmico (TIR), o STELLA mede a temperatura da superfície da folha. A comparação entre a temperatura foliar e a do ar permite estimar a evapotranspiração e detectar o fechamento estomático precoce em resposta à seca, muito antes de sinais visíveis como o murchamento.</p><h3>Conexão com a Astrobotânica e Sensoriamento Espacial</h3><p>O projeto STELLA foi desenhado para estar em <i>alinhamento espectral com os satélites Landsat 8 e 9</i>. As bandas de 535, 560 e 585 nm do STELLA coincidem com a banda 3 (Verde) do instrumento OLI do Landsat; já as bandas de 645 e 680 nm alinham-se com a banda 4 (Vermelho), e a de 860 nm com a banda 5 (Infravermelho Próximo).</p><p>Essa compatibilidade permite o que os pesquisadores chamam de "resolução de oportunidade". Enquanto satélites têm períodos de revisita de aproximadamente 8 dias, instrumentos STELLA podem ser implantados <i>en masse</i> no solo para monitorar fenômenos locais de alta cadência temporal. Para a astrobotânica, essa tecnologia é um protótipo do que poderiam ser sistemas de monitoramento em habitats espaciais ou estufas marcianas: instrumentos leves (33g a 450g), reparáveis via impressão 3D e capazes de fornecer diagnósticos rápidos sobre a saúde das plantas em ambientes controlados ou extremos.</p><h3>A Ciência Cidadã como Motor de Inovação</h3><p>O artigo conclui que o STELLA não é apenas uma ferramenta educacional, mas uma plataforma de pesquisa válida. Ao reduzir o custo em ordens de magnitude, a NASA espera que agricultores, silvicultores e cientistas cidadãos ajudem a construir uma rede global de dados ambientais de alta densidade.</p><p>Os arquivos de design, código e instruções de montagem estão disponíveis publicamente no site da NASA (https://science.gsfc.nasa.gov/stella/), <b>convidando a comunidade maker e científica</b> a expandir as fronteiras do que podemos medir sobre a vida na Terra e, potencialmente, além dela.</p>
