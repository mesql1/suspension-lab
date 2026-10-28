# Documentação técnica — Suspension Lab

## 1. Visão geral

O Suspension Lab é um simulador didático que trata a suspensão de um veículo como um filtro mecânico passa-baixas. A irregularidade vertical da pista é o sinal de entrada `x(t)`, e o deslocamento vertical da massa suspensa — chassi e cabine — é o sinal de saída `y(t)`.

A aplicação reúne quatro áreas:

1. um motor DSP executado a uma taxa fixa de 1.000 Hz;
2. painéis analíticos desenhados com Canvas 2D;
3. uma cena 3D renderizada com Three.js/React Three Fiber;
4. controles React para modificar o sistema em tempo real.

O site publicado está disponível em:

<https://mesql1.github.io/suspension-lab/>

## 2. Fluxo geral de dados

```text
                  ┌───────────────────────────────┐
                  │ Gerador da pista x(t)         │
                  │ senos + ruído rosa            │
                  └───────────────┬───────────────┘
                                  │ 1.000 amostras/s
                                  ▼
          ┌────────────────────────────────────────────┐
          │ Histórico circular da pista                │
          │ frente: xFront                             │
          │ traseira: xRear = xFront atrasado por L/v  │
          └──────────────┬─────────────────┬───────────┘
                         │                 │
                         ▼                 ▼
                ┌──────────────┐  ┌──────────────┐
                │ IIR dianteiro│  │ IIR traseiro │
                └──────┬───────┘  └──────┬───────┘
                       │ yFront           │ yRear
                       └─────────┬─────────┘
                                 ▼
                  y = (yFront + yRear) / 2
                  pitch = atan2(yFront-yRear, L)
                                 │
          ┌──────────────────────┼──────────────────────┐
          ▼                      ▼                      ▼
     Cena 3D              Ring buffers x/y       Painéis Canvas
 rodas, chassi,           32.768 amostras        osciloscópio e FFT
 inclinação e pista
```

O motor de simulação é a fonte única dos dados. React controla apenas parâmetros de interface; as atualizações em alta frequência usam objetos mutáveis, referências e `useFrame`, evitando uma nova renderização React a cada quadro.

## 3. Modelo físico

### 3.1 Sistema massa–mola–amortecedor

O modelo possui:

| Símbolo | Significado | Unidade |
| --- | --- | --- |
| `m` | massa suspensa | kg |
| `c` | coeficiente de amortecimento | N·s/m |
| `k` | rigidez da mola | N/m |
| `x(t)` | deslocamento imposto pela pista | m |
| `y(t)` | deslocamento absoluto da carroceria | m |

As forças da mola e do amortecedor dependem do movimento relativo entre a pista e a massa:

```text
F_mola = k(x - y)
F_amortecedor = c(x' - y')
```

Aplicando a segunda lei de Newton à massa suspensa:

```text
m y'' = c(x' - y') + k(x - y)
```

Reorganizando:

```text
m y'' + c y' + k y = c x' + k x
```

Essa é a equação diferencial usada como base para todo o simulador.

### 3.2 Função de transferência

Aplicando a transformada de Laplace com condições iniciais nulas:

```text
(m s² + c s + k)Y(s) = (c s + k)X(s)
```

Portanto:

```text
       Y(s)       c s + k
H(s) = ──── = ─────────────
       X(s)   m s² + c s + k
```

Propriedades importantes:

- em corrente contínua, `H(0) = 1`: uma elevação muito lenta da pista é acompanhada pela carroceria;
- em altas frequências, `|H(jω)| ≈ c/(mω)`: vibrações rápidas são atenuadas;
- o numerador possui um zero real em `s = -k/c`;
- o denominador possui dois polos, que determinam a ressonância e o amortecimento.

### 3.3 Frequência natural, amortecimento e fator de qualidade

A frequência natural não amortecida é:

```text
ωn = √(k/m)            [rad/s]
fn = ωn/(2π)           [Hz]
```

A razão de amortecimento é:

```text
        c
ζ = ─────────
    2√(km)
```

O fator de qualidade exibido pela interface é:

```text
      1
Q = ────
     2ζ
```

Interpretação de `ζ`:

- `0 < ζ < 1`: sistema subamortecido, com polos complexos conjugados;
- `ζ = 1`: amortecimento crítico;
- `ζ > 1`: sistema superamortecido, com dois polos reais;
- quanto menor `ζ`, mais pronunciado tende a ser o pico de ressonância.

Com os valores iniciais `m = 340 kg`, `c = 3.200 N·s/m` e `k = 32.000 N/m`:

```text
ωn ≈ 9,70 rad/s
fn ≈ 1,54 Hz
ζ  ≈ 0,49
Q  ≈ 1,03
```

### 3.4 Polos e zero contínuos

O zero do numerador é:

```text
sz = -k/c
```

Os polos são as raízes de `m s² + c s + k = 0`:

```text
          -c ± √(c² - 4mk)
s1,2 = ─────────────────────
                  2m
```

O discriminante `c² - 4mk` determina se os polos são reais ou complexos. O painel de polos e zero usa essas expressões diretamente, sem aproximações numéricas iterativas.

## 4. Sinal da pista

### 4.1 Componentes determinísticas

O sinal produzido em `SimulationEngine.generateRoadSample()` soma ondulações lentas, rugosidades rápidas e ruído rosa:

```text
x(t) = x_low(t) + x_high(t) + A_noise · pink(t)
```

Ondulações de baixa frequência:

```text
x_low(t) = A_low [
    0,72 sin(2π·0,42t + 0,3)
  + 0,28 sin(2π·1,15t + 1,7)
]
```

Rugosidade de alta frequência:

```text
x_high(t) = A_high [
    0,58 sin(2π·13t + 0,8)
  + 0,27 sin(2π·27t + 2,2)
  + 0,15 sin(2π·46t + 0,1)
]
```

Essas frequências foram escolhidas para deixar visível a diferença entre movimentos lentos, que atravessam o sistema, e vibrações rápidas, que são atenuadas.

### 4.2 Ruído rosa

O ruído rosa é produzido pelo filtro de Paul Kellet, implementado em `src/dsp/noise.js`. Um gerador `xorshift32` produz ruído branco reproduzível; sete estados recursivos ponderam diferentes regiões do espectro.

O resultado possui aproximadamente uma redução de 3 dB por oitava, ou densidade espectral proporcional a `1/f`. Isso o torna mais adequado para representar superfícies naturais do que ruído branco, que distribui a mesma potência por hertz.

O estado do gerador é mantido entre amostras e nenhuma estrutura é alocada dentro da função de geração.

## 5. Discretização do filtro

### 5.1 Por que o filtro não roda a 60 Hz

A taxa de quadros da cena 3D não é uma taxa adequada para DSP. Se o filtro operasse diretamente a 60 Hz, a frequência de Nyquist seria apenas 30 Hz e a componente de 46 Hz da pista sofreria aliasing.

O projeto usa:

```text
fs = 1.000 Hz
Ts = 1/fs = 0,001 s
fNyquist = fs/2 = 500 Hz
```

Assim, todas as componentes exibidas até 100 Hz ficam bem abaixo de Nyquist.

### 5.2 Transformação bilinear com pre-warp

A transformação bilinear padrão é:

```text
        2   1 - z⁻¹
s = ───── · ───────
       Ts   1 + z⁻¹
```

Ela mapeia todo o semiplano esquerdo de `s` para dentro do círculo unitário de `z`, mas deforma o eixo de frequências. Para manter a frequência natural na posição correta, o simulador usa pre-warp em `ωn`:

```text
            ωn
K = ─────────────────
    tan(ωn Ts / 2)
```

e substitui:

```text
          1 - z⁻¹
s = K · ─────────
          1 + z⁻¹
```

Quando `Ts` é pequeno, `tan(ωnTs/2) ≈ ωnTs/2`, portanto `K ≈ 2/Ts`. A diferença é justamente a correção necessária para que a transformação seja exata na frequência escolhida.

### 5.3 Dedução dos coeficientes

Partindo de:

```text
         c s + k
H(s) = ─────────────
       m s² + c s + k
```

defina `q = z⁻¹` e substitua `s = K(1-q)/(1+q)`:

```text
                   cK(1-q)/(1+q) + k
H(z) = ─────────────────────────────────────────────
       mK²(1-q)²/(1+q)² + cK(1-q)/(1+q) + k
```

Multiplicando numerador e denominador por `(1+q)²`:

```text
Numerador = cK(1-q)(1+q) + k(1+q)²
           = cK(1-q²) + k(1+2q+q²)
```

Agrupando por potências de `q`:

```text
B0 = cK + k
B1 = 2k
B2 = k - cK
```

Para o denominador:

```text
Denominador = mK²(1-q)² + cK(1-q)(1+q) + k(1+q)²
```

Expandindo:

```text
mK²(1-2q+q²) + cK(1-q²) + k(1+2q+q²)
```

Logo:

```text
A0 =  mK² + cK + k
A1 = -2mK² + 2k
A2 =  mK² - cK + k
```

Dividindo todos os termos por `A0`:

```text
b0 = B0/A0
b1 = B1/A0
b2 = B2/A0
a1 = A1/A0
a2 = A2/A0
```

A função de transferência discreta normalizada é:

```text
          b0 + b1z⁻¹ + b2z⁻²
H(z) = ─────────────────────────
          1 + a1z⁻¹ + a2z⁻²
```

e sua equação de diferenças é:

```text
y[n] = b0x[n] + b1x[n-1] + b2x[n-2]
                  - a1y[n-1] - a2y[n-2]
```

O estado mínimo necessário é formado por `x1`, `x2`, `y1` e `y2`. A função `processarAmostra()` altera esse estado in-place.

### 5.4 Mudança de parâmetros em tempo real

Quando `m`, `c` ou `k` muda:

1. os novos coeficientes são calculados imediatamente;
2. os estados `x1`, `x2`, `y1` e `y2` são preservados;
3. a amostra seguinte usa os novos coeficientes sobre o histórico existente.

Preservar o estado evita o salto que ocorreria se a saída fosse zerada. Uma mudança muito brusca de parâmetros ainda pode gerar um transiente físico, mas o filtro não sofre um reset artificial.

### 5.5 Estabilidade discreta

Os polos discretos são as raízes de:

```text
z² + a1z + a2 = 0
```

Portanto:

```text
        -a1 ± √(a1² - 4a2)
z1,2 = ─────────────────────
                  2
```

O sistema discreto é BIBO-estável quando:

```text
|z1| < 1  e  |z2| < 1
```

`gerarCoeficientes()` calcula os dois polos e expõe a propriedade booleana `stable`, usada pelo indicador visual da interface.

## 6. Relógio e sub-stepping

O React Three Fiber chama `engine.advance(delta)` uma vez por quadro. `delta` é o tempo real decorrido desde o quadro anterior.

O motor acumula esse tempo:

```text
accumulator += min(delta, 0,1 s)
```

Enquanto houver pelo menos `Ts = 0,001 s` acumulado, uma amostra DSP é processada:

```text
while accumulator >= Ts:
    step()
    accumulator -= Ts
```

Há um limite defensivo de 120 passos por quadro. O `delta` também é limitado a 100 ms para impedir que uma aba suspensa tente recuperar milhares de amostras de uma vez ao voltar ao primeiro plano.

Esse padrão desacopla duas escalas de tempo:

- renderização: normalmente 60 quadros/s;
- simulação: exatamente 1.000 amostras/s durante a execução normal.

## 7. Eixos dianteiro e traseiro

O entre-eixos adotado é:

```text
L = 2,72 m
```

Se o veículo se desloca a uma velocidade `v`, a roda traseira encontra a mesma irregularidade após:

```text
         L
tdelay = ─
         v
```

Em amostras:

```text
Ndelay = tdelay · fs
```

O sinal da roda dianteira é salvo no histórico circular. A roda traseira lê uma amostra anterior desse mesmo histórico. Cada eixo possui seu próprio estado IIR, produzindo `yFront` e `yRear`.

A posição média da carroceria é:

```text
y = (yFront + yRear)/2
```

e a inclinação longitudinal é:

```text
pitch = atan2(yFront - yRear, L)
```

## 8. Buffers circulares

`RingBuffer` armazena os históricos em `Float64Array`. Cada buffer possui 32.768 posições, equivalentes a aproximadamente 32,768 segundos a 1 kHz.

São mantidos três históricos:

- `roadHistory`: pista usada para atrasos espaciais;
- `input`: média das entradas dianteira e traseira;
- `output`: média das saídas dianteira e traseira.

A escrita é `O(1)`:

```text
data[index] = value
index = (index + 1) mod size
```

Quando o final do vetor é atingido, o índice retorna ao início. Não há `shift()`, redimensionamento ou alocação por amostra.

## 9. Resposta em frequência e diagrama de Bode

### 9.1 Resposta contínua

Substituindo `s = jω`:

```text
              k + jcω
H(jω) = ───────────────────
         k - mω² + jcω
```

A magnitude é:

```text
           √(k² + c²ω²)
|H(jω)| = ─────────────────────
           √((k-mω²)² + c²ω²)
```

Em decibéis:

```text
MdB = 20 log10(|H(jω)|)
```

A fase é calculada pela diferença entre os argumentos do numerador e do denominador:

```text
φ(ω) = atan2(cω, k) - atan2(cω, k-mω²)
```

### 9.2 Resposta discreta

Para cada frequência, o código avalia a função discreta no círculo unitário:

```text
z = exp(jω/fs)
z⁻¹ = exp(-jω/fs)
```

Logo:

```text
              b0 + b1e⁻ʲθ + b2e⁻ʲ²θ
H(eʲθ) = ──────────────────────────────
              1 + a1e⁻ʲθ + a2e⁻ʲ²θ

θ = ω/fs
```

O gráfico usa 360 frequências logaritmicamente espaçadas entre 0,1 e 100 Hz. A curva contínua e a discreta ficam sobrepostas, tornando visível o efeito da discretização.

### 9.3 Frequência de corte

O algoritmo localiza primeiro o maior valor de magnitude e, a partir dele, procura a primeira travessia descendente de `-3 dB`. Esse critério evita marcar uma travessia anterior ao pico de ressonância.

## 10. Osciloscópio

O osciloscópio copia as 2.000 amostras mais recentes dos buffers, correspondentes a 2 segundos.

A escala vertical é adaptativa:

```text
ymax = 1,12 · max(|x[n]|, |y[n]|, 0,04)
```

O Canvas reduz a quantidade de pontos desenhados quando há mais amostras que pixels horizontais. Isso mantém a forma do sinal sem tentar desenhar segmentos indistinguíveis.

A atualização visual é limitada a aproximadamente 30 Hz, enquanto o DSP continua rodando a 1 kHz.

## 11. FFT radix-2

### 11.1 Tamanho e resolução

O espectro usa:

```text
N = 2.048 amostras
fs = 1.000 Hz
Δf = fs/N ≈ 0,4883 Hz
```

A FFT calcula até 500 Hz, mas o painel apresenta os bins entre 0 e 100 Hz.

### 11.2 Janela de Hann

Antes da transformada, cada amostra é multiplicada por:

```text
            1          2πn
w[n] = ───────── - ───────── cos(─────)
          2            2       N-1
```

ou, de forma equivalente:

```text
w[n] = 0,5 - 0,5 cos(2πn/(N-1))
```

A janela reduz vazamento espectral quando uma senoide não contém um número inteiro de ciclos no bloco analisado.

### 11.3 Algoritmo Cooley–Tukey

A implementação própria usa FFT radix-2 iterativa:

1. valida que `N` é uma potência de dois;
2. reordena os dados por inversão de bits;
3. executa estágios de borboletas de tamanhos `2, 4, 8, ..., N`;
4. combina pares par/ímpar com fatores de rotação `e^(-j2πk/N)`.

A complexidade cai de `O(N²)` para `O(N log₂N)`.

A magnitude unilateral é:

```text
             2
M[k] = ───────────── √(Re[k]² + Im[k]²)
             N
```

e a exibição em decibéis usa:

```text
MdB[k] = 20 log10(max(M[k], 10⁻⁸))
```

O piso evita `log(0)` e limita o menor valor a aproximadamente `-160 dB` antes do recorte visual.

O espectro é recalculado aproximadamente a cada 180 ms, reduzindo custo de CPU.

## 12. Cena 3D

### 12.1 Veículo

As quatro rodas acompanham diretamente `xFront` ou `xRear`. A carroceria acompanha a média filtrada `y`, e seu `rotation.x` usa o pitch calculado entre os eixos.

Para facilitar a leitura visual, os deslocamentos verticais são multiplicados por `3,2`. O pitch também recebe ganho visual. Esses ganhos afetam apenas a cena; os gráficos e cálculos continuam em unidades físicas reais.

As posições são escritas diretamente nas meshes dentro de `useFrame`. Não há `setState` por quadro.

### 12.2 Pista rolante

A pista é uma `BufferGeometry` com:

```text
10 segmentos na largura  → 11 vértices por linha
90 segmentos no comprimento → 91 linhas
total = 11 · 91 = 1.001 vértices
```

Em cada quadro, somente a coordenada vertical dos vértices é alterada. O atributo de posição é marcado com `needsUpdate = true`, permitindo que Three.js envie o buffer atualizado para a GPU.

As normais são recalculadas a cada oito quadros, não a cada quadro. Isso reduz o custo de CPU mantendo a iluminação coerente.

As faixas centrais se deslocam conforme:

```text
offset = (tempo · velocidade) mod 4
```

O operador módulo cria a impressão de pista infinita sem gerar novos objetos.

### 12.3 Iluminação e câmera

A cena usa luz ambiente, luz hemisférica, luz direcional com sombras e uma luz pontual de destaque. Toda a iluminação é local; não há HDR ou textura externa necessária para o funcionamento.

`OrbitControls` permite orbitar e aproximar a câmera, com limites de distância e ângulo polar.

## 13. Estado React e integração

`App.jsx` mantém os parâmetros controláveis em estado React:

```text
m, c, k, speed, waveAmplitude, roughnessAmplitude, noiseAmplitude
```

O `SimulationEngine` é criado uma única vez com `useMemo`. Ao alterar um slider:

1. o estado React é atualizado para redesenhar valores, métricas e gráficos estáticos;
2. `engine.setParams()` atualiza imediatamente o motor mutável;
3. o loop 3D continua lendo `engine.current` sem esperar outro ciclo de renderização.

Os gráficos se dividem em dois grupos:

- Bode e polos/zero: redesenhados quando `m`, `c` ou `k` muda;
- osciloscópio e FFT: redesenhados por `requestAnimationFrame` em cadências controladas.

## 14. Presets

| Preset | `m` (kg) | `k` (N/m) | `c` (N·s/m) | Efeito esperado |
| --- | ---: | ---: | ---: | --- |
| Conforto | 360 | 24.000 | 3.600 | frequência natural menor e resposta mais suave |
| Esportivo | 320 | 52.000 | 4.800 | suspensão mais rígida e frequência natural maior |
| Subamortecido | 340 | 36.000 | 900 | pico de ressonância mais pronunciado |
| Superamortecido | 340 | 30.000 | 9.000 | resposta lenta e sem oscilação significativa |

Os presets usam exatamente o mesmo caminho de atualização dos sliders, portanto também preservam os estados internos dos filtros.

## 15. Estrutura do projeto

```text
suspension-lab/
├── .github/workflows/deploy-pages.yml
├── docs/
│   └── DOCUMENTACAO_TECNICA.md
├── src/
│   ├── components/
│   │   ├── charts/
│   │   │   ├── BodePlot.jsx
│   │   │   ├── Oscilloscope.jsx
│   │   │   ├── PoleZeroPlot.jsx
│   │   │   ├── SpectrumPlot.jsx
│   │   │   └── canvas.js
│   │   ├── three/
│   │   │   ├── RollingRoad.jsx
│   │   │   ├── SimulationScene.jsx
│   │   │   └── Vehicle.jsx
│   │   ├── Panel.jsx
│   │   └── ParameterControls.jsx
│   ├── dsp/
│   │   ├── biquad.js
│   │   ├── fft.js
│   │   ├── frequency.js
│   │   ├── noise.js
│   │   ├── ringBuffer.js
│   │   └── dsp.test.js
│   ├── hooks/useCanvasSize.js
│   ├── simulation/SimulationEngine.js
│   ├── App.jsx
│   ├── main.jsx
│   └── styles.css
├── index.html
├── package.json
├── tailwind.config.js
└── vite.config.js
```

## 16. Testes automatizados

`src/dsp/dsp.test.js` verifica três propriedades:

1. o ganho DC do biquad é unitário e seus polos estão dentro do círculo unitário;
2. a resposta a uma entrada degrau converge para 1;
3. a FFT identifica corretamente uma senoide colocada exatamente em um bin conhecido.

Execução:

```bash
npm test
```

Build de produção:

```bash
npm run build
```

## 17. GitHub Pages

O Vite usa:

```js
base: '/suspension-lab/'
```

Isso faz com que CSS e JavaScript sejam referenciados pelo caminho correto de um GitHub Project Page.

O workflow `.github/workflows/deploy-pages.yml` executa:

1. checkout da branch `main`;
2. configuração do Node.js;
3. `npm ci`;
4. `npm run build`;
5. upload da pasta `dist`;
6. deploy com `actions/deploy-pages`.

Cada push em `main` publica automaticamente uma nova versão.

## 18. Como executar localmente

Requisitos:

- Node.js 22 ou mais recente;
- npm.

```bash
git clone https://github.com/mesql1/suspension-lab.git
cd suspension-lab
npm install
npm run dev
```

O Vite exibirá o endereço local no terminal.

## 19. Pontos de extensão

### Adicionar uma frequência de pista

Edite `generateRoadSample()` em `src/simulation/SimulationEngine.js` e adicione outro termo senoidal. A frequência deve permanecer abaixo de 500 Hz; na prática, mantenha margem significativa em relação a Nyquist.

### Alterar a taxa DSP

Modifique `this.fs` no construtor do motor. Os coeficientes, atrasos e eixos de frequência são derivados de `fs`, mas o custo de CPU cresce aproximadamente de forma linear com a taxa.

### Adicionar outro modelo de suspensão

Crie um novo gerador de coeficientes em `src/dsp/` com a mesma interface de `gerarCoeficientes()` e mantenha `processarAmostra()` compatível com a ordem do filtro.

### Alterar a geometria do veículo

Substitua as meshes primitivas em `Vehicle.jsx`. A lógica dinâmica depende apenas das referências dos grupos das rodas e da carroceria.

## 20. Limitações conhecidas

- O modelo representa um quarto de veículo estendido para dois eixos; não inclui dinâmica independente de cada canto, rolagem lateral, pneu como mola ou massa não suspensa.
- O atraso traseiro usa amostras inteiras do buffer. Não há interpolação para atrasos fracionários.
- Os ganhos visuais da cena exageram deslocamento e pitch para fins didáticos.
- A mudança de coeficientes preserva estado, mas não realiza interpolação gradual entre filtros.
- A resposta de frequência é linear e não modela batentes, atrito seco ou outras não linearidades reais.

Essas simplificações são deliberadas: o objetivo principal é tornar visível a relação entre sistema mecânico, função de transferência, filtro digital e resposta observada.
