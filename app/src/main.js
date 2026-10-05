/* Lyα: from gas to forest — production entry. The canonical path, Beats 0–13, in manifest order
 * (design/canonical/BEATS.yaml). Each scene is an authored module; app/build.mjs checks them against the manifest. */
import { App, registerScene } from './core/app.js';
import { boot } from './core/runtime.js';
import { prepareData } from './data/scene-data.js';
import { installProbes } from './probes/probes.js';
import { installSession, sessionLink, sessionDownload } from './review/session.js';
import { sceneGas } from './scenes/b00-gas.js';
import { sceneScales } from './scenes/b01-scales.js';
import { sceneResonance } from './scenes/b02-resonance.js';
import { sceneTemperature } from './scenes/b03-temperature.js';
import { sceneLifetime } from './scenes/b04-lifetime.js';
import { sceneStretched } from './scenes/b05-stretched.js';
import { sceneParcel } from './scenes/b06-parcel.js';
import { sceneDistance } from './scenes/b07-distance.js';
import { sceneCells } from './scenes/b08-cells.js';
import { sceneInkAdds } from './scenes/b09-ink-adds.js';
import { sceneLight } from './scenes/b10-light.js';
import { sceneForest } from './scenes/b11-forest.js';
import { sceneWhoAte } from './scenes/b12-who-ate.js';
import { sceneSameShadow } from './scenes/b13-same-shadow.js';

for (const sc of [sceneGas, sceneScales, sceneResonance, sceneTemperature, sceneLifetime, sceneStretched, sceneParcel, sceneDistance, sceneCells, sceneInkAdds, sceneLight, sceneForest, sceneWhoAte, sceneSameShadow]) registerScene(sc);
installProbes();
App.hooks.beforeGo = h => { installSession(h); if (App.study) { App.hooks.sessionHTML = sessionLink; App.hooks.sessionSave = sessionDownload; } };   // a study session (#cold=1, or resumed)
window.addEventListener('DOMContentLoaded', () => boot(prepareData));
