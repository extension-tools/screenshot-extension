import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {PNG} from 'pngjs';
import {chromium} from 'playwright';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(projectRoot, '..');
const codeRoot = process.env.CAPTURE_EXTENSION_ROOT ?
  path.resolve(process.env.CAPTURE_EXTENSION_ROOT) :
  path.join(repoRoot, 'code');
const fixtureRoot = path.join(projectRoot, 'tests', 'fixtures');
const resultsRoot = path.join(projectRoot, 'tests', 'capture-results');
const latestDir = path.join(resultsRoot, 'latest');
const viewport = {
  width: 1365,
  height: 900
};
const cases = [
  {
    name: 'basic-long-page',
    path: '/basic-long-page.html',
    expected: 'download',
    assertions: {
      heightGreaterThanViewport: true
    }
  },
  {
    name: 'sticky-scrollbar-page',
    path: '/sticky-scrollbar-page.html',
    expected: 'download',
    assertions: {
      heightGreaterThanViewport: true,
      colorBands: [
        {
          name: 'fixed header is not repeated',
          color: [255, 0, 200],
          minRows: 70,
          maxRows: 180,
          minRowFraction: 0.55
        },
        {
          name: 'fixed cookie banner is not repeated',
          color: [0, 229, 255],
          maxRows: 120,
          minRowFraction: 0.55
        },
        {
          name: 'sticky nav is not repeated',
          color: [255, 230, 0],
          minRows: 35,
          maxRows: 120,
          minRowFraction: 0.55
        }
      ],
      maxColorPixels: [
        {
          name: 'internal scrollbar red track is hidden',
          color: [255, 26, 26],
          maxPixels: 50
        },
        {
          name: 'internal scrollbar blue thumb is hidden',
          color: [17, 17, 255],
          maxPixels: 50
        }
      ]
    }
  },
  {
    name: 'fixed-top-header-page',
    path: '/fixed-top-header-page.html',
    expected: 'download',
    assertions: {
      heightGreaterThanViewport: true,
      colorBands: [
        {
          name: 'fixed top header is visible once',
          color: [246, 57, 57],
          tolerance: 2,
          minRows: 70,
          maxRows: 120,
          minRowFraction: 0.55
        }
      ],
      captureDiagnosticsV2: {
        status: 'success',
        exportStatus: 'saved',
        scrollTargetType: 'window',
        riskFlagsInclude: ['fixed_sticky'],
        fixedStickyCandidateCountAtLeast: 1,
        frameDiagnostics: [
          {
            frameIndex: 1,
            hiddenAtLeast: 1,
            transformedAtMost: 0
          }
        ]
      }
    }
  },
  {
    name: 'fixed-top-small-button-page',
    path: '/fixed-top-small-button-page.html',
    expected: 'download',
    assertions: {
      heightGreaterThanViewport: true,
      minColorPixels: [
        {
          name: 'small fixed top button is preserved in first frame',
          color: [255, 150, 0],
          tolerance: 2,
          minPixels: 2500
        }
      ],
      maxColorPixels: [
        {
          name: 'small fixed top button is not treated as a repeated header band',
          color: [255, 150, 0],
          tolerance: 2,
          maxPixels: 9000
        }
      ],
      captureDiagnosticsV2: {
        status: 'success',
        exportStatus: 'saved',
        scrollTargetType: 'window',
        riskFlagsInclude: ['fixed_sticky'],
        fixedStickyCandidateCountAtLeast: 1,
        frameDiagnostics: [
          {
            frameIndex: 1,
            hiddenAtMost: 0,
            transformedAtLeast: 1
          }
        ]
      }
    }
  },
  {
    name: 'visible-overlay-first-frame-page',
    path: '/visible-overlay-first-frame-page.html',
    expected: 'download',
    assertions: {
      heightGreaterThanViewport: true,
      minColorPixels: [
        {
          name: 'visible first-frame overlay is preserved',
          color: [255, 96, 0],
          tolerance: 2,
          minPixels: 20000
        }
      ],
      maxColorPixels: [
        {
          name: 'visible overlay is not repeated on later frames',
          color: [255, 96, 0],
          tolerance: 2,
          maxPixels: 70000
        }
      ]
    }
  },
  {
    name: 'apple-global-menu-first-frame-page',
    path: '/apple-global-menu-first-frame-page.html',
    expected: 'download',
    assertions: {
      heightGreaterThanViewport: true,
      captureDiagnosticsV2: {
        status: 'success',
        exportStatus: 'saved',
        scrollTargetType: 'window',
        riskFlagsInclude: ['fixed_sticky'],
        fixedStickyCandidateCountAtLeast: 2,
        visibleOverlayCandidateCountAtLeast: 1
      },
      minColorPixels: [
        {
          name: 'Apple-like global menu is preserved in first frame',
          color: [176, 80, 255],
          tolerance: 2,
          minPixels: 140000
        },
        {
          name: 'deep content below Apple-like menu is captured',
          color: [20, 180, 120],
          tolerance: 2,
          minPixels: 12000
        }
      ],
      maxColorPixels: [
        {
          name: 'Apple-like global menu is not repeated on later frames',
          color: [176, 80, 255],
          tolerance: 2,
          maxPixels: 420000
        }
      ]
    }
  },
  {
    name: 'shipping-popup-sticky-repeat-page',
    path: '/shipping-popup-sticky-repeat-page.html',
    expected: 'download',
    assertions: {
      heightGreaterThanViewport: true,
      colorBands: [
        {
          name: 'shipping fixture sticky header is not repeated',
          color: [42, 44, 48],
          minRows: 60,
          maxRows: 160,
          minRowFraction: 0.55
        }
      ],
      minColorPixels: [
        {
          name: 'shipping popup is preserved in first frame',
          color: [255, 128, 0],
          tolerance: 2,
          minPixels: 20000
        }
      ],
      maxColorPixels: [
        {
          name: 'shipping popup is not repeated on later frames',
          color: [255, 128, 0],
          tolerance: 2,
          maxPixels: 90000
        }
      ]
    }
  },
  {
    name: 'lazy-load-page',
    path: '/lazy-load-page.html',
    expected: 'download',
    assertions: {
      heightGreaterThanViewport: true,
      minColorPixels: [
        {
          name: 'below-fold triggered lazy marker is captured',
          color: [0, 210, 120],
          minPixels: 12000
        }
      ]
    }
  },
  {
    name: 'lazy-preview-grid-page',
    path: '/lazy-preview-grid-page.html',
    expected: 'download',
    assertions: {
      heightGreaterThanViewport: true,
      minColorPixels: [
        {
          name: 'top lazy preview is loaded before capture',
          color: [30, 180, 90],
          minPixels: 12000
        },
        {
          name: 'second lazy preview is loaded before capture',
          color: [40, 120, 255],
          minPixels: 12000
        },
        {
          name: 'lower lazy preview is loaded before capture',
          color: [150, 80, 240],
          minPixels: 12000
        }
      ],
      imageReadiness: {
        beforePendingAtLeast: 1,
        afterReadyAtLeastBefore: true,
        afterReadinessAtLeastBefore: true,
        frameDiagnosticsAtLeast: 2
      }
    }
  },
  {
    name: 'late-lazy-grid-page',
    path: '/late-lazy-grid-page.html',
    expected: 'download',
    assertions: {
      heightGreaterThanViewport: true,
      minColorPixels: [
        {
          name: 'late top preview is loaded before capture',
          color: [22, 190, 110],
          minPixels: 10000
        },
        {
          name: 'late middle preview is loaded before capture',
          color: [45, 130, 255],
          minPixels: 10000
        },
        {
          name: 'late bottom preview is loaded before capture',
          color: [245, 130, 45],
          minPixels: 10000
        }
      ],
      imageReadiness: {
        afterReadinessAtLeastBefore: true,
        frameDiagnosticsAtLeast: 2
      }
    }
  },
  {
    name: 'broken-image-diagnostics-page',
    path: '/broken-image-diagnostics-page.html',
    expected: 'download',
    assertions: {
      heightGreaterThanViewport: true,
      minColorPixels: [
        {
          name: 'content after broken image is captured',
          color: [90, 80, 255],
          minPixels: 12000
        }
      ],
      imageReadiness: {
        brokenAnyFrameAtLeast: 1,
        frameDiagnosticsAtLeast: 1
      },
      notification: {
        event: 'capture.image-readiness-risk',
        reason: 'image_readiness_risk',
        message: 'If some images didn’t load, try again in a few seconds.'
      }
    }
  },
  {
    name: 'huge-page-tiling',
    path: '/huge-page-guard.html',
    expected: 'multi-download',
    assertions: {
      minDownloads: 2,
      maxPartHeight: 16384,
      summedHeightGreaterThanViewport: true,
      notification: {
        event: 'capture.large-page-split',
        reason: 'canvas_tiling_required'
      },
      singleFileExportAttempt: {
        decision: 'parts',
        reason: 'single_canvas_exceeds_limits',
        attempted: false
      },
      captureDiagnosticsV2: {
        status: 'success',
        outputStrategy: 'tiled-output',
        exportStatus: 'saved',
        exportFilesComplete: true,
        scrollTargetType: 'window'
      }
    }
  },
  {
    name: 'huge-page-tiling-pdf-multi-page',
    path: '/huge-page-guard.html',
    expected: 'download-pdf',
    exportFormat: 'pdf',
    assertions: {
      pdf: {
        pageCount: 2
      },
      captureDiagnosticsV2: {
        status: 'success',
        outputStrategy: 'tiled-output',
        exportStatus: 'saved',
        scrollTargetType: 'window',
        exportFormat: 'pdf',
        pdfPageCount: 2,
        pdfSource: 'tiles',
        pdfPageMode: 'multi-page'
      }
    }
  },
  {
    name: 'too-many-parts-page',
    path: '/too-many-parts-page.html',
    expected: 'error',
    errorIncludes: 'too large',
    assertions: {
      captureDiagnosticsV2: {
        status: 'failed',
        exportStatus: 'not_started',
        scrollTargetType: 'window',
        failureReason: 'too_many_output_parts'
      }
    }
  },
  {
    name: 'iframe-baseline-page',
    path: '/iframe-baseline-page.html',
    expected: 'download',
    assertions: {
      heightGreaterThanViewport: true,
      minColorPixels: [
        {
          name: 'visible iframe marker is captured',
          color: [0, 255, 90],
          minPixels: 9000
        }
      ],
      diagnostics: {
        iframeCountAtLeast: 1
      }
    }
  },
  {
    name: 'sticky-toc-repeat-page',
    path: '/sticky-toc-repeat-page.html',
    expected: 'download',
    assertions: {
      heightGreaterThanViewport: true,
      colorBands: [
        {
          name: 'docs header is not repeated',
          color: [23, 180, 145],
          minRows: 70,
          maxRows: 210,
          minRowFraction: 0.55
        },
        {
          name: 'sticky toc is not repeated',
          color: [255, 174, 30],
          minRows: 0,
          maxRows: 520,
          minRowFraction: 0.05
        },
        {
          name: 'left sticky brand is not repeated',
          color: [130, 90, 255],
          minRows: 80,
          maxRows: 320,
          minRowFraction: 0.03
        }
      ],
      maxColorPixels: [
        {
          name: 'root scrollbar marker is hidden',
          color: [230, 0, 0],
          maxPixels: 80
        }
      ]
    }
  },
  {
    name: 'product-sticky-zone-page',
    path: '/product-sticky-zone-page.html',
    expected: 'download',
    assertions: {
      heightGreaterThanViewport: true,
      minColorPixels: [
        {
          name: 'large sticky product media remains captured after sticky normalization',
          color: [11, 118, 255],
          tolerance: 2,
          minPixels: 300000
        }
      ],
      maxColorPixels: [
        {
          name: 'floating product helper is not repeated on later frames',
          color: [255, 83, 180],
          tolerance: 2,
          maxPixels: 20000
        }
      ]
    }
  },
  {
    name: 'internal-scroll-container-page',
    path: '/internal-scroll-container-page.html',
    expected: 'download',
    assertions: {
      heightGreaterThanViewport: true,
      minColorPixels: [
        {
          name: 'internal scroll bottom marker is captured',
          color: [255, 120, 0],
          minPixels: 12000
        }
      ]
    }
  },
  {
    name: 'empty-editor-side-palette-page',
    path: '/empty-editor-side-palette-page.html',
    expected: 'download',
    assertions: {
      maxHeight: 1300,
      captureDiagnosticsV2: {
        status: 'success',
        exportStatus: 'saved',
        scrollTargetType: 'window'
      },
      minColorPixels: [
        {
          name: 'visible editor side palette is included',
          color: [20, 90, 190],
          minPixels: 12000
        }
      ]
    }
  },
  {
    name: 'empty-editor-side-palette-page-explicit-png',
    path: '/empty-editor-side-palette-page.html',
    expected: 'download',
    exportFormat: 'png',
    assertions: {
      maxHeight: 1300,
      minColorPixels: [
        {
          name: 'visible editor side palette is included',
          color: [20, 90, 190],
          minPixels: 12000
        }
      ]
    }
  },
  {
    name: 'empty-editor-side-palette-page-invalid-format-falls-back-to-png',
    path: '/empty-editor-side-palette-page.html',
    expected: 'download',
    exportFormat: 'zip',
    assertions: {
      maxHeight: 1300,
      minColorPixels: [
        {
          name: 'visible editor side palette is included',
          color: [20, 90, 190],
          minPixels: 12000
        }
      ]
    }
  },
  {
    name: 'empty-editor-side-palette-page-pdf-single-page',
    path: '/empty-editor-side-palette-page.html',
    expected: 'download-pdf',
    exportFormat: 'pdf',
    assertions: {
      pdf: {
        pageCount: 1
      },
      captureDiagnosticsV2: {
        status: 'success',
        exportStatus: 'saved',
        scrollTargetType: 'window',
        exportFormat: 'pdf',
        pdfPageCount: 1,
        pdfSource: 'single-bitmap',
        pdfPageMode: 'single-page'
      }
    }
  },
  {
    name: 'scroll-settle-gap-page',
    path: '/scroll-settle-gap-page.html',
    expected: 'download',
    assertions: {
      heightGreaterThanViewport: true,
      minColorPixels: [
        {
          name: 'final content marker is captured after scroll settle',
          color: [255, 120, 0],
          minPixels: 12000
        }
      ],
      colorBands: [
        {
          name: 'dark settle gap is not captured',
          color: [36, 36, 36],
          tolerance: 4,
          maxRows: 6,
          minRowFraction: 0.95
        }
      ]
    }
  },
  {
    name: 'short-chat-internal-scroll-page',
    path: '/short-chat-internal-scroll-page.html',
    expected: 'download',
    assertions: {
      heightGreaterThanViewport: true,
      minColorPixels: [
        {
          name: 'short chat sidebar is included in app shell capture',
          color: [160, 40, 250],
          minPixels: 12000
        }
      ]
    }
  },
  {
    name: 'dynamic-internal-scroll-page',
    path: '/dynamic-internal-scroll-page.html',
    expected: 'download',
    assertions: {
      heightGreaterThanViewport: true,
      minColorPixels: [
        {
          name: 'dynamic internal scroll tail is captured after warmup remeasure',
          color: [90, 80, 255],
          minPixels: 12000
        }
      ]
    }
  },
  {
    name: 'stuck-window-scroll-page',
    path: '/stuck-window-scroll-page.html',
    expected: 'error',
    errorIncludes: 'Scroll target did not move',
    assertions: {
      captureDiagnosticsV2: {
        status: 'failed',
        exportStatus: 'not_started',
        scrollTargetType: 'window',
        failureReason: 'scroll_target_stuck'
      }
    }
  }
];

const riskCases = [
  {
    name: 'docs-two-scroll-main-content-page',
    path: '/docs-two-scroll-main-content-page.html',
    expected: 'download',
    assertions: {
      heightGreaterThanViewport: true,
      captureDiagnosticsV2: {
        status: 'success',
        exportStatus: 'saved',
        scrollTargetType: 'element'
      },
      minColorPixels: [
        {
          name: 'main article bottom marker is captured',
          color: [255, 112, 0],
          tolerance: 2,
          minPixels: 12000
        }
      ],
      maxColorPixels: [
        {
          name: 'left docs sidebar content is not repeatedly stitched',
          color: [191, 64, 255],
          tolerance: 2,
          maxPixels: 150000
        }
      ]
    }
  },
  {
    name: 'late-sticky-below-first-viewport-page',
    path: '/late-sticky-below-first-viewport-page.html',
    expected: 'download',
    assertions: {
      heightGreaterThanViewport: true,
      captureDiagnosticsV2: {
        status: 'success',
        exportStatus: 'saved',
        scrollTargetType: 'window',
        fixedStickyCandidateCountAtMost: 0
      },
      colorBands: [
        {
          name: 'late sticky strip is normalized once instead of repeating',
          color: [255, 64, 180],
          tolerance: 2,
          minRows: 50,
          maxRows: 120,
          minRowFraction: 0.55
        }
      ],
      minColorPixels: [
        {
          name: 'content below late sticky is captured',
          color: [20, 180, 120],
          tolerance: 2,
          minPixels: 12000
        }
      ]
    }
  },
  {
    name: 'cookie-strip-repeat-page',
    path: '/cookie-strip-repeat-page.html',
    expected: 'download',
    assertions: {
      heightGreaterThanViewport: true,
      minColorPixels: [
        {
          name: 'cookie strip is preserved in first viewport',
          color: [0, 180, 255],
          tolerance: 2,
          minPixels: 20000
        }
      ],
      maxColorPixels: [
        {
          name: 'cookie strip is not repeated across later frames',
          color: [0, 180, 255],
          tolerance: 2,
          maxPixels: 140000
        }
      ]
    }
  },
  {
    name: 'split-boundary-text-page',
    path: '/split-boundary-text-page.html',
    expected: 'download',
    assertions: {
      heightGreaterThanViewport: true,
      minColorPixels: [
        {
          name: 'large boundary heading remains present',
          color: [210, 30, 70],
          tolerance: 2,
          minPixels: 26000
        },
        {
          name: 'following subtitle remains present',
          color: [20, 110, 220],
          tolerance: 2,
          minPixels: 10000
        }
      ]
    }
  },
  {
    name: 'dimmed-popup-scroll-state-page',
    path: '/dimmed-popup-scroll-state-page.html',
    expected: 'download',
    storageOverrides: {
      lazyWarmupEnabled: false
    },
    assertions: {
      heightGreaterThanViewport: true,
      minColorPixels: [
        {
          name: 'scrollable popup backdrop keeps later viewports dimmed',
          color: [120, 120, 120],
          tolerance: 2,
          minPixels: 1800000
        },
        {
          name: 'popup panel is preserved in first viewport',
          color: [255, 96, 0],
          tolerance: 2,
          minPixels: 20000
        }
      ],
      maxColorPixels: [
        {
          name: 'popup panel is not repeated across later frames',
          color: [255, 96, 0],
          tolerance: 2,
          maxPixels: 180000
        }
      ],
      captureDiagnosticsV2: {
        status: 'success',
        exportStatus: 'saved',
        scrollTargetType: 'window',
        riskFlagsInclude: ['fixed_sticky']
      }
    }
  },
  {
    name: 'fixed-background-quirk-page',
    path: '/fixed-background-quirk-page.html',
    expected: 'download',
    assertions: {
      heightGreaterThanViewport: true,
      captureDiagnosticsV2: {
        status: 'success',
        exportStatus: 'saved',
        scrollTargetType: 'window',
        riskFlagsInclude: ['fixed_sticky'],
        quirksAppliedInclude: ['preserve-fixed-background']
      },
      minColorPixels: [
        {
          name: 'fixed design background remains visible across capture',
          color: [18, 70, 120],
          tolerance: 2,
          minPixels: 900000
        },
        {
          name: 'content below fixed background page is captured',
          color: [40, 190, 120],
          tolerance: 2,
          minPixels: 12000
        }
      ]
    }
  },
  {
    name: 'lightbox-root-quirk-page',
    path: '/lightbox-root-quirk-page.html',
    expected: 'download',
    assertions: {
      heightGreaterThanViewport: true,
      captureDiagnosticsV2: {
        status: 'success',
        exportStatus: 'saved',
        scrollTargetType: 'element',
        scrollTargetComposeMode: 'lightbox-root',
        quirksAppliedInclude: ['known-lightbox-root']
      },
      minColorPixels: [
        {
          name: 'known lightbox root content is captured',
          color: [28, 110, 220],
          tolerance: 2,
          minPixels: 120000
        },
        {
          name: 'known lightbox root tail is captured',
          color: [40, 190, 120],
          tolerance: 2,
          minPixels: 12000
        }
      ],
      maxColorPixels: [
        {
          name: 'underlying page is not captured as root',
          color: [210, 30, 140],
          tolerance: 2,
          maxPixels: 20000
        }
      ]
    }
  },
  {
    name: 'fullscreen-menu-not-lightbox-page',
    path: '/fullscreen-menu-not-lightbox-page.html',
    expected: 'download',
    assertions: {
      heightGreaterThanViewport: true,
      captureDiagnosticsV2: {
        status: 'success',
        exportStatus: 'saved',
        scrollTargetType: 'window',
        quirksAppliedExclude: ['known-lightbox-root']
      },
      minColorPixels: [
        {
          name: 'fullscreen nav is still visible content, not lightbox root',
          color: [42, 48, 66],
          tolerance: 2,
          minPixels: 100000
        }
      ]
    }
  },
  {
    name: 'right-gray-strip-page',
    path: '/right-gray-strip-page.html',
    expected: 'download',
    assertions: {
      heightGreaterThanViewport: true,
      maxColorPixels: [
        {
          name: 'right-side gray artifact color is absent',
          color: [180, 180, 180],
          tolerance: 3,
          maxPixels: 200
        }
      ],
      minColorPixels: [
        {
          name: 'right-edge content marker is preserved',
          color: [40, 190, 120],
          tolerance: 2,
          minPixels: 12000
        }
      ]
    }
  },
  {
    name: 'product-card-seam-band-page',
    path: '/product-card-seam-band-page.html',
    expected: 'download',
    assertions: {
      heightGreaterThanViewport: true,
      colorBands: [
        {
          name: 'horizontal seam artifact band is absent',
          color: [225, 225, 225],
          tolerance: 2,
          maxRows: 3,
          minRowFraction: 0.75
        }
      ],
      minColorPixels: [
        {
          name: 'deep product grid marker is captured',
          color: [35, 120, 255],
          tolerance: 2,
          minPixels: 12000
        }
      ]
    }
  },
  {
    name: 'grid-row-boundary-shift-page',
    path: '/grid-row-boundary-shift-page.html',
    expected: 'download',
    assertions: {
      heightGreaterThanViewport: true,
      captureDiagnosticsV2: {
        status: 'success',
        exportStatus: 'saved',
        scrollTargetType: 'window',
        geometryGridRowAddedAtLeast: 1,
        capturePlanAvoidRangeReasonAtLeast: {
          reason: 'grid-row',
          count: 1
        },
        frameDiagnostics: [
          {
            frameIndex: 1,
            scrollYAtMost: 790
          }
        ]
      },
      minColorPixels: [
        {
          name: 'lower content marker is captured after shifted boundary',
          color: [35, 120, 255],
          tolerance: 2,
          minPixels: 12000
        }
      ]
    }
  },
  {
    name: 'rei-backpacks-product-grid-page',
    path: '/rei-backpacks-product-grid-page.html',
    expected: 'multi-download',
    assertions: {
      minDownloads: 2,
      maxPartHeight: 16384,
      summedHeightGreaterThanViewport: true,
      captureDiagnosticsV2: {
        status: 'success',
        outputStrategy: 'tiled-output',
        exportStatus: 'saved',
        scrollTargetType: 'window',
        riskFlagsInclude: ['fixed_sticky'],
        fixedStickyCandidateCountAtLeast: 1,
        splitExclusionRangeCountAtLeast: 50
      },
      colorBands: [
        {
          name: 'REI-like product grid has no horizontal seam artifact band',
          color: [225, 225, 225],
          tolerance: 2,
          maxRows: 3,
          minRowFraction: 0.75
        }
      ],
      boundaryForbiddenColors: [
        {
          name: 'PNG part boundaries do not cut through product-card interiors',
          color: [246, 240, 230],
          tolerance: 2,
          bandHeight: 28,
          maxPixelsPerBoundary: 500
        }
      ],
      minColorPixels: [
        {
          name: 'REI-like Store Pickup filter form is captured once',
          color: [20, 120, 70],
          tolerance: 2,
          minPixels: 8000
        }
      ],
      maxColorPixels: [
        {
          name: 'REI-like Store Pickup filter form is not duplicated',
          color: [20, 120, 70],
          tolerance: 2,
          maxPixels: 16000
        },
        {
          name: 'REI-like category sidebar block is not duplicated',
          color: [191, 64, 255],
          tolerance: 2,
          maxPixels: 16000
        }
      ],
      singleFileExportAttempt: {
        decision: 'parts',
        reason: 'single_canvas_exceeds_limits',
        attempted: false
      }
    }
  },
  {
    name: 'missing-middle-content-page',
    path: '/missing-middle-content-page.html',
    expected: 'download',
    assertions: {
      heightGreaterThanViewport: true,
      minColorPixels: [
        {
          name: 'middle content marker is captured',
          color: [245, 120, 40],
          tolerance: 2,
          minPixels: 14000
        },
        {
          name: 'lower content marker is captured',
          color: [80, 90, 255],
          tolerance: 2,
          minPixels: 14000
        }
      ],
      maxColorPixels: [
        {
          name: 'black missing-content strip is absent',
          color: [0, 0, 0],
          tolerance: 2,
          maxPixels: 1000
        }
      ]
    }
  },
  {
    name: 'apple-values-three-card-carousel-page',
    path: '/apple-values-three-card-carousel-page.html',
    expected: 'download',
    assertions: {
      heightGreaterThanViewport: true,
      minColorPixels: [
        {
          name: 'left values card is captured',
          color: [35, 120, 255],
          tolerance: 2,
          minPixels: 12000
        },
        {
          name: 'middle privacy values card is captured',
          color: [245, 120, 40],
          tolerance: 2,
          minPixels: 12000
        },
        {
          name: 'right accessibility values card is captured',
          color: [20, 180, 120],
          tolerance: 2,
          minPixels: 12000
        },
        {
          name: 'benefits row below values cards is captured',
          color: [80, 120, 255],
          tolerance: 2,
          minPixels: 12000
        }
      ]
    }
  },
  {
    name: 'apple-iphone-incentive-boundary-page',
    path: '/apple-iphone-incentive-boundary-page.html',
    expected: 'download',
    assertions: {
      heightGreaterThanViewport: true,
      minColorPixels: [
	        {
	          name: 'iPhone incentive headline remains present',
	          color: [210, 30, 70],
	          tolerance: 2,
	          minPixels: 20000
	        },
	        {
	          name: 'iPhone incentive subcopy remains present',
	          color: [20, 110, 220],
	          tolerance: 2,
	          minPixels: 5000
	        },
        {
          name: 'trade-in card below heading is captured',
          color: [20, 180, 120],
          tolerance: 2,
          minPixels: 12000
        },
        {
          name: 'ways-to-buy card below heading is captured',
          color: [255, 170, 20],
          tolerance: 2,
          minPixels: 12000
        },
        {
          name: 'carrier deals card below heading is captured',
          color: [80, 120, 255],
          tolerance: 2,
          minPixels: 12000
        }
      ]
    }
  },
  {
    name: 'apple-iphone-directory-columns-page',
    path: '/apple-iphone-directory-columns-page.html',
    expected: 'download',
    assertions: {
      heightGreaterThanViewport: true,
      minColorPixels: [
        {
          name: 'explore iPhone directory column is captured',
          color: [20, 180, 120],
          tolerance: 2,
          minPixels: 12000
        },
        {
          name: 'shop iPhone directory column is captured',
          color: [255, 170, 20],
          tolerance: 2,
          minPixels: 12000
        },
        {
          name: 'more from iPhone directory column is captured',
          color: [80, 120, 255],
          tolerance: 2,
          minPixels: 12000
        }
      ]
    }
  },
  {
    name: 'lazy-footer-links-page',
    path: '/lazy-footer-links-page.html',
    expected: 'download',
    assertions: {
      heightGreaterThanViewport: true,
      minColorPixels: [
        {
          name: 'lazy company footer links are captured',
          color: [20, 180, 120],
          tolerance: 2,
          minPixels: 18000
        },
        {
          name: 'lazy information footer links are captured',
          color: [255, 170, 20],
          tolerance: 2,
          minPixels: 18000
        },
        {
          name: 'footer bottom marker is captured',
          color: [80, 120, 255],
          tolerance: 2,
          minPixels: 18000
        }
      ]
    }
  },
  {
    name: 'product-hero-duplication-page',
    path: '/product-hero-duplication-page.html',
    expected: 'download',
    assertions: {
      heightGreaterThanViewport: true,
      minColorPixels: [
        {
          name: 'product hero title remains present',
          color: [230, 40, 80],
          tolerance: 2,
          minPixels: 30000
        },
        {
          name: 'product media remains present',
          color: [35, 120, 255],
          tolerance: 2,
          minPixels: 120000
        },
        {
          name: 'lower background section remains present',
          color: [245, 120, 40],
          tolerance: 2,
          minPixels: 40000
        },
        {
          name: 'lower top text marker remains present',
          color: [130, 90, 255],
          tolerance: 2,
          minPixels: 30000
        }
      ],
      maxColorPixels: [
        {
          name: 'product hero title is not duplicated',
          color: [230, 40, 80],
          tolerance: 2,
          maxPixels: 95000
        }
      ]
    }
  }
];

const activeCases = process.env.CAPTURE_CASE_FILTER ?
  [...cases, ...riskCases].filter(testCase => testCase.name.includes(process.env.CAPTURE_CASE_FILTER)) :
  (process.env.CAPTURE_INCLUDE_RISK_FIXTURES === '1' ? [...cases, ...riskCases] : cases);

const downloadedArtifactName = ({downloadedFile, captureDiagnostics, index}) => {
  const diagnosticFilename = captureDiagnostics?.capture?.export?.files?.[index]?.filename;
  const filename = diagnosticFilename || path.basename(downloadedFile);

  return path.basename(filename);
};

const ensureCleanDir = async dir => {
  await fs.rm(dir, {recursive: true, force: true});
  await fs.mkdir(dir, {recursive: true});
};

const writeSummaryReport = async summary => {
  const lines = [
    '# Capture Flow Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Status: ${summary.status}`,
    '',
    `Viewport: ${viewport.width}x${viewport.height}`,
    '',
    '| Case | Status | Expected | PNG | Report |',
    '| --- | --- | --- | --- | --- |',
    ...summary.cases.map(result => {
      const png = result.pngs ?
        result.pngs.map(png => `${png.width}x${png.height}`).join(', ') :
        (result.png ? `${result.png.width}x${result.png.height}` : 'n/a');
      return `| ${result.caseName} | ${result.status} | ${result.expected} | ${png} | ${result.reportPath} |`;
    }),
    ''
  ];

  const failed = summary.cases.filter(result => result.status !== 'passed');
  if (failed.length) {
    lines.push('## Failures', '');
    for (const result of failed) {
      lines.push(`### ${result.caseName}`, '', result.error || 'Unknown failure.', '');
    }
  }

  await fs.writeFile(path.join(latestDir, 'report.md'), lines.join('\n'), 'utf8');
};

const writeCaseReport = async (caseDir, report) => {
  const lines = [
    `# Capture Flow Case: ${report.caseName}`,
    '',
    `Generated: ${new Date().toISOString()}`,
    `Status: ${report.status}`,
    '',
    `- Expected: ${report.expected}`,
    `- URL: ${report.url || 'n/a'}`,
    `- Viewport: ${viewport.width}x${viewport.height}`,
    `- Download: ${report.download || 'n/a'}`,
    `- PNG size: ${report.png ? `${report.png.width}x${report.png.height}` : 'n/a'}`,
    `- PNG parts: ${report.pngs ? report.pngs.map(png => `${png.width}x${png.height}`).join(', ') : 'n/a'}`,
    `- Error matched: ${report.errorMatched === undefined ? 'n/a' : report.errorMatched}`,
    ''
  ];

  if (report.diagnostics) {
    lines.push('## Diagnostics', '');
    lines.push(`- iframeCount: ${report.diagnostics.iframeCount}`);
    lines.push(`- inaccessibleIframeCount: ${report.diagnostics.inaccessibleIframeCount}`);
    lines.push('');
  }

  if (report.captureDiagnostics?.diagnostics?.imageReadiness) {
    const lazyWarmup = report.captureDiagnostics.diagnostics.lazyWarmup;
    if (lazyWarmup) {
      lines.push('## Lazy Warmup', '');
      lines.push(`- skipped: ${lazyWarmup.skipped ? 'yes' : 'no'}`);
      lines.push(`- reason: ${lazyWarmup.reason || 'n/a'}`);
      lines.push(`- visited: ${lazyWarmup.visited ?? 'n/a'}`);
      lines.push(`- elapsedMs: ${lazyWarmup.elapsedMs ?? 'n/a'}`);
      lines.push(`- timedOut: ${lazyWarmup.timedOut ? 'yes' : 'no'}`);
      lines.push('');
    }

    const imageReadiness = report.captureDiagnostics.diagnostics.imageReadiness;
    const frames = report.captureDiagnostics.diagnostics.stepper?.frames || [];
    lines.push('## Image Readiness Diagnostics', '');
    lines.push(`- beforeWarmup: ${formatReadinessSummary(imageReadiness.beforeWarmup)}`);
    lines.push(`- afterWarmup: ${formatReadinessSummary(imageReadiness.afterWarmup)}`);
    lines.push(`- frameDiagnostics: ${frames.filter(frame => frame.imageReadiness).length}`);
    lines.push('');

    if (frames.length) {
      lines.push('## Frame Diagnostics', '');
      for (const frame of frames.slice(0, 8)) {
        const draw = frame.draw ?
          `, bitmap=${frame.draw.imageWidth}x${frame.draw.imageHeight}, scale=${Number(frame.draw.sourceScaleX).toFixed(3)}x${Number(frame.draw.sourceScaleY).toFixed(3)}` :
          '';
        const syntheticDim = frame.beforeFrame?.syntheticDimBackdropApplied ? ', syntheticDim=yes' : '';
        const policy = frame.beforeFrame?.capturePolicyApplied ? ', policy=yes' : '';
        const navSuppress = frame.beforeFrame?.suppressVisibleNavOverlay ? ', navSuppress=yes' : '';
        const chromeCandidates = Number(frame.beforeFrame?.chromeCandidateCount) || 0;
        lines.push(`- frame ${frame.frameIndex}: hidden=${frame.beforeFrame?.hidden || 0}, transformed=${frame.beforeFrame?.transformed || 0}, chromeCandidates=${chromeCandidates}${syntheticDim}${policy}${navSuppress}, scroll=${frame.scroll?.x || 0},${frame.scroll?.y || 0}, settled=${frame.scrollSettled === false ? 'no' : 'yes'}${draw}`);
      }
      lines.push('');
    }

    const repeatedChrome = report.captureDiagnostics.diagnostics.stepper?.repeatedChrome;
    if (repeatedChrome) {
      lines.push('## Repeated Chrome Diagnostics', '');
      lines.push(`- candidateCount: ${repeatedChrome.candidateCount || 0}`);
      lines.push(`- repeatedCount: ${repeatedChrome.repeatedCount || 0}`);
      lines.push(`- reasons: ${(repeatedChrome.reasons || []).join(', ') || 'none'}`);
      for (const candidate of (repeatedChrome.repeated || []).slice(0, 6)) {
        lines.push(`- ${candidate.reason}: ${candidate.kind} frames=${(candidate.frames || []).join(',')} action=${candidate.action || 'observe'} rect=${candidate.sampleRect || 'n/a'}`);
      }
      lines.push('');
    }

    const stickyNormalization = report.captureDiagnostics.diagnostics.stickyNormalization?.active ||
      report.captureDiagnostics.diagnostics.stickyNormalization?.afterWarmup ||
      report.captureDiagnostics.diagnostics.stickyNormalization?.beforeWarmup;
    if (stickyNormalization) {
      lines.push('## Sticky Normalization Diagnostics', '');
      lines.push(`- applied: ${stickyNormalization.applied ? 'yes' : 'no'}`);
      lines.push(`- normalized: ${stickyNormalization.normalized || 0}`);
      lines.push(`- framesWithNormalizedSticky: ${stickyNormalization.framesWithNormalizedSticky || 0}`);
      lines.push(`- frameCount: ${stickyNormalization.frameCount || 0}`);
      lines.push(`- shadowRootCount: ${stickyNormalization.shadowRootCount || 0}`);
      lines.push(`- reasons: ${(stickyNormalization.reasons || [stickyNormalization.reason]).filter(Boolean).join(', ') || 'none'}`);
      lines.push('');
    }

    const cleanup = report.captureDiagnostics.diagnostics.cleanup?.content;
    if (cleanup) {
      lines.push('## Cleanup Diagnostics', '');
      lines.push(`- restored: ${cleanup.restored === false ? 'no' : 'yes'}`);
      lines.push(`- stickyMarkers: before=${cleanup.beforeRestore?.stickyMarkers || 0}, after=${cleanup.afterRestore?.stickyMarkers || 0}`);
      lines.push(`- stickyNormalizationRules: before=${cleanup.beforeRestore?.stickyNormalizationRules || 0}, after=${cleanup.afterRestore?.stickyNormalizationRules || 0}`);
      lines.push('');
    }
  }

  if (report.captureDiagnostics?.diagnostics?.singleFileExportAttempt) {
    const attempt = report.captureDiagnostics.diagnostics.singleFileExportAttempt;
    lines.push('## Single File Export Attempt', '');
    lines.push(`- decision: ${attempt.decision}`);
    lines.push(`- reason: ${attempt.reason}`);
    lines.push(`- attempted: ${attempt.attempted}`);
    lines.push(`- safe: ${attempt.safe}`);
    lines.push(`- bitmap: ${attempt.bitmapWidth}x${attempt.bitmapHeight}`);
    lines.push(`- tileCount: ${attempt.tileCount}`);
    lines.push('');
  }

  if (report.captureDiagnostics?.capture) {
    const capture = report.captureDiagnostics.capture;
    lines.push('## Capture Diagnostics v2', '');
    const bitmap = capture.output ?
      `${capture.output.bitmapWidth}x${capture.output.bitmapHeight}` :
      (capture.page ? `${capture.page.bitmapWidth}x${capture.page.bitmapHeight}` : 'n/a');
    lines.push(`- status: ${capture.status}`);
    lines.push(`- failureReason: ${capture.failureReason || 'n/a'}`);
    lines.push(`- cssPage: ${capture.page ? `${capture.page.cssWidth}x${capture.page.cssHeight}` : 'n/a'}`);
    lines.push(`- bitmap: ${bitmap}`);
    lines.push(`- dpr: ${capture.output?.dpr || capture.page?.dpr || 'n/a'}`);
    lines.push(`- strategy: ${capture.output?.strategy || 'n/a'}`);
    lines.push(`- tileCount: ${capture.output?.tileCount || 'n/a'}`);
    lines.push(`- scrollTarget: ${capture.scrollTarget?.type || 'n/a'}`);
    const capturePolicy = capture.page?.capturePolicy || capture.scrollTarget?.capturePolicy || capture.scrollTarget?.diagnostics?.capturePolicy;
    if (capturePolicy) {
      lines.push(`- capturePolicy: mode=${capturePolicy.mode || 'n/a'}, reasons=${(capturePolicy.reasons || []).join(', ') || 'none'}`);
      lines.push(`- capturePolicy.afterFirstFrame: normalizeFixedSticky=${capturePolicy.afterFirstFrame?.normalizeFixedSticky ? 'yes' : 'no'}, suppressVisibleNavOverlay=${capturePolicy.afterFirstFrame?.suppressVisibleNavOverlay ? 'yes' : 'no'}, suppressRepeatedOverlays=${capturePolicy.afterFirstFrame?.suppressRepeatedOverlays ? 'yes' : 'no'}, preserveDimmedBackdrop=${capturePolicy.afterFirstFrame?.preserveDimmedBackdrop ? 'yes' : 'no'}`);
      lines.push(`- capturePolicy.skipLazyWarmupBeforeFirstFrame: ${capturePolicy.skipLazyWarmupBeforeFirstFrame ? 'yes' : 'no'}`);
    }
    if (capture.scrollTarget?.diagnostics) {
      lines.push(`- riskFlags: ${(capture.scrollTarget.diagnostics.riskFlags || []).join(', ') || 'none'}`);
      lines.push(`- fixedStickyCandidates: ${capture.scrollTarget.diagnostics.fixedStickyCandidateCount || 0}`);
      lines.push(`- visibleOverlayCandidates: ${capture.scrollTarget.diagnostics.visibleOverlayCandidateCount || 0}`);
      const geometryAvoidRanges = capture.scrollTarget.diagnostics.geometryAvoidRangeDiagnostics;
      if (geometryAvoidRanges) {
        lines.push(`- geometryAvoidRanges: scanned=${geometryAvoidRanges.scanned || 0}, cardAdded=${geometryAvoidRanges.cardAdded || 0}, gridRowAdded=${geometryAvoidRanges.gridRowAdded || 0}, elapsedMs=${geometryAvoidRanges.elapsedMs ?? 'n/a'}`);
      }
      const capturePlanSummary = capture.scrollTarget.diagnostics.capturePlanSummary;
      if (capturePlanSummary) {
        const reasons = Object.entries(capturePlanSummary.avoidRangeReasons || {})
          .map(([reason, count]) => `${reason}:${count}`)
          .join(', ') || 'none';
        lines.push(`- capturePlanAvoidRanges: ${capturePlanSummary.avoidRangeCount || 0}, reasons=${reasons}`);
      }
      if (capture.scrollTarget.diagnostics.splitLayoutRisk) {
        lines.push(`- splitLayoutRisk: yes, reason=${capture.scrollTarget.diagnostics.splitLayoutRiskReason || 'n/a'}, shortColumn=${capture.scrollTarget.diagnostics.shortColumnSide || 'n/a'}, heightRatio=${capture.scrollTarget.diagnostics.heightRatio || capture.scrollTarget.diagnostics.tallColumnRatio || 'n/a'}, stickyLike=${capture.scrollTarget.diagnostics.stickyLikeDetected ? 'yes' : 'no'}`);
      }
      lines.push(`- quirks: ${(capture.scrollTarget.diagnostics.quirks?.applied || []).join(', ') || 'none'}`);
    }
    lines.push(`- exportStatus: ${capture.export?.status || 'n/a'}`);
    lines.push(`- exportFiles: ${capture.export?.files?.length || 0}`);
    if (capture.export?.files?.length) {
      for (const file of capture.export.files) {
        const lifecycle = file.lifecycle || {};
        lines.push(`  - part ${file.part || '?'}: downloadId=${file.downloadId || 'n/a'}, wait=${lifecycle.waitStatus || 'n/a'}, started=${lifecycle.startedAt || 'n/a'}, completed=${lifecycle.completedAt || 'n/a'}, filename=${file.filename || 'n/a'}`);
      }
    }
    lines.push('');
  }

  if (report.notificationEvent) {
    lines.push('## Notification Event', '');
    lines.push(`- event: ${report.notificationEvent.event}`);
    lines.push(`- reason: ${report.notificationEvent.reason}`);
    lines.push(`- severity: ${report.notificationEvent.severity}`);
    lines.push(`- message: ${report.notificationEvent.message}`);
    lines.push('');
  }

  if (report.assertions?.length) {
    lines.push('## Assertions', '');
    for (const assertion of report.assertions) {
      lines.push(`- ${assertion.passed ? 'PASS' : 'FAIL'} ${assertion.name}: ${assertion.detail}`);
    }
    lines.push('');
  }

  if (report.errorMessage) {
    lines.push('## Captured Error', '', report.errorMessage, '');
  }

  if (report.error) {
    lines.push('## Failure', '', report.error, '');
  }

  await fs.writeFile(path.join(caseDir, 'report.md'), lines.join('\n'), 'utf8');
};

const startFixtureServer = async () => {
  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://127.0.0.1');
      const pathname = url.pathname === '/' ? '/basic-long-page.html' : url.pathname;
      const filePath = path.join(fixtureRoot, pathname);
      const content = await fs.readFile(filePath);

      response.writeHead(200, {
        'content-type': pathname.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream'
      });
      response.end(content);
    }
    catch {
      response.writeHead(404);
      response.end('Not found');
    }
  });

  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));

  return {
    server,
    origin: `http://127.0.0.1:${server.address().port}`
  };
};

const waitForDownloadedPng = async ({downloadsDir, timeoutMs = 20000}) => {
  const deadline = Date.now() + timeoutMs;
  let lastError;

  while (Date.now() < deadline) {
    const entries = await fs.readdir(downloadsDir).catch(() => []);
    const candidates = entries
      .filter(name => !name.endsWith('.crdownload'))
      .map(name => path.join(downloadsDir, name));

    for (const file of candidates) {
      try {
        const stat = await fs.stat(file);
        if (!stat.isFile()) {
          continue;
        }

        const bytes = await fs.readFile(file);
        if (bytes.length === 0) {
          continue;
        }

        const png = PNG.sync.read(bytes);
        return {file, png};
      }
      catch (error) {
        lastError = error;
      }
    }

    await new Promise(resolve => setTimeout(resolve, 250));
  }

  throw new Error(`PNG download did not complete.${lastError ? ` Last error: ${lastError.message}` : ''}`);
};

const waitForDownloadedPngs = async ({downloadsDir, minCount = 1, timeoutMs = 30000}) => {
  const deadline = Date.now() + timeoutMs;
  let lastError;

  while (Date.now() < deadline) {
    const entries = await fs.readdir(downloadsDir).catch(() => []);
    const hasPendingDownload = entries.some(name => name.endsWith('.crdownload'));
    const candidates = entries
      .filter(name => !name.endsWith('.crdownload'))
      .map(name => path.join(downloadsDir, name));
    const pngs = [];

    for (const file of candidates) {
      try {
        const stat = await fs.stat(file);
        if (!stat.isFile()) {
          continue;
        }

        const bytes = await fs.readFile(file);
        if (bytes.length === 0) {
          continue;
        }

        pngs.push({
          file,
          createdAt: stat.birthtimeMs || stat.mtimeMs,
          png: PNG.sync.read(bytes)
        });
      }
      catch (error) {
        lastError = error;
      }
    }

    if (pngs.length >= minCount && !hasPendingDownload) {
      return pngs.sort((a, b) => a.createdAt - b.createdAt);
    }

    await new Promise(resolve => setTimeout(resolve, 250));
  }

  throw new Error(`PNG downloads did not complete.${lastError ? ` Last error: ${lastError.message}` : ''}`);
};

const waitForDownloadedPdf = async ({downloadsDir, timeoutMs = 20000}) => {
  const deadline = Date.now() + timeoutMs;
  let lastError;

  while (Date.now() < deadline) {
    const entries = await fs.readdir(downloadsDir).catch(() => []);
    const candidates = entries
      .filter(name => !name.endsWith('.crdownload'))
      .map(name => path.join(downloadsDir, name));

    for (const file of candidates) {
      try {
        const stat = await fs.stat(file);
        if (!stat.isFile()) {
          continue;
        }

        const bytes = await fs.readFile(file);
        if (bytes.length === 0) {
          continue;
        }

        const header = bytes.subarray(0, 8).toString('latin1');
        if (!header.startsWith('%PDF-')) {
          continue;
        }

        return {file, bytes};
      } catch (error) {
        lastError = error;
      }
    }

    await new Promise(resolve => setTimeout(resolve, 250));
  }

  throw new Error(`PDF download did not complete.${lastError ? ` Last error: ${lastError.message}` : ''}`);
};

const assertNoDownloadedPng = async ({downloadsDir, timeoutMs = 1500}) => {
  try {
    const {file} = await waitForDownloadedPng({downloadsDir, timeoutMs});
    throw new Error(`Expected no PNG download, but found ${file}.`);
  }
  catch (error) {
    if (!error.message.startsWith('PNG download did not complete.')) {
      throw error;
    }
  }
};

const matchesColor = (data, index, color, tolerance) => {
  return Math.abs(data[index] - color[0]) <= tolerance &&
    Math.abs(data[index + 1] - color[1]) <= tolerance &&
    Math.abs(data[index + 2] - color[2]) <= tolerance &&
    data[index + 3] > 0;
};

const countColorPixels = (png, color, tolerance = 4) => {
  let count = 0;

  for (let index = 0; index < png.data.length; index += 4) {
    if (matchesColor(png.data, index, color, tolerance)) {
      count += 1;
    }
  }

  return count;
};

const countColorPixelsInRows = (png, color, tolerance = 4, startY = 0, endY = png.height) => {
  let count = 0;
  const top = Math.max(0, Math.floor(startY));
  const bottom = Math.min(png.height, Math.ceil(endY));

  for (let y = top; y < bottom; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const index = (y * png.width + x) * 4;
      if (matchesColor(png.data, index, color, tolerance)) {
        count += 1;
      }
    }
  }

  return count;
};

const countRowsWithColorBand = (png, {color, tolerance = 4, minRowFraction = 0.5}) => {
  let rows = 0;
  const minimumPixels = Math.ceil(png.width * minRowFraction);

  for (let y = 0; y < png.height; y += 1) {
    let matchingPixels = 0;

    for (let x = 0; x < png.width; x += 1) {
      const index = (y * png.width + x) * 4;
      if (matchesColor(png.data, index, color, tolerance)) {
        matchingPixels += 1;
      }
    }

    if (matchingPixels >= minimumPixels) {
      rows += 1;
    }
  }

  return rows;
};

const formatReadinessRatio = value => {
  if (!Number.isFinite(value)) {
    return 'n/a';
  }

  return `${Math.round(value * 100)}%`;
};

const formatReadinessSummary = readiness => {
  if (!readiness) {
    return 'n/a';
  }

  return [
    `visible=${readiness.visibleImages}`,
    `ready=${readiness.readyImages}`,
    `pending=${readiness.pendingImages}`,
    `broken=${readiness.brokenImages}`,
    `placeholders=${readiness.placeholderBlocks}`,
    `ratio=${formatReadinessRatio(readiness.readinessRatio)}`
  ].join(', ');
};

const getImageReadinessSamples = captureDiagnostics => {
  const diagnostics = captureDiagnostics?.diagnostics || {};
  const imageReadiness = diagnostics.imageReadiness || {};
  const frames = diagnostics.stepper?.frames || [];

  return [
    imageReadiness.beforeWarmup,
    imageReadiness.lazyWarmup?.before,
    imageReadiness.lazyWarmup?.after,
    imageReadiness.afterWarmup,
    ...frames.map(frame => frame.imageReadiness)
  ].filter(Boolean);
};

const evaluateImageReadinessAssertions = ({testCase, captureDiagnostics}) => {
  const config = testCase.assertions?.imageReadiness;
  if (!config) {
    return [];
  }

  const results = [];
  const diagnostics = captureDiagnostics?.diagnostics || {};
  const imageReadiness = diagnostics.imageReadiness || {};
  const frames = diagnostics.stepper?.frames || [];
  const samples = getImageReadinessSamples(captureDiagnostics);

  results.push({
    name: 'image readiness diagnostics are stored',
    passed: Boolean(captureDiagnostics?.diagnostics?.imageReadiness),
    detail: captureDiagnostics ? 'diagnostics present' : 'diagnostics missing'
  });

  if (config.beforePendingAtLeast !== undefined) {
    const pending = imageReadiness.beforeWarmup?.pendingImages || 0;
    results.push({
      name: 'pre-warmup pending images are detected',
      passed: pending >= config.beforePendingAtLeast,
      detail: `${pending} pending images, expected >= ${config.beforePendingAtLeast}`
    });
  }

  if (config.afterReadyAtLeastBefore) {
    const beforeReady = imageReadiness.beforeWarmup?.readyImages || 0;
    const afterReady = imageReadiness.afterWarmup?.readyImages || 0;
    results.push({
      name: 'post-warmup ready image count does not regress',
      passed: afterReady >= beforeReady,
      detail: `${afterReady} ready after warmup, ${beforeReady} before warmup`
    });
  }

  if (config.afterReadinessAtLeastBefore) {
    const beforeRatio = imageReadiness.beforeWarmup?.readinessRatio || 0;
    const afterRatio = imageReadiness.afterWarmup?.readinessRatio || 0;
    results.push({
      name: 'post-warmup readiness ratio does not regress',
      passed: afterRatio >= beforeRatio,
      detail: `${formatReadinessRatio(afterRatio)} after warmup, ${formatReadinessRatio(beforeRatio)} before warmup`
    });
  }

  if (config.brokenAnyFrameAtLeast !== undefined) {
    const broken = Math.max(0, ...samples.map(sample => sample.brokenImages || 0));
    results.push({
      name: 'broken image diagnostics are detected',
      passed: broken >= config.brokenAnyFrameAtLeast,
      detail: `${broken} broken images, expected >= ${config.brokenAnyFrameAtLeast}`
    });
  }

  if (config.frameDiagnosticsAtLeast !== undefined) {
    const frameCount = frames.filter(frame => frame.imageReadiness).length;
    results.push({
      name: 'per-frame image diagnostics are stored',
      passed: frameCount >= config.frameDiagnosticsAtLeast,
      detail: `${frameCount} frames with image diagnostics, expected >= ${config.frameDiagnosticsAtLeast}`
    });
  }

  return results;
};

const evaluatePngAssertions = ({testCase, png, captureDiagnostics}) => {
  const results = [];

  if (testCase.assertions?.heightGreaterThanViewport) {
    const passed = png.height > viewport.height;
    results.push({
      name: 'height greater than viewport',
      passed,
      detail: `${png.height}px > ${viewport.height}px`
    });
  }

  if (testCase.assertions?.maxHeight !== undefined) {
    const maxHeight = testCase.assertions.maxHeight;
    results.push({
      name: 'height does not exceed maximum',
      passed: png.height <= maxHeight,
      detail: `${png.height}px <= ${maxHeight}px`
    });
  }

  for (const assertion of testCase.assertions?.colorBands || []) {
    const rows = countRowsWithColorBand(png, assertion);
    const minRows = assertion.minRows || 0;
    const passed = rows >= minRows && rows <= assertion.maxRows;
    results.push({
      name: assertion.name,
      passed,
      detail: `${rows} matching rows, expected ${minRows}-${assertion.maxRows}`
    });
  }

  for (const assertion of testCase.assertions?.maxColorPixels || []) {
    const pixels = countColorPixels(png, assertion.color, assertion.tolerance);
    const passed = pixels <= assertion.maxPixels;
    results.push({
      name: assertion.name,
      passed,
      detail: `${pixels} matching pixels, expected <= ${assertion.maxPixels}`
    });
  }

  for (const assertion of testCase.assertions?.minColorPixels || []) {
    const pixels = countColorPixels(png, assertion.color, assertion.tolerance);
    const passed = pixels >= assertion.minPixels;
    results.push({
      name: assertion.name,
      passed,
      detail: `${pixels} matching pixels, expected >= ${assertion.minPixels}`
    });
  }

  if (testCase.assertions?.diagnostics?.iframeCountAtLeast !== undefined) {
    const iframeCount = testCase.diagnostics?.iframeCount || 0;
    const expected = testCase.assertions.diagnostics.iframeCountAtLeast;
    results.push({
      name: 'iframe diagnostics present',
      passed: iframeCount >= expected,
      detail: `${iframeCount} iframes, expected >= ${expected}`
    });
  }

  results.push(...evaluateImageReadinessAssertions({testCase, captureDiagnostics}));
  results.push(...evaluateCaptureDiagnosticsV2Assertions({testCase, captureDiagnostics}));

  return results;
};

// Browser-level PDF smoke stays intentionally small: header plus page count.
const evaluatePdfAssertions = ({testCase, bytes, captureDiagnostics}) => {
  const results = [];
  const pdfText = Buffer.from(bytes).toString('latin1');
  const pageCountMatch = pdfText.match(/\/Count (\d+)\b/);
  const pageCount = pageCountMatch ? Number(pageCountMatch[1]) : null;
  const expectedPdf = testCase.assertions?.pdf || {};

  results.push({
    name: 'downloaded file starts with PDF header',
    passed: pdfText.startsWith('%PDF-'),
    detail: pdfText.slice(0, 8) || 'n/a'
  });

  if (expectedPdf.pageCount !== undefined) {
    results.push({
      name: 'downloaded PDF page count matches expected value',
      passed: pageCount === expectedPdf.pageCount,
      detail: `${pageCount ?? 'n/a'}, expected ${expectedPdf.pageCount}`
    });
  }

  results.push(...evaluateCaptureDiagnosticsV2Assertions({testCase, captureDiagnostics}));

  return results;
};

const evaluateMultiPngAssertions = ({testCase, pngs}) => {
  const results = [];
  const minDownloads = testCase.assertions?.minDownloads || 1;

  results.push({
    name: 'minimum PNG parts downloaded',
    passed: pngs.length >= minDownloads,
    detail: `${pngs.length} parts, expected >= ${minDownloads}`
  });

  if (testCase.assertions?.maxPartHeight) {
    const maxHeight = Math.max(...pngs.map(({png}) => png.height));
    results.push({
      name: 'each PNG part stays under canvas limit',
      passed: maxHeight <= testCase.assertions.maxPartHeight,
      detail: `${maxHeight}px <= ${testCase.assertions.maxPartHeight}px`
    });
  }

  if (testCase.assertions?.summedHeightGreaterThanViewport) {
    const summedHeight = pngs.reduce((total, {png}) => total + png.height, 0);
    results.push({
      name: 'summed PNG parts exceed viewport',
      passed: summedHeight > viewport.height,
      detail: `${summedHeight}px > ${viewport.height}px`
    });
  }

  for (const assertion of testCase.assertions?.colorBands || []) {
    const rows = pngs.reduce((total, {png}) => total + countRowsWithColorBand(png, assertion), 0);
    const minRows = assertion.minRows || 0;
    results.push({
      name: assertion.name,
      passed: rows >= minRows && rows <= assertion.maxRows,
      detail: `${rows} matching rows across parts, expected ${minRows}-${assertion.maxRows}`
    });
  }

  for (const assertion of testCase.assertions?.maxColorPixels || []) {
    const pixels = pngs.reduce((total, {png}) => total + countColorPixels(png, assertion.color, assertion.tolerance), 0);
    results.push({
      name: assertion.name,
      passed: pixels <= assertion.maxPixels,
      detail: `${pixels} matching pixels across parts, expected <= ${assertion.maxPixels}`
    });
  }

  for (const assertion of testCase.assertions?.minColorPixels || []) {
    const pixels = pngs.reduce((total, {png}) => total + countColorPixels(png, assertion.color, assertion.tolerance), 0);
    results.push({
      name: assertion.name,
      passed: pixels >= assertion.minPixels,
      detail: `${pixels} matching pixels across parts, expected >= ${assertion.minPixels}`
    });
  }

  for (const assertion of testCase.assertions?.boundaryForbiddenColors || []) {
    const bandHeight = assertion.bandHeight || 24;
    const maxPixels = assertion.maxPixelsPerBoundary || 0;
    let worstBoundaryPixels = 0;

    for (let index = 0; index < pngs.length - 1; index += 1) {
      const before = pngs[index].png;
      const after = pngs[index + 1].png;
      const beforePixels = countColorPixelsInRows(
        before,
        assertion.color,
        assertion.tolerance,
        Math.max(0, before.height - bandHeight),
        before.height
      );
      const afterPixels = countColorPixelsInRows(
        after,
        assertion.color,
        assertion.tolerance,
        0,
        Math.min(after.height, bandHeight)
      );
      worstBoundaryPixels = Math.max(worstBoundaryPixels, beforePixels, afterPixels);
    }

    results.push({
      name: assertion.name,
      passed: worstBoundaryPixels <= maxPixels,
      detail: `${worstBoundaryPixels} matching pixels at worst part boundary, expected <= ${maxPixels}`
    });
  }

  return results;
};

const evaluateNotificationAssertions = ({testCase, notificationEvent}) => {
  const expected = testCase.assertions?.notification;
  if (!expected) {
    return [];
  }

  return [
    {
      name: 'notification event is stored',
      passed: Boolean(notificationEvent),
      detail: notificationEvent ? 'notification event present' : 'notification event missing'
    },
    {
      name: 'notification event matches expected type',
      passed: notificationEvent?.event === expected.event,
      detail: `${notificationEvent?.event || 'n/a'}, expected ${expected.event}`
    },
    {
      name: 'notification reason matches expected reason',
      passed: notificationEvent?.reason === expected.reason,
      detail: `${notificationEvent?.reason || 'n/a'}, expected ${expected.reason}`
    },
    {
      name: 'notification message matches expected message',
      passed: !expected.message || notificationEvent?.message === expected.message,
      detail: `${notificationEvent?.message || 'n/a'}, expected ${expected.message || 'n/a'}`
    }
  ];
};

const evaluateSingleFileExportAttemptAssertions = ({testCase, captureDiagnostics}) => {
  const expected = testCase.assertions?.singleFileExportAttempt;
  if (!expected) {
    return [];
  }

  const attempt = captureDiagnostics?.diagnostics?.singleFileExportAttempt;

  return [
    {
      name: 'single-file export attempt is recorded',
      passed: Boolean(attempt),
      detail: attempt ? 'single-file export attempt present' : 'single-file export attempt missing'
    },
    {
      name: 'single-file export decision matches expected decision',
      passed: attempt?.decision === expected.decision,
      detail: `${attempt?.decision || 'n/a'}, expected ${expected.decision}`
    },
    {
      name: 'single-file export reason matches expected reason',
      passed: attempt?.reason === expected.reason,
      detail: `${attempt?.reason || 'n/a'}, expected ${expected.reason}`
    },
    {
      name: 'unsafe single-file export is not attempted',
      passed: attempt?.attempted === expected.attempted,
      detail: `${attempt?.attempted}, expected ${expected.attempted}`
    }
  ];
};

const evaluateCaptureDiagnosticsV2Assertions = ({testCase, captureDiagnostics}) => {
  const expected = testCase.assertions?.captureDiagnosticsV2;
  if (!expected) {
    return [];
  }

  const capture = captureDiagnostics?.capture;

  const results = [
    {
      name: 'capture diagnostics v2 is stored',
      passed: Boolean(capture && capture.version === 2),
      detail: capture ? `version ${capture.version}` : 'capture diagnostics missing'
    },
    {
      name: 'capture diagnostics status matches expected status',
      passed: capture?.status === expected.status,
      detail: `${capture?.status || 'n/a'}, expected ${expected.status}`
    },
  ];

  if (expected.outputStrategy !== undefined) {
    results.push({
      name: 'capture diagnostics output strategy matches expected strategy',
      passed: capture?.output?.strategy === expected.outputStrategy,
      detail: `${capture?.output?.strategy || 'n/a'}, expected ${expected.outputStrategy}`
    });
  }

  if (expected.exportFormat !== undefined) {
    results.push({
      name: 'capture diagnostics export format matches expected format',
      passed: capture?.export?.format === expected.exportFormat,
      detail: `${capture?.export?.format || 'n/a'}, expected ${expected.exportFormat}`
    });
  }

  if (expected.pdfPageCount !== undefined) {
    results.push({
      name: 'capture diagnostics PDF page count matches expected value',
      passed: capture?.export?.pdf?.pageCount === expected.pdfPageCount,
      detail: `${capture?.export?.pdf?.pageCount ?? 'n/a'}, expected ${expected.pdfPageCount}`
    });
  }

  if (expected.pdfSource !== undefined) {
    results.push({
      name: 'capture diagnostics PDF source matches expected source',
      passed: capture?.export?.pdf?.source === expected.pdfSource,
      detail: `${capture?.export?.pdf?.source || 'n/a'}, expected ${expected.pdfSource}`
    });
  }

  if (expected.pdfPageMode !== undefined) {
    results.push({
      name: 'capture diagnostics PDF page mode matches expected mode',
      passed: capture?.export?.pdf?.pageMode === expected.pdfPageMode,
      detail: `${capture?.export?.pdf?.pageMode || 'n/a'}, expected ${expected.pdfPageMode}`
    });
  }

  results.push(
    {
      name: 'capture diagnostics export status matches expected status',
      passed: capture?.export?.status === expected.exportStatus,
      detail: `${capture?.export?.status || 'n/a'}, expected ${expected.exportStatus}`
    },
    {
      name: 'capture diagnostics scroll target matches expected target',
      passed: expected.scrollTargetType === undefined || capture?.scrollTarget?.type === expected.scrollTargetType,
      detail: `${capture?.scrollTarget?.type || 'n/a'}, expected ${expected.scrollTargetType}`
    },
    {
      name: 'capture diagnostics scroll target compose mode matches expected mode',
      passed: expected.scrollTargetComposeMode === undefined ||
        capture?.scrollTarget?.composeMode === expected.scrollTargetComposeMode,
      detail: `${capture?.scrollTarget?.composeMode || 'n/a'}, expected ${expected.scrollTargetComposeMode}`
    },
    {
      name: 'capture diagnostics failure reason matches expected reason',
      passed: expected.failureReason === undefined || capture?.failureReason === expected.failureReason,
      detail: `${capture?.failureReason || 'n/a'}, expected ${expected.failureReason}`
    },
    {
      name: 'capture diagnostics bitmap size is recorded',
      passed: (capture?.output?.bitmapWidth || capture?.page?.bitmapWidth || 0) > 0 &&
        (capture?.output?.bitmapHeight || capture?.page?.bitmapHeight || 0) > 0,
      detail: capture?.output ?
        `${capture.output.bitmapWidth}x${capture.output.bitmapHeight}` :
        (capture?.page ? `${capture.page.bitmapWidth}x${capture.page.bitmapHeight}` : 'n/a')
    }
  );

  if (expected.exportFilesComplete) {
    const files = Array.isArray(capture?.export?.files) ? capture.export.files : [];
    const incomplete = files.filter(file =>
      !file.downloadId ||
      file.lifecycle?.waitStatus !== 'complete' ||
      !file.lifecycle?.completedAt
    );

    results.push({
      name: 'capture diagnostics export files reached download complete',
      passed: files.length > 0 && incomplete.length === 0,
      detail: incomplete.length ?
        `${incomplete.length} incomplete of ${files.length}` :
        `${files.length} complete file(s)`
    });
  }

  const pageDiagnostics = capture?.scrollTarget?.diagnostics || {};
  if (Array.isArray(expected.riskFlagsInclude)) {
    const actualFlags = Array.isArray(pageDiagnostics.riskFlags) ? pageDiagnostics.riskFlags : [];
    for (const flag of expected.riskFlagsInclude) {
      results.push({
        name: `capture diagnostics includes ${flag} risk flag`,
        passed: actualFlags.includes(flag),
        detail: `${actualFlags.join(', ') || 'none'}, expected ${flag}`
      });
    }
  }

  if (expected.fixedStickyCandidateCountAtLeast !== undefined) {
    const count = pageDiagnostics.fixedStickyCandidateCount || 0;
    results.push({
      name: 'capture diagnostics fixed/sticky candidate count meets expected minimum',
      passed: count >= expected.fixedStickyCandidateCountAtLeast,
      detail: `${count}, expected >= ${expected.fixedStickyCandidateCountAtLeast}`
    });
  }

  if (expected.fixedStickyCandidateCountAtMost !== undefined) {
    const count = pageDiagnostics.fixedStickyCandidateCount || 0;
    results.push({
      name: 'capture diagnostics fixed/sticky candidate count stays below maximum',
      passed: count <= expected.fixedStickyCandidateCountAtMost,
      detail: `${count}, expected <= ${expected.fixedStickyCandidateCountAtMost}`
    });
  }

  if (expected.visibleOverlayCandidateCountAtLeast !== undefined) {
    const count = pageDiagnostics.visibleOverlayCandidateCount || 0;
    results.push({
      name: 'capture diagnostics visible overlay candidate count meets expected minimum',
      passed: count >= expected.visibleOverlayCandidateCountAtLeast,
      detail: `${count}, expected >= ${expected.visibleOverlayCandidateCountAtLeast}`
    });
  }

  if (Array.isArray(expected.quirksAppliedInclude)) {
    const appliedQuirks = Array.isArray(pageDiagnostics.quirks?.applied) ? pageDiagnostics.quirks.applied : [];
    for (const quirk of expected.quirksAppliedInclude) {
      results.push({
        name: `capture diagnostics includes ${quirk} applied quirk`,
        passed: appliedQuirks.includes(quirk),
        detail: `${appliedQuirks.join(', ') || 'none'}, expected ${quirk}`
      });
    }
  }

  if (Array.isArray(expected.quirksAppliedExclude)) {
    const appliedQuirks = Array.isArray(pageDiagnostics.quirks?.applied) ? pageDiagnostics.quirks.applied : [];
    for (const quirk of expected.quirksAppliedExclude) {
      results.push({
        name: `capture diagnostics excludes ${quirk} applied quirk`,
        passed: !appliedQuirks.includes(quirk),
        detail: `${appliedQuirks.join(', ') || 'none'}, expected no ${quirk}`
      });
    }
  }

  if (expected.splitExclusionRangeCountAtLeast !== undefined) {
    const count = pageDiagnostics.splitExclusionRangeCount || 0;
    results.push({
      name: 'capture diagnostics split-exclusion range count meets expected minimum',
      passed: count >= expected.splitExclusionRangeCountAtLeast,
      detail: `${count}, expected >= ${expected.splitExclusionRangeCountAtLeast}`
    });
  }

  if (expected.geometryGridRowAddedAtLeast !== undefined) {
    const count = pageDiagnostics.geometryAvoidRangeDiagnostics?.gridRowAdded || 0;
    results.push({
      name: 'capture diagnostics grid-row geometry count meets expected minimum',
      passed: count >= expected.geometryGridRowAddedAtLeast,
      detail: `${count}, expected >= ${expected.geometryGridRowAddedAtLeast}`
    });
  }

  if (expected.capturePlanAvoidRangeReasonAtLeast) {
    const reasonExpectation = expected.capturePlanAvoidRangeReasonAtLeast;
    const reason = reasonExpectation.reason;
    const expectedCount = Number(reasonExpectation.count) || 1;
    const count = pageDiagnostics.capturePlanSummary?.avoidRangeReasons?.[reason] || 0;
    results.push({
      name: `capture plan includes ${reason} avoid ranges`,
      passed: count >= expectedCount,
      detail: `${count}, expected >= ${expectedCount}`
    });
  }

  if (Array.isArray(expected.frameDiagnostics)) {
    const frames = captureDiagnostics?.diagnostics?.stepper?.frames || [];
    for (const frameExpectation of expected.frameDiagnostics) {
      const frame = frames.find(candidate => Number(candidate.frameIndex) === Number(frameExpectation.frameIndex));
      const beforeFrame = frame?.beforeFrame || {};
      const prefix = `frame ${frameExpectation.frameIndex}`;

      results.push({
        name: `${prefix} diagnostics are stored`,
        passed: Boolean(frame),
        detail: frame ? 'frame diagnostics present' : 'frame diagnostics missing'
      });

      if (frameExpectation.hiddenAtLeast !== undefined) {
        const hidden = Number(beforeFrame.hidden) || 0;
        results.push({
          name: `${prefix} hidden count meets expected minimum`,
          passed: hidden >= frameExpectation.hiddenAtLeast,
          detail: `${hidden}, expected >= ${frameExpectation.hiddenAtLeast}`
        });
      }

      if (frameExpectation.hiddenAtMost !== undefined) {
        const hidden = Number(beforeFrame.hidden) || 0;
        results.push({
          name: `${prefix} hidden count stays below maximum`,
          passed: hidden <= frameExpectation.hiddenAtMost,
          detail: `${hidden}, expected <= ${frameExpectation.hiddenAtMost}`
        });
      }

      if (frameExpectation.transformedAtLeast !== undefined) {
        const transformed = Number(beforeFrame.transformed) || 0;
        results.push({
          name: `${prefix} transformed count meets expected minimum`,
          passed: transformed >= frameExpectation.transformedAtLeast,
          detail: `${transformed}, expected >= ${frameExpectation.transformedAtLeast}`
        });
      }

      if (frameExpectation.transformedAtMost !== undefined) {
        const transformed = Number(beforeFrame.transformed) || 0;
        results.push({
          name: `${prefix} transformed count stays below maximum`,
          passed: transformed <= frameExpectation.transformedAtMost,
          detail: `${transformed}, expected <= ${frameExpectation.transformedAtMost}`
        });
      }

      if (frameExpectation.scrollYAtMost !== undefined) {
        const scrollY = Number(frame?.scroll?.y);
        results.push({
          name: `${prefix} scrollY stays below maximum`,
          passed: Number.isFinite(scrollY) && scrollY <= frameExpectation.scrollYAtMost,
          detail: `${Number.isFinite(scrollY) ? scrollY : 'n/a'}, expected <= ${frameExpectation.scrollYAtMost}`
        });
      }

      if (Array.isArray(frameExpectation.chromeCandidateKindsInclude)) {
        const kinds = Array.isArray(beforeFrame.chromeCandidateKinds) ? beforeFrame.chromeCandidateKinds : [];
        for (const kind of frameExpectation.chromeCandidateKindsInclude) {
          results.push({
            name: `${prefix} includes ${kind} chrome diagnostic kind`,
            passed: kinds.includes(kind),
            detail: `${kinds.join(', ') || 'none'}, expected ${kind}`
          });
        }
      }
    }
  }

  return results;
};

const readCaptureDiagnostics = async extensionPage => {
  const result = await extensionPage.evaluate(() => chrome.storage.local.get('lastCaptureDiagnostics'));
  return result.lastCaptureDiagnostics || null;
};

const readNotificationEvent = async extensionPage => {
  const result = await extensionPage.evaluate(() => chrome.storage.local.get('lastNotificationEvent'));
  return result.lastNotificationEvent || null;
};

const prepareChromePrefs = async ({userDataDir, downloadsDir}) => {
  const defaultDir = path.join(userDataDir, 'Default');
  await fs.mkdir(defaultDir, {recursive: true});
  await fs.writeFile(path.join(defaultDir, 'Preferences'), JSON.stringify({
    download: {
      default_directory: downloadsDir,
      directory_upgrade: true,
      prompt_for_download: false
    },
    safebrowsing: {
      enabled: false
    }
  }), 'utf8');
};

const readExtensionId = async ({userDataDir, extensionRoot, context}) => {
  const securePreferencesPath = path.join(userDataDir, 'Default', 'Secure Preferences');
  const realExtensionRoot = await fs.realpath(extensionRoot);
  const deadline = Date.now() + 20000;

  while (Date.now() < deadline) {
    for (const worker of context?.serviceWorkers?.() || []) {
      const match = worker.url().match(/^chrome-extension:\/\/([^/]+)\//);
      if (match) {
        return match[1];
      }
    }

    try {
      const preferences = JSON.parse(await fs.readFile(securePreferencesPath, 'utf8'));
      const settings = preferences.extensions?.settings || {};

      for (const [extensionId, value] of Object.entries(settings)) {
        if (
          value.path === extensionRoot ||
          value.path === realExtensionRoot ||
          value.manifest?.name === 'Screenshot Extension'
        ) {
          return extensionId;
        }
      }
    }
    catch {}

    await Promise.race([
      context?.waitForEvent?.('serviceworker', {timeout: 250}).catch(() => null) || Promise.resolve(null),
      new Promise(resolve => setTimeout(resolve, 250))
    ]);
    await new Promise(resolve => setTimeout(resolve, 250));
  }

  throw new Error('Could not resolve loaded extension id.');
};

const launchBrowser = async ({extensionRoot, userDataDir, downloadsDir}) => {
  const options = {
    headless: false,
    viewport,
    acceptDownloads: true,
    downloadsPath: downloadsDir,
    ignoreDefaultArgs: ['--disable-extensions'],
    args: [
      '--no-first-run',
      '--no-default-browser-check',
      '--enable-extensions',
      '--disable-features=DisableLoadExtensionCommandLineSwitch',
      `--disable-extensions-except=${extensionRoot}`,
      `--load-extension=${extensionRoot}`,
      `--window-size=${viewport.width},${viewport.height}`
    ]
  };

  if (process.env.CAPTURE_BROWSER_CHANNEL) {
    options.channel = process.env.CAPTURE_BROWSER_CHANNEL;
  }

  return chromium.launchPersistentContext(userDataDir, options);
};

const copyExtensionToTempDir = async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'screenshot-extension-'));
  const extensionRoot = path.join(tempRoot, 'code');

  await fs.cp(codeRoot, extensionRoot, {recursive: true});
  const manifestPath = path.join(extensionRoot, 'manifest.json');
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  manifest.host_permissions = [
    '<all_urls>'
  ];
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

  return {
    tempRoot,
    extensionRoot
  };
};

const runCase = async ({testCase, origin}) => {
  const caseDir = path.join(latestDir, 'cases', testCase.name);
  const downloadsDir = path.join(caseDir, 'downloads');
  const userDataDir = path.join(caseDir, 'profile');

  await ensureCleanDir(caseDir);
  await fs.mkdir(downloadsDir, {recursive: true});
  await prepareChromePrefs({userDataDir, downloadsDir});

  const report = {
    caseName: testCase.name,
    expected: testCase.expected,
    reportPath: path.join(caseDir, 'report.md'),
    status: 'failed'
  };
  let context;
  let tempExtension;

  try {
    tempExtension = await copyExtensionToTempDir();
    context = await launchBrowser({
      extensionRoot: tempExtension.extensionRoot,
      userDataDir,
      downloadsDir
    });
    const extensionId = await readExtensionId({
      userDataDir,
      extensionRoot: tempExtension.extensionRoot,
      context
    });
    const page = await context.newPage();
    const url = `${origin}${testCase.path}`;
    report.url = url;

    await page.goto(url, {waitUntil: 'load'});
    testCase.diagnostics = await page.evaluate(() => ({
      iframeCount: document.querySelectorAll('iframe').length,
      inaccessibleIframeCount: Array.from(document.querySelectorAll('iframe')).filter(frame => {
        try {
          return !frame.contentWindow || !frame.contentDocument;
        }
        catch {
          return true;
        }
      }).length
    }));
    report.diagnostics = testCase.diagnostics;
    const extensionPage = await context.newPage();
    await extensionPage.goto(`chrome-extension://${extensionId}/data/options/index.html`);
    await page.bringToFront();
    const downloadMask = `capture-flow-${testCase.name}-${Date.now()}`;

    await extensionPage.evaluate(({mask, storageOverrides}) => chrome.storage.local.set({
      saveAs: false,
      mask,
      ...(storageOverrides || {})
    }), {
      mask: downloadMask,
      storageOverrides: testCase.storageOverrides || {}
    });

    const response = await extensionPage.evaluate(async exportFormat => {
      const [tab] = await chrome.tabs.query({
        active: true,
        lastFocusedWindow: true
      });

      return chrome.runtime.sendMessage({
        method: 'capture-active-tab',
        tabId: tab?.id,
        exportFormat
      });
    }, testCase.exportFormat);
    report.captureDiagnostics = await readCaptureDiagnostics(extensionPage);
    report.notificationEvent = await readNotificationEvent(extensionPage);

    if (testCase.expected === 'error') {
      if (response?.ok) {
        await assertNoDownloadedPng({downloadsDir});
        throw new Error('Capture flow succeeded, but this case expected an error.');
      }

      report.errorMessage = response?.error || 'Capture flow failed without an error message.';
      report.errorMatched = !testCase.errorIncludes || report.errorMessage.includes(testCase.errorIncludes);
      if (!report.errorMatched) {
        throw new Error(`Expected error to include "${testCase.errorIncludes}", got "${report.errorMessage}".`);
      }

      await assertNoDownloadedPng({downloadsDir});
      report.assertions = evaluateCaptureDiagnosticsV2Assertions({
        testCase,
        captureDiagnostics: report.captureDiagnostics
      });
      const failedAssertions = report.assertions.filter(assertion => !assertion.passed);
      if (failedAssertions.length) {
        throw new Error(failedAssertions.map(assertion => `${assertion.name}: ${assertion.detail}`).join('\n'));
      }

      report.status = 'passed';
      return report;
    }

    if (testCase.expected === 'multi-download') {
      if (!response?.ok) {
        throw new Error(response?.error || 'Capture flow trigger failed.');
      }

      const pngs = await waitForDownloadedPngs({
        downloadsDir,
        minCount: testCase.assertions?.minDownloads || 2
      });
      report.pngs = [];
      report.download = [];

      for (const [index, {file, png}] of pngs.entries()) {
        const artifactName = downloadedArtifactName({
          downloadedFile: file,
          captureDiagnostics: report.captureDiagnostics,
          index
        });
        const copiedFile = path.join(caseDir, artifactName);
        await fs.copyFile(file, copiedFile);
        await fs.copyFile(file, path.join(latestDir, path.basename(copiedFile)));

        if (png.width <= 0 || png.height <= 0) {
          throw new Error(`Downloaded PNG has invalid size: ${png.width}x${png.height}`);
        }

        report.download.push(copiedFile);
        report.pngs.push({
          width: png.width,
          height: png.height
        });
      }

      report.download = report.download.join(', ');
      report.assertions = [
        ...evaluateMultiPngAssertions({testCase, pngs}),
        ...evaluateNotificationAssertions({
          testCase,
          notificationEvent: report.notificationEvent
        }),
        ...evaluateSingleFileExportAttemptAssertions({
          testCase,
          captureDiagnostics: report.captureDiagnostics
        }),
        ...evaluateCaptureDiagnosticsV2Assertions({
          testCase,
          captureDiagnostics: report.captureDiagnostics
        })
      ];
      const failedAssertions = report.assertions.filter(assertion => !assertion.passed);
      if (failedAssertions.length) {
        throw new Error(failedAssertions.map(assertion => `${assertion.name}: ${assertion.detail}`).join('\n'));
      }

      report.status = 'passed';
      return report;
    }

    if (testCase.expected !== 'download') {
      if (testCase.expected === 'download-pdf') {
        const {file, bytes} = await waitForDownloadedPdf({downloadsDir});
        const artifactName = downloadedArtifactName({
          downloadedFile: file,
          captureDiagnostics: report.captureDiagnostics,
          index: 0
        });
        const copiedFile = path.join(caseDir, artifactName);
        const latestCopy = path.join(latestDir, artifactName);
        await fs.copyFile(file, copiedFile);
        await fs.copyFile(file, latestCopy);

        report.assertions = evaluatePdfAssertions({
          testCase,
          bytes,
          captureDiagnostics: report.captureDiagnostics
        });
        const failedAssertions = report.assertions.filter(assertion => !assertion.passed);
        report.download = copiedFile;
        report.pdf = {bytes: bytes.length};

        if (failedAssertions.length) {
          throw new Error(failedAssertions.map(assertion => `${assertion.name}: ${assertion.detail}`).join('\n'));
        }

        report.status = 'passed';
        return report;
      }

      throw new Error(`Unsupported case expectation: ${testCase.expected}`);
    }

    if (!response?.ok) {
      throw new Error(response?.error || 'Capture flow trigger failed.');
    }

    const {file, png} = await waitForDownloadedPng({downloadsDir});
    const artifactName = downloadedArtifactName({
      downloadedFile: file,
      captureDiagnostics: report.captureDiagnostics,
      index: 0
    });
    const copiedFile = path.join(caseDir, artifactName);
    const latestCopy = path.join(latestDir, artifactName);
    await fs.copyFile(file, copiedFile);
    await fs.copyFile(file, latestCopy);

    if (png.width <= 0 || png.height <= 0) {
      throw new Error(`Downloaded PNG has invalid size: ${png.width}x${png.height}`);
    }

      report.assertions = evaluatePngAssertions({
        testCase,
        png,
        captureDiagnostics: report.captureDiagnostics
      });
    const failedAssertions = report.assertions.filter(assertion => !assertion.passed);
    report.download = copiedFile;
    report.png = {
      width: png.width,
      height: png.height
    };

    if (failedAssertions.length) {
      throw new Error(failedAssertions.map(assertion => `${assertion.name}: ${assertion.detail}`).join('\n'));
    }

    report.status = 'passed';
  }
  catch (error) {
    report.error = error.stack || error.message;
  }
  finally {
    if (context) {
      await context.close().catch(() => {});
    }
    if (tempExtension) {
      await fs.rm(tempExtension.tempRoot, {recursive: true, force: true}).catch(() => {});
    }
    await writeCaseReport(caseDir, report);
  }

  return report;
};

const run = async () => {
  await ensureCleanDir(latestDir);

  const {server, origin} = await startFixtureServer();
  const results = [];

  try {
    for (const testCase of activeCases) {
      const result = await runCase({testCase, origin});
      results.push(result);

      console.log(`${result.status.toUpperCase()} ${result.caseName}`);
      if (result.png) {
        console.log(`PNG ${result.png.width}x${result.png.height}`);
      }
      if (result.error) {
        console.error(result.error);
      }
    }
  }
  finally {
    await new Promise(resolve => server.close(resolve));
  }

  const failed = results.some(result => result.status !== 'passed');
  await writeSummaryReport({
    status: failed ? 'failed' : 'passed',
    cases: results
  });

  if (failed) {
    process.exitCode = 1;
  }
  console.log(`Report: ${path.join(latestDir, 'report.md')}`);
};

run();
