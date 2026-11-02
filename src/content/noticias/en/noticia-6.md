---
title: "STELLA: NASA Open Science Instrument (Remote Sensing)"
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
lang: "en"
boletim:
  volume: ""
  numero: ""
erratas: []
# --- campos do site atual, preservados como estão ---
id: "noticia-6"
ordem: 9
time: "23:00"
category: "Hardwares and Softwares"
subtitle: "The NASA article titled \"Science and Technology Education for Land and Life Assessment (STELLA): Democratizing Remote Sensing Science with Low-Cost, Open-Source Instruments for Research and Education\" proposes the development of low-cost equipment for use in laboratories."
readingTime: "4 min"
image: "images/noticias/noticia-6-imagem-principal.png"
imageVertical: "images/noticias/noticia-6-imagem-vertical.png"
authorAvatar: "images/integrantes/integrante-pedro.jpeg"
references:
  - text: "MIREL, P., et al, \"Science and Technology Education for Land / Life Assessment (STELLA): Democratizing Remote Sensing Science With Low-Cost Open-Source Instruments for Research and Education\", 2025."
    url: "https://agupubs.onlinelibrary.wiley.com/doi/10.1029/2025CN000284"
---
<p>NASA scientists and engineers, in collaboration with university researchers, recently published details of the STELLA (Science and Technology Education for Land/Life Assessment) project. The goal is to democratize access to high-precision biological remote sensing through low-cost, open-source instruments, enabling anyone with basic electronics knowledge to monitor plant health using tools comparable to orbital technologies.</p><h3>Hardware and Engineering: The "Tricorder" of Modern Botany</h3><p>The STELLA ecosystem consists of two main series of instruments, both based on microcontrollers and state-of-the-art commercial sensors.</p><p><b>STELLA-Q (Quick-to-assemble):</b> A quick-assembly version that requires no tools—only cable connections. Priced at approximately US$ 200, the device employs a trio of spectroscopic sensors (AMS-Osram AS72561/62/63) to measure irradiance across 18 channels in the visible and near-infrared (VNIR) spectrum, covering the 410 to 940 nm range.</p><p><b>STELLA-1 (Series 1.1 and 1.2):</b> More advanced versions requiring soldering on prototyping boards, allowing for the integration of additional sensors. The STELLA-1.2, for example, features interchangeable modules that can include ambient temperature and humidity sensors, GPS, and even CO2 and ozone detectors.</p><p>For the tech-savvy audience, a highlight is the choice of CircuitPython as the programming language, making it easier for enthusiasts to modify the code and implement new sensors. Data is logged in .CSV format onto micro-SD cards, ready for immediate analysis.</p><h3>Plant Physiology and Reflectance Indices</h3><p>For botanists and ecologists, STELLA instruments fill a critical gap between leaf-level data and satellite data. The ability to measure reflectance across 18 bands enables the calculation of indices fundamental to plant health:</p><p><b>1. NDVI (Normalized Difference Vegetation Index):</b> Uses red (680 nm) and near-infrared (810 nm or 860 nm) channels to quantify biomass and vegetation vigor.</p><p><b>2. NIRV (Near-Infrared Reflectance of Vegetation):</b> A robust predictor of gross primary productivity (GPP) and solar-induced fluorescence, essential for estimating carbon uptake in real time.</p><p><b>3. Energy Balance and Water Stress:</b> By integrating thermal infrared (TIR) ​​sensors, STELLA measures leaf surface temperature. Comparing leaf temperature with air temperature allows for the estimation of evapotranspiration and the detection of early stomatal closure in response to drought—well before visible signs such as wilting appear.</p><h3>Connection to Astrobotany and Space-Based Sensing</h3><p>The STELLA project was designed to be spectrally aligned with the Landsat 8 and 9 satellites. STELLA’s 535, 560, and 585 nm bands coincide with Band 3 (Green) of the Landsat OLI instrument; the 645 and 680 nm bands align with Band 4 (Red), and the 860 nm band with Band 5 (Near-Infrared).</p><p>This compatibility enables what researchers call "opportunity resolution." While satellites have revisit periods of approximately eight days, STELLA instruments can be deployed en masse on the ground to monitor local phenomena with high temporal cadence. For astrobotany, this technology serves as a prototype for potential monitoring systems in space habitats or Martian greenhouses: lightweight instruments (33g to 450g) that are repairable via 3D printing and capable of providing rapid diagnostics on plant health in controlled or extreme environments.</p><h3>Citizen Science as a Driver of Innovation</h3><p>The article concludes that STELLA is not merely an educational tool but a valid research platform. By reducing costs by orders of magnitude, NASA hopes that farmers, foresters, and citizen scientists will help build a global network of high-density environmental data.</p><p>The design files, code, and assembly instructions are publicly available on the NASA website (https://science.gsfc.nasa.gov/stella/), inviting the maker and scientific communities to expand the boundaries of what we can measure regarding life on Earth and, potentially, beyond it.</p>
