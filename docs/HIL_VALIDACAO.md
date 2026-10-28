# HIL — montagem, testes e relatório de validação

## 0. Uso sem hardware

O modo **ESP32 VIRTUAL** é o padrão e não exige montagem, driver, cabo ou navegador com Web Serial. Ele processa os mesmos blocos, coeficientes, sequências e CRC do caminho físico. As métricas dependentes de eletrônica — jitter da ISR, overruns reais e latência USB — aparecem como não medidas, pois não seria correto inferi-las a partir do emulador.

Para validar sem placa:

1. abra o site em qualquer navegador moderno;
2. confirme **ESP32 VIRTUAL** na barra de modos;
3. altere massa, amortecimento, rigidez e tamanho do bloco;
4. observe `BLOCOS RX/TX`, RTT emulado e o erro target × referência;
5. selecione **SIMULAÇÃO** para comparar com o processamento local direto.

As seções seguintes são opcionais e se aplicam apenas a quem dispõe de hardware.

## 1. Materiais

- ESP32 DevKit v1;
- cabo USB com dados;
- Chrome ou Edge;
- driver CP2102 ou CH340 conforme a placa;
- opcional: osciloscópio ou analisador lógico para o GPIO 2.

Não há ligação externa obrigatória: alimentação e UART usam o cabo USB.

## 2. Gravação

```bash
cd firmware
pio run
pio run -t upload
```

Se necessário, configure `upload_port = COM5` no ambiente do `platformio.ini`, substituindo a porta.

## 3. Uso

1. Abra <https://mesql1.github.io/suspension-lab/> em Chrome ou Edge.
2. Clique em **ESP32 FÍSICO**.
3. Selecione a porta CP2102/CH340 e autorize.
4. Aguarde a pré-carga de 32 amostras.
5. Observe STATUS HIL e `y_target − y_ref`.
6. Para voltar ao DSP local, clique em **SIMULAÇÃO**.

Se o cabo for removido, o app retorna automaticamente à Simulação.

## 4. Medição externa da ISR

O GPIO 2 sobe na entrada da ISR e desce na saída:

- período entre bordas de subida: período real;
- variação em relação a 1.000 µs: jitter;
- largura do pulso: tempo de execução.

## 5. Teste de degrau

Para um ensaio reproduzível, altere temporariamente `generateRoadSample()` para `t < 1 ? 0 : 0.05`.

1. Execute Simulação e HIL com os mesmos parâmetros.
2. Descarte o transitório.
3. Confira convergência para 0,05 m, pois `H(0)=1`.
4. Registre erro RMS/máximo.

Aceitação sugerida: nenhum NaN/Inf, estabilidade positiva, RMS abaixo de 100 µm após o transitório e nenhum overrun.

## 6. Varredura senoidal

Para `f` entre 0,1 e 100 Hz, aplique `x[n] = A sin(2πfn/fs)`. Descarte cinco constantes de tempo, estime amplitude/fase por correlação e compare com `H(jω)` e principalmente com `H(e^jθ)`, que é a referência discreta do firmware.

## 7. Estresse

Durante pelo menos cinco minutos:

- alterne presets rapidamente;
- varie amplitudes de entrada;
- teste blocos 4, 16, 32 e 60;
- remova e reconecte o cabo;
- coloque a aba em segundo plano;
- force carga gráfica com OrbitControls.

Verifique fallback, ressincronização, contadores de sequência, rejeição de parâmetros inválidos e ausência de reset artificial dos estados.

## 8. Resultados verificados

| Medição | Resultado | Ambiente |
| --- | --- | --- |
| Testes Vitest | 9/9 aprovados | Windows, Node.js 24 |
| Parser fragmentado/corrompido | aprovado | teste automatizado |
| Ganho DC, degrau e FFT | aprovados | teste automatizado |
| Build Vite | aprovado | Vite 7 |
| Build ESP32 | aprovado | PlatformIO 6.2, `esp32dev` |
| RAM firmware | 34.556 / 327.680 B (10,5%) | linker |
| Flash firmware | 299.129 / 1.310.720 B (22,8%) | linker |
| Jitter físico | não medido | requer ESP32 |
| RTT USB real | não medido | requer ESP32 |
| Erro RMS físico | não medido | requer ESP32 |
| Overruns reais | não medido | requer ESP32 |

Não foram inventados valores dependentes do hardware.

## 9. Tabela de relatório

| Data | Placa | Conversor | SO/navegador | N | RTT ms | jitter máx. µs | jitter méd. µs | underruns | overruns | RMS µm | máx. µm |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| | | | | 16 | | | | | | | |

Inclua captura do GPIO 2, commit, parâmetros, duração e reconexões.

## 10. Latência correta

A duração do biquad deve ser muito menor que 1 ms, mas o ciclo completo inclui formação do bloco, Web Serial, USB/driver, jitter buffer de 32 ms, espera do timer, retorno e agendamento JavaScript. O painel separa essas parcelas para evitar uma conclusão enganosa.
