#pragma once

#include <Arduino.h>

namespace hil {

struct BiquadCoefficients {
  double b0 = 0;
  double b1 = 0;
  double b2 = 0;
  double a1 = 0;
  double a2 = 0;
  double omegaN = 0;
  bool stable = false;
};

struct Df2TState {
  double s1 = 0;
  double s2 = 0;
};

bool parametersValid(float m, float c, float k);
bool generateCoefficients(double m, double c, double k, double fs, BiquadCoefficients& output);
bool discretePolesStable(const BiquadCoefficients& coefficients);
double processDf2T(double input, const BiquadCoefficients& coefficients, Df2TState& state);

}  // namespace hil
