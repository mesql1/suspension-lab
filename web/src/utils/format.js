const locale = 'pt-BR'

export function formatNumber(value, options = {}) {
  if (!Number.isFinite(Number(value))) return '—'
  return new Intl.NumberFormat(locale, options).format(Number(value))
}

export function formatFixed(value, digits = 1) {
  return formatNumber(value, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

export function formatSliderValue(value, step) {
  const digits = step >= 1 ? 0 : Math.min(3, Math.max(0, Math.ceil(-Math.log10(step))))
  return formatNumber(value, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}
