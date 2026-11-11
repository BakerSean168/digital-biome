import type { MermaidConfig } from 'mermaid';

/**
 * Browser renderer for Mermaid diagrams.
 *
 * Note bodies ship diagram containers (see src/utils/rehype-mermaid-diagrams.ts)
 * whose <pre class="mermaid-source"> holds the diagram source, presented like a
 * normal code block. When a page contains any, the mermaid library is loaded on
 * demand — it never ships to pages without diagrams — and each source block is
 * replaced by its rendered SVG. A diagram that fails to load or render keeps
 * its source block, so the page never loses the information.
 */
export function createMermaidConfig(): MermaidConfig {
  return {
    startOnLoad: false,
    securityLevel: 'strict',
    suppressErrorRendering: true,
    theme: 'base',
    themeVariables: {
      background: 'transparent',
      fontFamily: "'Space Grotesk', 'Noto Sans SC', sans-serif",
      primaryColor: '#26271F',
      primaryBorderColor: '#5A5C4E',
      primaryTextColor: '#E8E6DF',
      secondaryColor: '#1E1F1C',
      tertiaryColor: '#1E1F1C',
      mainBkg: '#26271F',
      nodeBorder: '#5A5C4E',
      textColor: '#E8E6DF',
      lineColor: '#8F9779',
      edgeLabelBackground: '#1E1F1C',
      clusterBkg: '#1A1B19',
      clusterBorder: '#3A3B36',
      actorBkg: '#26271F',
      actorBorder: '#5A5C4E',
      actorTextColor: '#E8E6DF',
      actorLineColor: '#8F9779',
      signalColor: '#C9CBC0',
      signalTextColor: '#E8E6DF',
      noteBkgColor: '#2E2A1E',
      noteTextColor: '#E8E6DF',
      noteBorderColor: '#5A5C4E',
    },
    flowchart: { htmlLabels: true },
  };
}

const DIAGRAM_SELECTOR = '[data-mermaid-diagram]';
const SOURCE_SELECTOR = '.mermaid-source';

type MermaidModule = typeof import('mermaid');

let mermaidModulePromise: Promise<MermaidModule> | null = null;

function loadMermaid(): Promise<MermaidModule> {
  mermaidModulePromise ??= import('mermaid').then((module) => {
    module.default.initialize(createMermaidConfig());
    return module;
  });
  return mermaidModulePromise;
}

export async function initMermaidDiagrams(root: ParentNode = document): Promise<void> {
  const containers = Array.from(root.querySelectorAll<HTMLElement>(DIAGRAM_SELECTOR)).filter(
    (container) => container.dataset.mermaidRendered !== 'true',
  );
  if (containers.length === 0) return;

  let mermaid: MermaidModule['default'];
  try {
    mermaid = (await loadMermaid()).default;
  } catch (error) {
    console.warn('Mermaid failed to load; diagram sources remain visible.', error);
    return;
  }

  for (const [index, container] of containers.entries()) {
    const source = container.querySelector(SOURCE_SELECTOR)?.textContent ?? '';
    if (!source.trim()) continue;
    try {
      const { svg } = await mermaid.render(`mermaid-diagram-${index}`, source);
      container.innerHTML = svg;
      container.dataset.mermaidRendered = 'true';
      container.classList.add('mermaid-rendered');
    } catch (error) {
      container.classList.add('mermaid-failed');
      console.warn('Mermaid diagram failed to render; its source remains visible.', error);
    }
  }
}
