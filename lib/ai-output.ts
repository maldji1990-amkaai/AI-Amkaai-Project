export function requireOutputUrl(output: unknown, label = "AI output") {
  const value = Array.isArray(output) ? output[0] : output;
  if (typeof value !== "string" || !/^https?:\/\//i.test(value)) {
    throw new Error(`${label} is missing or invalid`);
  }
  return value;
}

export function requireNonEmptyText(output: unknown, label = "AI output") {
  if (typeof output !== "string" || !output.trim()) {
    throw new Error(`${label} is missing`);
  }
  return output.trim();
}
