export const clampRiskValue = (value: number) =>
  Math.max(0, Math.min(1, Number(value.toFixed(2))));

export const calculateRiskIndex = (values: {
  climateExposure: number;
  ageingIndex: number;
  psychologicalStress: number;
  adaptabilityCapacity: number;
}) =>
  Number(
    (
      values.climateExposure * 0.25 +
      values.ageingIndex * 0.25 +
      values.psychologicalStress * 0.25 +
      values.adaptabilityCapacity * 0.25
    ).toFixed(3),
  );

export const getRiskLevel = (index: number) => {
  if (index < 0.25) {
    return 'Low';
  }

  if (index < 0.5) {
    return 'Moderate';
  }

  if (index < 0.75) {
    return 'High';
  }

  return 'Critical';
};

export const getRiskInterpretation = (
  districtName: string,
  index: number,
  note: string,
) => {
  if (index < 0.25) {
    return `${districtName} shows a low composite CAMH risk profile. ${note}. Continued preventive monitoring remains important.`;
  }

  if (index < 0.5) {
    return `${districtName} presents moderate composite risk. ${note}. Targeted intervention around the highest-scoring dimension is recommended.`;
  }

  if (index < 0.75) {
    return `${districtName} is in a high-risk zone. ${note}. Structured community response and resilience programming should be prioritised.`;
  }

  return `${districtName} faces critical and intersecting CAMH risk. ${note}. Immediate multi-sectoral action is recommended.`;
};
