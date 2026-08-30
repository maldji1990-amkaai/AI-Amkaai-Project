export type ContinuityBible = {
  visualStyle: string;
  location: string;
  lighting: string;
  cameraLanguage: string;
  characterBible: string;
  wardrobe: string;
  colorPalette: string;
  negativePrompt: string;
};

export function buildContinuityPrompt(bible: ContinuityBible, scenePrompt: string) {
  return [
    scenePrompt.trim(),
    "",
    "CONTINUITY LOCK:",
    `Visual style: ${bible.visualStyle}`,
    `Location/environment: ${bible.location}`,
    `Lighting: ${bible.lighting}`,
    `Camera language: ${bible.cameraLanguage}`,
    `Character bible: ${bible.characterBible}`,
    `Wardrobe: ${bible.wardrobe}`,
    `Color palette: ${bible.colorPalette}`,
    `Avoid: ${bible.negativePrompt}`,
    "Keep identity, wardrobe, environment, lighting direction and visual style consistent with adjacent scenes.",
  ].join("\n");
}
