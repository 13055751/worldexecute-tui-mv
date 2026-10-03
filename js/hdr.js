// js/hdr.js — HDR pass palette override (data-only, loaded when ?hdr=1)
// Pixel values stay 8-bit; the HDR lift happens at encode (PQ/BT.2020 gain curve).
// This override only raises peak contrast so highlights have headroom to map into.
'use strict';
if (window.HDR) {
  Object.assign(PAL, {
    text: '#9db3c9',
    bright: '#f4f9ff',   // near-peak white cores
    dim: '#4a5666',
    dimmer: '#2e3844',
    border: '#36455a',
    borderHot: '#5f7590',
    accent: '#ffc94d',   // hotter amber
    accentDim: '#96701f',
    err: '#ff7070',
    errDim: '#7a3030',
    ok: '#7ce88d',
    cyan: '#7fd0ea',
    cyanBright: '#b8ecff',
    titleBg: '#18222c',
    titleFg: '#b9cbdd',
    invBg: '#ffc94d',
    invFg: '#000000',
  });
}
