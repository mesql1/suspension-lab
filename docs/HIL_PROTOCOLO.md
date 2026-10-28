# HIL — arquitetura e protocolo binário

## 1. Arquitetura

```text
┌──────────────────────────────────────────────────────────────┐
│ Host — navegador Chromium                                    │
│ pista x[n] → blocos → Web Serial → associação por seq        │
│      ├──────── filtro JS de referência ────────┐             │
│      └──────── ESP32 → y_target ───────────────┼→ erro/3D    │
└──────────────────────────┬───────────────────────────────────┘
                           │ USB-UART 921.600 baud, 8N1
┌──────────────────────────▼───────────────────────────────────┐
│ Target — ESP32 DevKit v1                                    │
│ Core 0: UART, parser, CRC, FIFO e empacotamento              │
│ Core 1: timer ISR 1 kHz, DF-II transposta em double          │
└──────────────────────────────────────────────────────────────┘
```

O navegador não tenta temporizar uma escrita a cada 1 ms. Ele gera amostras em um relógio lógico de 1 kHz e envia blocos, por padrão com `N = 16`. O timer do ESP32 é o relógio físico do filtro.

## 2. Formato do quadro

Todos os inteiros e `float32` usam little-endian. O quadro não possui padding.

| Offset | Campo | Tamanho | Descrição |
| ---: | --- | ---: | --- |
| 0 | Sync 0 | 1 byte | constante `0xAA` |
| 1 | Sync 1 | 1 byte | constante `0xBB` |
| 2 | Tipo | 1 byte | identificador da mensagem |
| 3 | Sequência | 2 bytes | `uint16`, incrementa com wrap em 65.535 |
| 5 | Comprimento | 1 byte | número de bytes do payload, 0–255 |
| 6 | Payload | `len` bytes | conteúdo específico do tipo |
| `6+len` | CRC-8 | 1 byte | CRC sobre `tipo + seq + len + payload` |

Tamanho total: `Lframe = 7 + len` bytes.

Os bytes de sincronismo não entram no CRC, permitindo procurar o header durante a ressincronização sem alterar o cálculo.

## 3. CRC

O algoritmo é CRC-8/ATM:

| Propriedade | Valor |
| --- | --- |
| Polinômio | `0x07` (`x⁸ + x² + x + 1`) |
| Inicial | `0x00` |
| RefIn/RefOut | falso |
| XOR final | `0x00` |

```text
crc = crc XOR byte
repetir 8 vezes:
  se bit 7 = 1: crc = (crc << 1) XOR 0x07
  caso contrário: crc = crc << 1
```

## 4. Tipos de mensagem

### `0x01` — SAMPLES, host → target

| Campo do payload | Tipo | Tamanho |
| --- | --- | ---: |
| `x[0..N-1]` | `float32[N]` | `4N` bytes |

`N = len/4`. O host aceita blocos de 4 a 60 amostras; o padrão é 16. O `seq` identifica o bloco, e cada amostra na FIFO carrega também seu índice e a contagem total.

### `0x02` — PARAMS, host → target

| Offset | Campo | Tipo |
| ---: | --- | --- |
| 0 | `m` | float32 |
| 4 | `c` | float32 |
| 8 | `k` | float32 |

Comprimento fixo: 12 bytes.

| Parâmetro | Mínimo | Máximo |
| --- | ---: | ---: |
| `m` | 180 kg | 650 kg |
| `c` | 100 N·s/m | 12.000 N·s/m |
| `k` | 10.000 N/m | 90.000 N/m |

O target calcula o banco inativo, verifica seus polos e só então agenda uma troca atômica entre amostras.

### `0x03` — RESULT, target → host

| Offset | Campo | Tipo | Tamanho |
| ---: | --- | --- | ---: |
| 0 | timestamp da primeira amostra | uint32 µs | 4 bytes |
| 4 | `y[0..N-1]` | float32[N] | `4N` bytes |

O `seq` repete o número do SAMPLES. O host recupera por ele exatamente o bloco `x` e a referência correspondentes.

### `0x04` — STATUS, target → host

Enviado aproximadamente uma vez por segundo.

| Offset | Campo | Tipo | Descrição |
| ---: | --- | --- | --- |
| 0 | jitter máximo | float32 µs | máximo desde o STATUS anterior |
| 4 | jitter médio | float32 µs | média desde o STATUS anterior |
| 8 | overruns da ISR | uint32 | execução com duração ≥ 1 ms |
| 12 | underruns | uint32 | FIFO vazia; última entrada mantida |
| 16 | overflows | uint32 | entrada ou saída sem espaço |
| 20 | erros de CRC | uint32 | acumulado do parser target |
| 24 | bytes descartados | uint32 | acumulado de ressincronização |
| 28 | flags | uint8 | bits abaixo |

| Bit | Máscara | Significado quando 1 |
| ---: | ---: | --- |
| 0 | `0x01` | coeficientes ativos estáveis |
| 1 | `0x02` | FIFO de entrada vazia |
| 2 | `0x04` | FIFO de saída encheu desde o último STATUS |

### `0x05` — PING/RESET, bidirecional

Payload de um byte: `0` faz ping; `1` limpa estados, FIFOs e contadores. O target ecoa o quadro, e o host mede RTT com `performance.now()`.

## 5. Ressincronização e falhas

O parser é incremental e independe da fragmentação do `ReadableStream`:

1. procura `0xAA` e confirma `0xBB`;
2. lê o header e aguarda `len` bytes;
3. valida CRC;
4. se falhar, descarta o primeiro byte do candidato e volta ao header.

Um `0xAA` no final de um fragmento é preservado. O host conta CRCs inválidos, bytes descartados, lacunas de sequência, respostas órfãs e blocos pendentes descartados.

## 6. Largura de banda

Para `N = 16`:

```text
SAMPLES: payload 64 B, quadro 71 B
blocos/s = 1000/16 = 62,5
host → target = 71 · 62,5 = 4.437,5 B/s

RESULT: payload 4 + 64 = 68 B, quadro 75 B
target → host = 75 · 62,5 = 4.687,5 B/s
```

STATUS adiciona 36 B/s. PARAMS e PING são esporádicos.

UART 8N1 usa dez bits físicos por byte:

```text
capacidade por direção = 921.600/10 = 92.160 B/s
host → target ≈ 4,82%
target → host ≈ 5,13%
```

Como o link é full-duplex, cada direção possui capacidade própria. A soma dos dois fluxos equivale a aproximadamente 10% de uma direção.

## 7. Jitter buffer e latência

O firmware espera 32 amostras antes de iniciar:

```text
latência do jitter buffer = 32/1000 = 32 ms
```

Isso absorve jitter do navegador/USB, mas impede prometer latência ponta a ponta inferior a 2 ms. A meta de 1 ms refere-se ao período da ISR; o painel separa RTT, one-way estimada, jitter buffer e jitter do target.

## 8. Biquad no target

O ESP32 usa Direct Form II Transposta:

```text
y  = b0 x + s1
s1 = b1 x - a1 y + s2
s2 = b2 x - a2 y
```

A forma usa apenas dois estados. Coeficientes e estados são `double`, pois `fn ≈ 1 Hz` com `fs = 1 kHz` coloca polos próximos de `z = 1`; `float32` acumularia mais erro. O custo real é monitorado pelo contador `isrOverruns`.
