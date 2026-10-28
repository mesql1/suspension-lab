# Guia simples do Suspension Lab

Este guia explica o que a aplicação faz, como usar cada parte da tela e como interpretar os resultados. Ele foi escrito para leitores que não precisam conhecer programação, eletrônica ou controle de sistemas.

Aplicação: https://mesql1.github.io/suspension-lab/

## 1. O que a aplicação demonstra

O Suspension Lab mostra como a suspensão de um veículo reduz o movimento que vem das irregularidades da pista. A pista é a entrada do sistema e a carroceria é a saída:

```text
Pista x(t) -> suspensão -> carroceria y(t)
```

Quando a pista sobe e desce rapidamente, uma boa suspensão evita que todo esse movimento chegue à carroceria. Por isso, a suspensão pode ser entendida como um filtro mecânico passa baixas: movimentos lentos passam com mais facilidade, enquanto vibrações rápidas são reduzidas.

## 2. Como começar em dois minutos

1. Abra a aplicação no navegador.
2. Deixe o modo **ESP32 VIRTUAL** selecionado. Ele funciona sem placa física.
3. Observe o carro em movimento e os gráficos sendo atualizados.
4. Clique em um preset, como **Conforto** ou **Esportivo**.
5. Mova os controles de massa, rigidez e amortecimento e compare os resultados.

Não é necessário instalar programas, conectar cabos nem autorizar uma porta serial para usar o modo virtual.

## 3. Os três modos de funcionamento

| Modo | Onde o cálculo acontece | Quando usar |
| --- | --- | --- |
| Simulação | Diretamente no navegador | Para observar o modelo de forma simples e imediata |
| ESP32 Virtual | Em um target emulado no navegador, usando o mesmo protocolo HIL | Modo padrão para demonstrar o fluxo completo sem hardware |
| ESP32 Físico | Em uma placa conectada por USB e Web Serial | Opcional, apenas quando houver uma placa disponível |

No modo ESP32 Virtual, a aplicação ainda cria blocos de amostras, adiciona sequência e CRC, processa o filtro e devolve os resultados como um target real faria. Métricas que dependem de eletrônica, como jitter da interrupção, aparecem como não medidas.

## 4. O que existe na tela

### Cena tridimensional

A parte visual mostra a pista, as rodas e a carroceria. A roda acompanha a entrada `x(t)` e a carroceria acompanha a saída `y(t)`. O deslocamento é ampliado visualmente para facilitar a observação; os gráficos continuam usando os valores físicos reais.

### Parâmetros do sistema

Os três controles principais representam:

| Parâmetro | Significado simples | Efeito mais comum ao aumentar |
| --- | --- | --- |
| Massa `m` | Peso sustentado pela suspensão | O sistema responde mais devagar |
| Rigidez `k` | Força da mola | A suspensão fica mais firme e a frequência natural aumenta |
| Amortecimento `c` | Resistência ao movimento | As oscilações diminuem mais rápido; excesso pode transmitir mais movimento |

Os presets alteram esses valores de uma vez:

- **Conforto:** mola mais macia e bom amortecimento.
- **Esportivo:** mola e amortecimento mais firmes.
- **Subamortecido:** pouca dissipação; o veículo oscila por mais tempo.
- **Superamortecido:** muita resistência; o movimento fica lento e pesado.

### Telemetria do target

Este painel mostra se o target está online e se os blocos estão sendo processados corretamente.

- **RTT:** tempo aproximado para enviar um bloco e receber a resposta.
- **Blocos RX TX:** quantidade recebida e enviada. Os números devem crescer juntos.
- **Perdidos:** blocos que não retornaram.
- **Reordenados:** respostas que chegaram fora da ordem.
- **CRC inválido:** quadros com erro de integridade.
- **Underrun e overflow:** falta ou excesso de dados nas filas.

No ESP32 Virtual, o ideal é observar zero em perdidos, reordenados e CRC inválido.

### Erro target e referência

O navegador calcula uma resposta de referência e compara com a resposta do target. O gráfico mostra `y_target - y_ref`.

- **Erro RMS:** tamanho médio do erro.
- **Erro máximo:** maior diferença observada.

Valores muito próximos de zero indicam que os dois cálculos estão equivalentes.

### Resposta em frequência

O gráfico de Bode mostra quanto cada frequência é transmitida ou reduzida.

- Frequências baixas representam ondulações lentas da pista.
- Frequências altas representam rugosidade e vibração.
- A região próxima da frequência natural pode apresentar amplificação.
- Depois dessa região, a suspensão passa a atenuar as vibrações rápidas.

### Polos e zero

Este painel é uma visão matemática da estabilidade e da dinâmica. Para uma leitura inicial, basta verificar a indicação **Filtro discreto estável** no painel de parâmetros. Os polos detalham a velocidade e a forma da resposta; o zero representa uma característica criada pela ação conjunta da mola e do amortecedor.

### Osciloscópio

Compara a entrada da pista `x(t)` com a saída da carroceria `y(t)` ao longo do tempo. Se a linha da carroceria tiver menor amplitude nas partes rápidas, a suspensão está filtrando essas vibrações.

### Densidade espectral

Mostra quais frequências estão presentes na pista e na carroceria. Compare a entrada e a saída para descobrir quais componentes foram reduzidos.

### Gerador de sinal

- **Ondulação:** movimentos lentos e maiores da pista.
- **Rugosidade:** vibrações mais rápidas.
- **Ruído rosa:** irregularidade aleatória distribuída em várias frequências.
- **Velocidade:** muda o atraso entre o eixo dianteiro e o traseiro.

## 5. O modelo físico

A aplicação usa um modelo simples de massa, mola e amortecedor. A equação é:

```text
m y''(t) + c y'(t) + k y(t) = c x'(t) + k x(t)
```

Nessa equação, `x(t)` é o movimento da pista e `y(t)` é o movimento da carroceria. A massa resiste a mudanças de movimento, a mola tenta recuperar a posição e o amortecedor dissipa energia.

A mesma relação pode ser escrita como função de transferência:

```text
H(s) = Y(s) / X(s) = (c s + k) / (m s^2 + c s + k)
```

Essa função informa como cada frequência da pista aparece na carroceria.

## 6. Frequência natural e amortecimento

A frequência natural é a tendência do sistema de oscilar quando recebe uma perturbação:

```text
omega_n = sqrt(k / m)
f_n = omega_n / (2 pi)
```

Uma mola mais rígida aumenta a frequência natural. Uma massa maior diminui essa frequência.

A razão de amortecimento é:

```text
zeta = c / (2 sqrt(k m))
```

- `zeta < 1`: resposta oscilatória.
- `zeta` próximo de `1`: retorno rápido com pouca oscilação.
- `zeta > 1`: resposta sem oscilação, porém mais lenta.

## 7. Como o computador realiza o cálculo

O modelo original é contínuo, mas o computador trabalha com amostras. A aplicação usa 1.000 amostras por segundo, ou uma amostra a cada 1 ms.

O método de Tustin com pre warp converte a função contínua para um filtro digital de segunda ordem. O resultado é um biquad:

```text
y[n] = b0 x[n] + b1 x[n-1] + b2 x[n-2] - a1 y[n-1] - a2 y[n-2]
```

Em cada nova amostra, o programa combina a entrada atual, duas entradas anteriores e duas saídas anteriores. Os coeficientes `b0`, `b1`, `b2`, `a1` e `a2` são calculados a partir de `m`, `c`, `k` e da frequência de amostragem.

## 8. Como funciona o ESP32 Virtual

O fluxo completo é:

```text
Pista -> bloco de amostras -> protocolo HIL -> target virtual
      <- resultado com a mesma sequência <- filtro biquad
```

Por padrão, cada bloco contém 16 amostras. Cada quadro possui:

- dois bytes de sincronismo;
- tipo da mensagem;
- número de sequência;
- tamanho do conteúdo;
- dados;
- CRC 8 para detectar corrupção.

O número de sequência garante que a resposta seja comparada com o bloco correto. O CRC verifica se o quadro chegou íntegro. O target virtual fragmenta as respostas antes de entregá-las ao parser, exercitando a mesma lógica de recepção usada por uma porta serial.

## 9. Experimentos sugeridos

### Experimento 1 Conforto e esportivo

1. Selecione **Conforto** e observe osciloscópio, Bode e animação.
2. Selecione **Esportivo**.
3. Compare a frequência natural, o movimento da carroceria e a atenuação em altas frequências.

### Experimento 2 Pouco amortecimento

1. Selecione **Subamortecido**.
2. Aumente a ondulação.
3. Observe que a carroceria continua oscilando por mais tempo.

### Experimento 3 Muito amortecimento

1. Selecione **Superamortecido**.
2. Compare com o modo Conforto.
3. Observe que a oscilação diminui, mas a resposta pode ficar lenta e transmitir mais movimento em algumas regiões.

### Experimento 4 Tamanho do bloco

1. Mantenha o ESP32 Virtual ativo.
2. Mude o tamanho do bloco HIL.
3. Observe o número de blocos por segundo e o RTT.
4. Confirme que perdidos, reordenados e CRC inválido permanecem em zero.

## 10. Como saber se está funcionando corretamente

Use esta verificação rápida:

- o modo ESP32 Virtual está marcado e aparece **ONLINE**;
- os números RX e TX aumentam juntos;
- perdidos, reordenados e CRC inválido permanecem em zero;
- o filtro aparece como estável;
- os gráficos mudam quando os parâmetros são alterados;
- o erro target e referência fica próximo de zero.

Se o movimento parar, recarregue a página. Se o modo físico estiver indisponível, use o ESP32 Virtual; ele não depende de Chrome, Edge ou permissão serial.

## 11. Glossário

| Termo | Significado |
| --- | --- |
| Atenuação | Redução da amplitude de um movimento ou vibração |
| Biquad | Filtro digital de segunda ordem |
| CRC | Verificação usada para detectar dados corrompidos |
| FFT | Cálculo que separa um sinal por frequências |
| HIL | Técnica em que um host troca sinais com um target que executa parte do sistema |
| Jitter | Variação do instante em que uma tarefa deveria executar |
| Passa baixas | Sistema que preserva movimentos lentos e reduz movimentos rápidos |
| Polo | Valor matemático ligado à estabilidade e à forma da resposta |
| RTT | Tempo de ida e volta de uma mensagem |
| Target | Componente que recebe entradas, executa o cálculo e devolve saídas |

## 12. Resumo final

O Suspension Lab transforma o modelo de uma suspensão em uma experiência visual e interativa. A pista é a entrada, a carroceria é a saída e o conjunto massa mola amortecedor funciona como filtro. O modo ESP32 Virtual permite demonstrar o protocolo HIL e o cálculo digital sem depender de uma placa física. Para começar, use os presets e compare a animação, o osciloscópio e o gráfico de Bode.
