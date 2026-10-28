#include "Dsp.h"

#include <cmath>

namespace hil {

bool parametersValid(float m, float c, float k) {
  return isfinite(m) && isfinite(c) && isfinite(k) &&
         m >= 180.0F && m <= 650.0F &&
         c >= 100.0F && c <= 12000.0F &&
         k >= 10000.0F && k <= 90000.0F;
}

bool discretePolesStable(const BiquadCoefficients& q) {
  // Raízes de z² + a1*z + a2. Para raízes complexas conjugadas,
  // o módulo de cada raiz é sqrt(a2).
  const double discriminant = q.a1 * q.a1 - 4.0 * q.a2;
  if (discriminant >= 0.0) {
    const double root = sqrt(discriminant);
    const double p1 = (-q.a1 + root) * 0.5;
    const double p2 = (-q.a1 - root) * 0.5;
    return fabs(p1) < 1.0 && fabs(p2) < 1.0;
  }
  const double real = -q.a1 * 0.5;
  const double imag = sqrt(-discriminant) * 0.5;
  return hypot(real, imag) < 1.0;
}

bool generateCoefficients(double m, double c, double k, double fs, BiquadCoefficients& output) {
  if (!(m > 0.0 && c >= 0.0 && k > 0.0 && fs > 0.0)) return false;

  // H(s) = (c*s + k) / (m*s² + c*s + k)
  // Tustin pre-warped em wn = sqrt(k/m):
  // s = K(1-z^-1)/(1+z^-1), K = wn/tan(wn*Ts/2)
  // Depois de multiplicar por (1+z^-1)²:
  // B0=cK+k, B1=2k, B2=k-cK
  // A0=mK²+cK+k, A1=-2mK²+2k, A2=mK²-cK+k
  const double omegaN = sqrt(k / m);
  const double ts = 1.0 / fs;
  const double angle = fmin(omegaN * ts * 0.5, M_PI * 0.499999);
  const double K = omegaN / tan(angle);
  const double K2 = K * K;
  const double A0 = m * K2 + c * K + k;
  if (!isfinite(A0) || fabs(A0) < 1e-18) return false;

  output.b0 = (c * K + k) / A0;
  output.b1 = (2.0 * k) / A0;
  output.b2 = (k - c * K) / A0;
  output.a1 = (-2.0 * m * K2 + 2.0 * k) / A0;
  output.a2 = (m * K2 - c * K + k) / A0;
  output.omegaN = omegaN;
  output.stable = discretePolesStable(output);
  return output.stable;
}

double IRAM_ATTR processDf2T(double x, const BiquadCoefficients& q, Df2TState& state) {
  // Direct Form II Transposta: apenas dois estados e boa distribuição numérica.
  const double y = q.b0 * x + state.s1;
  const double nextS1 = q.b1 * x - q.a1 * y + state.s2;
  const double nextS2 = q.b2 * x - q.a2 * y;
  state.s1 = nextS1;
  state.s2 = nextS2;
  return isfinite(y) ? y : 0.0;
}

}  // namespace hil
