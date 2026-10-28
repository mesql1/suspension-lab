# Suspension Lab

Simulador interativo de uma suspensão massa–mola–amortecedor como filtro mecânico passa-baixas. O motor DSP roda a 1 kHz, independentemente da taxa de quadros, e alimenta simultaneamente a cena 3D e os painéis analíticos.

**Demo:** https://mesql1.github.io/suspension-lab/

## Documentação

A explicação completa da arquitetura, do modelo físico, da transformação bilinear com pre-warp, da FFT, dos gráficos e da integração 3D está em:

- [Documentação técnica completa](docs/DOCUMENTACAO_TECNICA.md)

## Executar

```bash
npm install
npm run dev
```

Para validar a versão de produção e o motor DSP:

```bash
npm test
npm run build
```

## Estrutura

- `src/dsp/`: bilinear com pre-warp, IIR, ruído rosa, FFT, resposta em frequência e ring buffer.
- `src/simulation/`: relógio de simulação, sub-stepping e gerador da pista.
- `src/components/charts/`: Bode, polos/zero, osciloscópio e espectro em Canvas 2D.
- `src/components/three/`: veículo, pista rolante e integração React Three Fiber.

## Decisões técnicas

- O filtro usa uma taxa interna fixa de 1 kHz com acumulador de tempo; assim a síntese de componentes até 100 Hz não depende dos 60 FPS da tela.
- Os estados do IIR são preservados durante mudanças de parâmetros. Apenas os coeficientes são recalculados.
- Os históricos são `Float64Array` circulares; não há alocação por amostra nem `setState` por frame.
- A FFT radix-2 usa uma janela de Hann e é atualizada a uma cadência menor que a renderização 3D.
- A geometria da pista é atualizada in-place; normais são recalculadas a cada oito frames para reduzir o custo na GPU/CPU.
