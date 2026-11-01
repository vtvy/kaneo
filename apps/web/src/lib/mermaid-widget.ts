let renderQueue = Promise.resolve();
let diagramId = 0;

export function createMermaidWidget(code: string) {
  return () => {
    const host = document.createElement("div");
    host.className = "kaneo-mermaid";
    diagramId += 1;
    const id = `kaneo-mermaid-${diagramId}`;

    renderQueue = renderQueue
      .catch(() => undefined)
      .then(async () => {
        const mermaid = (await import("mermaid")).default;
        const dark = document.documentElement.classList.contains("dark");
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: dark ? "dark" : "default",
        });
        const rendered = await mermaid.render(id, code);
        host.innerHTML = rendered.svg;
      })
      .catch((error: unknown) => {
        host.textContent =
          error instanceof Error ? error.message : "Could not render diagram";
      });

    return host;
  };
}
