# Dark Reader API

- Upstream: https://github.com/darkreader/darkreader
- npm: `darkreader@4.9.134`, MIT, copyright and permission notice in [DARKREADER-LICENSE](DARKREADER-LICENSE).
- Archive integrity: `sha512-HAyEz97vK/UFLO6kcjxojji5OKr0+pwgGLrBzyg67xD2p6ySrSyCBvNxb+0KTSMYk9qNz9Hq85JR3TaKyqEV1w==`.
- Bundled locally, no remote executable code. The upstream UMD is wrapped with a private `chrome` shim so its API cannot replace extension messaging methods. Upstream source inside the wrapper is unchanged.
- Reproduce: `mkdir dist`, `npm pack darkreader@4.9.134 --ignore-scripts --pack-destination dist`, `tar -xf dist/darkreader-4.9.134.tgz -C dist`, `node scripts/vendor-darkreader.mjs`.
