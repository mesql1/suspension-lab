# Suspension Lab HIL

Plataforma HIL para demonstrar uma suspensão veicular como filtro mecânico passa-baixas. O navegador gera a pista e renderiza os painéis/3D. Um **ESP32 virtual**, ativo por padrão, executa o mesmo protocolo e o mesmo biquad a 1 kHz sem exigir placa física; o ESP32 real permanece como opção avançada via USB-UART.

**Aplicação:** https://mesql1.github.io/suspension-lab/

## Modos

- **Simulação:** todo o DSP roda no navegador, como referência em precisão dupla.
- **ESP32 virtual (padrão):** `x[n]` atravessa o protocolo binário e um target emulado devolve `y[n]`; funciona em qualquer navegador moderno e não requer hardware.
- **ESP32 físico (opcional):** os mesmos quadros são enviados por Web Serial a uma placa real.
- Se o target falhar, o host retorna automaticamente ao modo Simulação.

## Monorepo

```text
├── web/       React, Three.js, target virtual, Web Serial e testes Vitest
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

Nenhum firmware é necessário para usar o site: basta abrir a aplicação e deixar **ESP32 VIRTUAL** selecionado. Para a demonstração opcional com placa, após a gravação abra a aplicação em Chrome ou Edge, selecione **ESP32 FÍSICO**, escolha a porta USB e autorize a conexão. Web Serial exige HTTPS ou localhost.

## Documentação

- [Matemática e arquitetura da aplicação](docs/DOCUMENTACAO_TECNICA.md)
- [Guia simples para usuários e estudantes](docs/GUIA_SIMPLES_DA_APLICACAO.md)
- [Arquitetura HIL e protocolo binário](docs/HIL_PROTOCOLO.md)
- [Montagem, testes e relatório de validação](docs/HIL_VALIDACAO.md)
- [Firmware ESP32](firmware/README.md)

## Estado de validação

- Testes web: 9 aprovados.
- Build Vite: aprovado.
- Build PlatformIO para `esp32dev`: aprovado.
- Target virtual: disponível sem placa e identificado como emulação no painel.
- Medições físicas de jitter e latência: dependem de uma placa conectada; o procedimento está documentado sem inventar resultados.
