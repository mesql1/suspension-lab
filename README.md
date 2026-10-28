# Suspension Lab HIL

Plataforma Hardware-in-the-Loop para demonstrar uma suspensão veicular como filtro mecânico passa-baixas. O navegador gera a pista e renderiza os painéis/3D; no modo HIL, um ESP32 DevKit v1 executa o biquad a 1 kHz e devolve a resposta por USB-UART.

**Aplicação:** https://mesql1.github.io/suspension-lab/

## Modos

- **Simulação:** todo o DSP roda no navegador, como referência em precisão dupla.
- **HIL:** `x[n]` é enviado em blocos binários ao ESP32; `y[n]` recebido controla a cabine e alimenta o osciloscópio/FFT.
- Se a serial cair, o host retorna automaticamente ao modo Simulação.

## Monorepo

```text
├── web/       React, Three.js, Canvas, Web Serial e testes Vitest
├── firmware/  PlatformIO, ESP32, timer ISR, biquad e protocolo
└── docs/      matemática, protocolo e validação
```

## Executar o host

```bash
npm install
npm run dev
```

Validação:

```bash
npm test
npm run build
```

## Compilar o firmware

```bash
cd firmware
pio run
pio run -t upload
```

Após a gravação, abra a aplicação em Chrome ou Edge, selecione **HIL · ESP32**, escolha a porta USB e autorize a conexão. Web Serial exige HTTPS ou localhost.

## Documentação

- [Matemática e arquitetura da aplicação](docs/DOCUMENTACAO_TECNICA.md)
- [Arquitetura HIL e protocolo binário](docs/HIL_PROTOCOLO.md)
- [Montagem, testes e relatório de validação](docs/HIL_VALIDACAO.md)
- [Firmware ESP32](firmware/README.md)

## Estado de validação

- Testes web: 9 aprovados.
- Build Vite: aprovado.
- Build PlatformIO para `esp32dev`: aprovado.
- Medições físicas de jitter e latência: dependem de uma placa conectada; o procedimento está documentado sem inventar resultados.
