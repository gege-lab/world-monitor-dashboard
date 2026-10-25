# Third-Party Notices

## Bundled Software

Third-party software keeps its original copyright and license. The notices below
do not apply a new license to that software.

| Component | Bundled location | License and upstream |
| --- | --- | --- |
| D3 7.9.0 | `public/vendor/d3.min.js` | [ISC](licenses/D3-ISC.txt), [upstream](https://github.com/d3/d3/tree/v7.9.0) |
| TopoJSON Client 3.1.0 | `public/vendor/topojson-client.min.js` | [ISC](licenses/TOPOJSON-CLIENT-ISC.txt), [upstream](https://github.com/topojson/topojson-client/tree/v3.1.0) |
| Three.js r164 | `public/vendor/three.module.js` | [MIT](licenses/THREE-MIT.txt), [upstream](https://github.com/mrdoob/three.js/tree/r164) |
| Lucide 0.468.0 | `public/vendor/lucide.min.js` | [ISC](licenses/LUCIDE-ISC.txt), [upstream](https://github.com/lucide-icons/lucide/tree/0.468.0) |

Lucide includes portions derived from Feather. The
[Feather MIT notice](licenses/FEATHER-MIT.txt) is included separately.
Three.js includes a port of Earcut, whose
[ISC notice](licenses/EARCUT-ISC.txt) is included separately.
The D3 bundle includes Delaunator through d3-delaunay; its
[ISC notice](licenses/DELAUNATOR-ISC.txt) is also included.

## Geographic Data

`public/data/countries-50m.json` comes from
[world-atlas 2.0.2](https://github.com/topojson/world-atlas/tree/v2.0.2).
Its [ISC notice](licenses/WORLD-ATLAS-ISC.txt) is included.
The underlying [Natural Earth](https://www.naturalearthdata.com/about/terms-of-use/)
map data is public domain. Made with Natural Earth.

## Optional Node.js Runtime

The Mac transfer ZIP includes official Node.js 22.23.3 executables for Apple
Silicon and Intel. Executables are excluded from this source repository.
Their existing copyright and dependency notices are preserved in
`runtime/arm64/LICENSE` and `runtime/x64/LICENSE`.
`runtime/manifest.json` records the download source and checksums.

## Reference Project and Restored Catalog

The original implementation history identifies
[koala73/worldmonitor](https://github.com/koala73/worldmonitor) as a dashboard
design reference. This repository contains the Node.js/D3 dashboard created and
restored for this project; it is not the official World Monitor distribution.
The legacy AI infrastructure catalog was restored from the supplied earlier
application. It is a fixed catalog, not a claim of current company status or
equipment capacity. See [RESTORED_SPEC.md](RESTORED_SPEC.md).

## Network Services and Content

News, translations, market observations, geographic tiles, and status feeds are
retrieved from external services at runtime. This repository does not grant
rights to third-party articles or service data. The relevant providers' terms
continue to apply. Content generation uses public headlines and is a draft,
not a verified reproduction of full articles or a connected external AI writer.

## Project License

No blanket reuse license has been selected for the project's own code.
Publishing the repository does not replace or broaden any third-party license.
