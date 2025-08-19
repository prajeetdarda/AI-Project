// Turns numeric features into a few vibe keywords for the prompt.
export type Feats = {
  acousticness: number; danceability: number; energy: number;
  instrumentalness: number; liveness: number; speechiness: number;
  tempo: number; valence: number; loudness: number;
};

export function featuresToKeywords(f: Feats): string[] {
  const kws: string[] = [];
  if (f.danceability > 0.65) kws.push("dance", "edm", "electropop");
  else if (f.danceability > 0.5) kws.push("pop", "indie pop");

  if (f.energy > 0.7) kws.push("high energy", "club", "festival");
  else if (f.energy < 0.35) kws.push("chill", "ambient");

  if (f.valence > 0.6) kws.push("feel-good", "happy");
  else if (f.valence < 0.35) kws.push("moody", "melancholic");

  if (f.acousticness > 0.5) kws.push("acoustic", "singer-songwriter");
  if (f.instrumentalness > 0.6) kws.push("instrumental", "lofi beats");
  if (f.speechiness > 0.33) kws.push("rap", "hip-hop");

  if (f.tempo >= 120 && f.tempo <= 135) kws.push("house");
  else if (f.tempo > 135) kws.push("drum and bass", "techno");
  else if (f.tempo < 95) kws.push("downtempo");

  return Array.from(new Set(kws)).slice(0, 6);
}