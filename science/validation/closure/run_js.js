// run_js.js — run the app's physics module (science/js/lyaphys.js, unmodified) on every closure case and compare with
// the Python port and with fake_spectra.
//   node science/validation/closure/run_js.js            -> prints a table, writes js_vs_port.json next to this file
// Uses exactly the exported skewer arrays: tauFromCells(ugrid, cellsFromSkewer(sk), {period, ...port_options}).
'use strict';
const fs = require('fs');
const path = require('path');
const L = require(path.join(__dirname, '..', '..', 'js', 'lyaphys.js'));

const dir = path.join(__dirname, 'cases');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort();
const out = {};
for (const f of files) {
  const c = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  const sk = { z: c.z, cosmo: c.cosmo, dx_mpch: c.dx_mpch, x: c.x, nHI: c.nHI, T: c.T, v: c.v };
  const opts = Object.assign({ period: c.period_kms }, c.port_options);
  const t0 = Date.now();
  const tau = L.tauFromCells(c.ugrid, L.cellsFromSkewer(sk), opts);
  const ms = Date.now() - t0;
  let relPort = 0, dFport = 0, dFfs = 0;
  for (let i = 0; i < tau.length; i++) {
    const p = c.tau_port[i];
    if (p > 1e-12) relPort = Math.max(relPort, Math.abs(tau[i] - p) / p);
    dFport = Math.max(dFport, Math.abs(Math.exp(-tau[i]) - Math.exp(-p)));
    dFfs = Math.max(dFfs, Math.abs(Math.exp(-tau[i]) - Math.exp(-c.tau_fake_spectra[i])));
  }
  out[c.case] = { max_rel_tau_js_vs_port: relPort, max_abs_dF_js_vs_port: dFport, max_abs_dF_js_vs_fake_spectra: dFfs, ms };
  console.log(`${c.case.padEnd(6)} JS vs port: max rel tau ${relPort.toExponential(2)}  max|dF| ${dFport.toExponential(2)}` +
    `   JS vs fake_spectra: max|dF| ${dFfs.toExponential(2)}   (${ms} ms)`);
}
fs.writeFileSync(path.join(__dirname, 'js_vs_port.json'), JSON.stringify(out, null, 1));
