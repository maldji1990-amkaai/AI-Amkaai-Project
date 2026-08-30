ALTER TABLE "Scene" ADD COLUMN "characterId" TEXT;
ALTER TABLE "Scene" ADD COLUMN "voiceProfileId" TEXT;
CREATE INDEX "Scene_characterId_idx" ON "Scene"("characterId");
CREATE INDEX "Scene_voiceProfileId_idx" ON "Scene"("voiceProfileId");
ALTER TABLE "Scene" ADD CONSTRAINT "Scene_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Scene" ADD CONSTRAINT "Scene_voiceProfileId_fkey" FOREIGN KEY ("voiceProfileId") REFERENCES "VoiceProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
