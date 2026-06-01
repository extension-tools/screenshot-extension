# Product Task: Speed Target 19s To 14s

## Problem

Screenshot Extension is currently around **19s average** on the existing competitor benchmark set.

After release, the product needs a clear performance goal:

```text
reduce average PNG full-page capture from 19s to 14s
```

This is a Must after release goal.

## User

Users who expect full-page capture to feel fast and reliable compared with FireShot, GoFullPage, and other screenshot extensions.

## Value

The product should feel competitive on speed without sacrificing visual quality.

The performance work should be led as a capture-engine performance/system architecture task, not as random micro-optimizations.

## Target

- Current average: **19s**
- Target average: **14s**
- Scope: existing competitor benchmark set
- Quality rule: do not reduce visual quality to hit the average
- Product endpoint: PNG download remains the endpoint

## Development Roadmap

| Что делаем | Оценка времени | Зачем | Нужно ли менять production-код |
| --- | --- | --- | --- |
| Используем текущие timing diagnostics | 0 дней | Понять, какие фазы режем первыми | Нет |
| Свести `lazy_warmup`, `capture_stepper`, `render_output`, `download_export` в один отчёт | 0.5 дня | Видеть вклад каждого этапа в секунды | Нет, только QA-скрипт |
| Добавить пару timing fields без изменения capture-логики, если данных не хватит | до 1 дня | Закрыть слепые зоны в замерах | Да, но только диагностика |
| Менять warmup, waits, duplicate probes, export path | 7-12 рабочих дней | Получить выигрыш скорости без падения OK | Да |

## Implementation Direction

Use the existing speed roadmap:

1. Fast warmup bounce instead of long default lazy warmup.
2. Adaptive per-frame waits.
3. Reduced duplicate pre-capture probes.
4. Faster output/export completion path.
5. Threshold tuning against the existing benchmark set.

## Non-Goals

- Do not trade obvious visual quality for speed.
- Do not change the product endpoint away from PNG download.
- Do not treat one fast lucky run as success.
- Do not optimize without timing diagnostics.

## Success Criteria

- Average PNG full-page capture reaches **14s** on the existing benchmark set.
- OK / Failed does not get worse than the current baseline.
- Preferred quality target: move closer to FireShot / GoFullPage reliability.
- No new obvious blank areas, repeated sticky chrome, missing footer, or broken first viewport.

## Priority

Must after release.

## Related Docs

- `../docs/roadmap.md#speed-roadmap-19s---14s-average`
