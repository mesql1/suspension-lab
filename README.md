# SI-Wave Laplace

Laboratório educacional de integridade de sinal em trilhas PCB. Preserva o design escuro minimalista e organiza o experimento nas abas **Sinal, Olho, Reflexões, Frequência e Laplace**.

[Abrir aplicação](https://mesql1.github.io/thermosignal/) · [Repositório](https://github.com/mesql1/thermosignal)

O endereço do repositório permanece `thermosignal`; o produto atual é SI-Wave Laplace. A documentação anterior está em [Legado ThermoSignal](docs/LEGADO-THERMOSIGNAL.md).

## Representação 3D

A área principal inclui uma cena WebGL que acompanha o fluxo normal da página e pode ser recolhida tanto no desktop quanto no celular. Ela representa o substrato, a trilha de cobre, os planos de referência, a fonte, a carga e o ponto de medição `x`. Arraste para orbitar, use a roda para aproximar, pause a propagação ou restaure a câmera.

A geometria acompanha `w`, `h`, `t`, `x` e a escolha entre microstrip e stripline. Os pulsos incidentes percorrem a trilha no sentido fonte→carga; os refletidos retornam com cor associada à polaridade dominante de `ΓL`. A intensidade visual usa `exp(−αℓ)` em Nyquist. A velocidade da animação é deliberadamente didática: o atraso físico calculado aparece no painel, mas é desacelerado para ser visível. A cena representa propagação temporal e não resolve o campo eletromagnético tridimensional completo.

Correção de usabilidade: a versão inicial mantinha a cena fixa e ocupava grande parte da área visível. Esse comportamento foi removido; a cena agora rola com a aplicação, tem altura reduzida e oferece o comando **Recolher cena**.

## Começar

```sh
npm ci
npm run dev
```

Abra o endereço impresso pelo Vite. Para validar e publicar:

```sh
npm run test:si --workspace web
npm run build
```

O build monta automaticamente `web/index.html` e produz `web/dist`. O workflow do GitHub Pages publica pushes na branch `main`.

## Como usar

1. Escolha um preset e clique em **Aplicar preset**.
2. Observe **Sinal**: a entrada sai da fonte, demora para chegar à carga e sofre reflexões.
3. Compare **Olho** para ver a sobreposição de muitos bits; uma abertura menor indica maior dificuldade de distinguir níveis.
4. Use **Reflexões** para acompanhar os trajetos no modelo ideal e **Frequência** para observar atenuação e fase espacial.
5. Em **Laplace**, consulte as equações e os valores calculados para a configuração atual.

Os controles ficam fixos na lateral no desktop. No celular, **Configurar experimento** expande os parâmetros, sem rolagem interna. As abas aceitam setas, Home e End; os demais controles usam navegação padrão por teclado.

## Modelo e cálculos

A geometria microstrip usa Hammerstad–Jensen com correção de espessura. A stripline simétrica usa a aproximação logarítmica de espessura finita Wadell/IPC. Os limites geométricos são informados na interface. As unidades são convertidas para SI antes dos cálculos.

A impedância nominal e a velocidade definem `L = Z0/v` e `C = 1/(Z0*v)`. A resistência contínua é `Rdc = 1/(sigma*w*t)`. A resistência pelicular cresce com a raiz da frequência; sua extensão causal utiliza `sqrt(s)`.

Para perdas dielétricas, o modelo usa uma relaxação de Debye: `Y(s) = s*(Cinf + deltaC/(1+s*tau))`, calibrada em 1 GHz. O tanδ selecionado corresponde a essa frequência; **não é constante em toda a banda**. A tabela compara o G implementado com a referência de tanδ constante.

`gamma(s)` representa atenuação e propagação; `Z0(s)` representa a impedância característica complexa. O canal inclui fonte resistiva e carga casada nominal, aberta, em curto, resistiva, capacitiva ou R em paralelo com C. A transferência é `H(s)=VL(s)/Vs(s)`. O gráfico de H é uma razão de tensões, não S21 de potência.

A rampa tem transformada `(1-exp(-s*tr))/(s²*tr)`. Talbot fixo inverte cada caminho de propagação depois de separar seu atraso analítico, evitando aplicar diretamente o contorno a exponenciais de atraso. O pulso resulta da diferença entre duas rampas. O sinal em x usa os caminhos incidentes e refletidos até essa posição.

O motor calcula 1.025 amostras em Float64 dentro de um Web Worker. Há debounce de 30 ms, cancelamento do cálculo anterior e cache das últimas cinco configurações. O tempo real aparece na interface; 500 ms é uma meta, não uma garantia.

## Olho e métricas

PRBS-7 e PRBS-15 usam LFSRs de período máximo. Uma única resposta de referência gera o pulso de um bit; a superposição linear produz 1.152 bits, com 32 amostras/UI e descarte inicial de 128 bits. O heatmap acumula mais de 500 janelas de 2 UI.

A altura é o percentil 1 dos níveis altos menos o percentil 99 dos baixos, no centro da UI. O jitter pico a pico usa cruzamentos interpolados em torno das bordas esperadas, com limiar médio entre os níveis. DCD é a diferença entre a média dos cruzamentos de subida e descida. A largura é a **estimativa UI menos jitter**, não uma abertura horizontal exata nem medida de BER. Populações com menos de 16 amostras não produzem métricas de olho; o bit isolado serve para inspecionar a resposta, não para estatística.

A janela temporal e a cauda são finitas. O aviso de variação na cauda indica possível erro de truncamento. Não há recuperação de clock, equalização, ruído aleatório, jitter de transmissor ou modelo IBIS.

## Quatro experimentos

1. **Casamento × aberto:** aplique Casado e depois Aberto; compare os patamares, o overshoot e os coeficientes de reflexão.
2. **Carga capacitiva:** aplique Capacitivo e aumente Cin; observe a subida mais lenta e as mudanças no olho.
3. **Comprimento e taxa:** aplique Trilha longa com perdas, varie comprimento e Data Rate; compare a memória do canal em UI e a abertura do olho.
4. **Perdas dielétricas:** mantenha a geometria e varie tanδ; compare alpha, H em Nyquist e os níveis recebidos.

## Validação e limitações

O botão **Validar motor** compara 80 amostras contra reflexões analíticas de uma linha sem perdas, com ZS=25 Ω, ZL=100 Ω e subida de 100 ps. Os testes também verificam unidades, operações complexas, períodos PRBS, terminação, causalidade e consistência entre tempo e frequência. Passar nesses testes não certifica uma placa real.

As fórmulas são empíricas e quase-TEM. Não são modelados vias, conectores, rugosidade, acoplamento entre trilhas, radiação, descontinuidades distribuídas nem dispersão geométrica completa. O diagrama de reflexões é ideal; cargas capacitivas aparecem nele como abertas no limite DC. Os presets PCIe/DDR5 são exemplos didáticos. PCIe Gen4 é limitado a 10 Gbps nesta interface e não reproduz sua taxa nominal de 16 GT/s.

## Arquivo único e offline

`web/index.html` contém todo o HTML, CSS e JavaScript do simulador, sem imports de módulos em runtime. Os fontes de manutenção ficam em `web/src/si`: `numerics.mjs`, `channel.mjs`, `page.html`, testes e `assemble.mjs`. Edite esses fontes e execute o build para regenerar o HTML.

Tailwind 3.4.17 e KaTeX 0.16.11 são carregados por CDN, conforme a especificação. O CSS essencial está embutido. Sem rede, os cálculos e gráficos continuam independentes dessas bibliotecas; as equações usam texto LaTeX como fallback. Para remover a espera pelos CDNs offline, retire suas três tags externas do HTML. Sirva a pasta localmente com `python -m http.server 8080 --directory web` e abra `http://localhost:8080`. Não há backend nem necessidade de ESP32.

## Referências

- [Qucs: fórmulas de microstrip Hammerstad–Jensen](https://qucs.sourceforge.net/tech/node75.html)
- Brian C. Wadell, *Transmission Line Design Handbook*, Artech House, 1991.
- [mpmath: inversão numérica de Laplace e limites do Talbot fixo](https://mpmath.org/doc/current/calculus/inverselaplace.html)
