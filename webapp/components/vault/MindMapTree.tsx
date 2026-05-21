'use client';

interface Node {
  concept: string;
  children?: Node[];
}

function TreeNode({ node, depth = 0 }: { node: Node; depth?: number }) {
  const palette = ['bg-primary text-primary-foreground', 'bg-accent text-accent-foreground', 'bg-[color:var(--gold)] text-foreground', 'bg-card'];
  const bg = palette[Math.min(depth, palette.length - 1)];
  return (
    <div className="relative">
      <div
        className={`inline-block rounded-md brutal-border px-3 py-2 text-sm font-semibold ${bg}`}
      >
        {node.concept}
      </div>
      {node.children && node.children.length > 0 && (
        <div className="ml-4 mt-2 border-l-2 border-foreground/30 pl-4 space-y-3">
          {node.children.map((child, i) => (
            <TreeNode key={i} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export function MindMapTree({ output }: { output: Record<string, unknown> }) {
  const root = output.root as Node | undefined;
  if (!root) {
    return <p className="text-sm text-muted-foreground">No mind map data.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-md brutal-border bg-card p-4 scrollbar-brutal">
      <TreeNode node={root} />
    </div>
  );
}
