# Firmware HIL — ESP32 DevKit v1

## Decisão de plataforma

O projeto usa Arduino sobre PlatformIO com `espressif32@6.10.0`. Essa versão fornece Arduino-ESP32 2.x, API de timer estável, FreeRTOS dual-core e driver UART com buffers por interrupção. ESP-IDF daria controle adicional, mas aumentaria a complexidade sem benefício material para um biquad de 1 kHz.

## Compilar e gravar

1. Instale VS Code, a extensão PlatformIO e o driver CP2102 ou CH340 correspondente à placa.
2. Conecte o ESP32 por USB.
3. Abra a pasta `firmware/` no PlatformIO.
4. Se necessário, configure `upload_port` em `platformio.ini`.
5. Execute **Upload** ou:

```bash
pio run -t upload
```

O baud rate da aplicação é `921600`. O GPIO 2 é alternado no início/fim da ISR para medição externa.

## Contextos de execução

- Core 0: tarefa `hil-uart`, parser, montagem de blocos e transmissão.
- Core 1: ambiente Arduino e interrupção do timer a 1 kHz.
- FIFO de entrada: tarefa → ISR.
- FIFO de saída: ISR → tarefa.
- Jitter buffer: 32 amostras, ou 32 ms na configuração padrão.

Os coeficientes e estados usam `double`. No ESP32 clássico, operações de precisão dupla são mais caras que `float`, mas cinco multiplicações principais a 1 kHz ainda deixam ampla margem dentro de 1 ms. A telemetria `isrOverruns` confirma isso no hardware real.

## Adaptação para STM32F411

No BlackPill, substitua a tarefa dual-core por:

- UART RX/TX via DMA circular;
- timer TIM2/TIM5 gerando update interrupt a 1 kHz;
- parser e empacotamento no loop principal ou tarefa RTOS;
- mesmas FIFOs SPSC entre DMA/main e ISR;
- troca do banco de coeficientes dentro de uma seção crítica curta.

O protocolo e o módulo DSP não dependem da arquitetura, exceto pelos atributos `IRAM_ATTR` e primitivas críticas do ESP32.
