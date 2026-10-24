// Usage: node --env-file-if-exists=../../.env src/voice-clone.mjs <name> <sample1.mp3> [sample2.m4a ...]
// Prints the new voice_id. Then: node --env-file-if-exists=../../.env src/tts-demo.mjs --voice <voice_id> hi
import { createInstantVoiceClone } from './elevenlabs.mjs';

const [name, ...files] = process.argv.slice(2);
if (!name || !files.length) {
  console.error('usage: voice-clone.mjs <name> <sample-file> [...more]');
  process.exit(2);
}
const res = await createInstantVoiceClone({ name, files, description: 'hackathon spike IVC' });
console.log(`voice_id=${res.voice_id} requires_verification=${res.requires_verification} (${res.latencyMs} ms)`);
