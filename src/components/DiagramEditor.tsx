import { Circle, Link2, Minus, RectangleHorizontal, Square, Trash2, Type, Workflow, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DIAGRAM_PALETTE,
  computeEdgeGeometry,
  defaultNodeSize,
  emptyDiagram,
  makeDiagramId,
  nodeCenter,
  paletteFor,
} from "@/lib/diagram";
import type { Diagram, DiagramEdge, DiagramLine, DiagramNode, DiagramShape } from "@/lib/publishing";

type Props = {
  open: boolean;
  initialDiagram: Diagram | null;
  onClose: () => void;
  onSave: (diagram: Diagram) => void;
};

const PALETTE_OPTIONS: { value: keyof typeof DIAGRAM_PALETTE; label: string }[] = [
  { value: "default", label: "neutro" },
  { value: "primary", label: "berry" },
  { value: "leaf", label: "folha" },
  { value: "clay", label: "argila" },
  { value: "sand", label: "areia" },
  { value: "muted", label: "suave" },
];

const DECISION_BRANCH_LABELS = ["sim", "nao", "outro"];
const DECISION_CHILD_WIDTH = 150;
const DECISION_CHILD_HEIGHT = 68;
const DECISION_MIN_CHILD_WIDTH = 48;
const DECISION_VERTICAL_GAP = 92;
const TEXT_FONT_OPTIONS = [
  { value: "sans", label: "sem serifa", family: "var(--font-sans, sans-serif)" },
  { value: "serif", label: "serifa", family: "var(--font-display, serif)" },
  { value: "script", label: "estilizada", family: "var(--font-script, cursive)" },
] as const;

type Bounds = { x: number; y: number; width: number; height: number };

function clonable<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function ensureDiagram(diagram: Diagram | null): Diagram {
  if (!diagram || diagram.nodes.length === 0) return emptyDiagram();
  return { ...clonable(diagram), lines: diagram.lines ?? [] };
}

function clampToCanvas(node: DiagramNode, canvasWidth: number, canvasHeight: number) {
  const width = Math.max(node.type === "text" ? 80 : 48, Math.min(canvasWidth - 16, node.width));
  const height = Math.max(node.type === "text" ? 32 : 40, Math.min(canvasHeight - 16, node.height));
  const x = Math.max(8, Math.min(canvasWidth - width - 8, node.x));
  const y = Math.max(8, Math.min(canvasHeight - height - 8, node.y));
  return { ...node, x, y, width, height };
}

function findEmptySlot(
  diagram: Diagram,
  width: number,
  height: number,
  anchor?: DiagramNode,
): { x: number; y: number } {
  const cx = anchor ? anchor.x + anchor.width + 60 : 60;
  const cy = anchor ? anchor.y : 60;
  let candidate = { x: cx, y: cy };

  const overlap = (a: { x: number; y: number }, node: DiagramNode) =>
    a.x < node.x + node.width + 8 &&
    a.x + width + 8 > node.x &&
    a.y < node.y + node.height + 8 &&
    a.y + height + 8 > node.y;

  let attempt = 0;
  while (attempt < 30 && diagram.nodes.some((node) => overlap(candidate, node))) {
    attempt += 1;
    candidate = {
      x: candidate.x + 30,
      y: candidate.y + (attempt % 4 === 0 ? 100 : 0),
    };
    if (candidate.x + width > diagram.width - 8) {
      candidate = { x: 30, y: candidate.y + 110 };
    }
  }

  return candidate;
}

function isDecisionBranchLabel(label: string) {
  const normalized = label.trim().toLowerCase();
  return DECISION_BRANCH_LABELS.includes(normalized) || normalized.startsWith("ramo ");
}

function isDecisionTreeNode(diagram: Diagram, node: DiagramNode) {
  return diagram.edges.some(
    (edge) =>
      (edge.fromId === node.id || edge.toId === node.id) && isDecisionBranchLabel(edge.label),
  );
}

function boundsForNodes(nodes: DiagramNode[]): Bounds | null {
  if (nodes.length === 0) return null;

  const minX = Math.min(...nodes.map((node) => node.x));
  const minY = Math.min(...nodes.map((node) => node.y));
  const maxX = Math.max(...nodes.map((node) => node.x + node.width));
  const maxY = Math.max(...nodes.map((node) => node.y + node.height));

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function boundsForLines(lines: DiagramLine[]): Bounds | null {
  if (lines.length === 0) return null;

  const minX = Math.min(...lines.flatMap((line) => [line.x1, line.x2]));
  const minY = Math.min(...lines.flatMap((line) => [line.y1, line.y2]));
  const maxX = Math.max(...lines.flatMap((line) => [line.x1, line.x2]));
  const maxY = Math.max(...lines.flatMap((line) => [line.y1, line.y2]));

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function mergeBounds(bounds: Array<Bounds | null>) {
  const visibleBounds = bounds.filter((item): item is Bounds => item !== null);
  if (visibleBounds.length === 0) return null;

  const minX = Math.min(...visibleBounds.map((item) => item.x));
  const minY = Math.min(...visibleBounds.map((item) => item.y));
  const maxX = Math.max(...visibleBounds.map((item) => item.x + item.width));
  const maxY = Math.max(...visibleBounds.map((item) => item.y + item.height));

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function nodesInsideBounds(nodes: DiagramNode[], bounds: Bounds) {
  const minX = Math.min(bounds.x, bounds.x + bounds.width);
  const minY = Math.min(bounds.y, bounds.y + bounds.height);
  const maxX = Math.max(bounds.x, bounds.x + bounds.width);
  const maxY = Math.max(bounds.y, bounds.y + bounds.height);

  return nodes.filter((node) => {
    const nodeCenterX = node.x + node.width / 2;
    const nodeCenterY = node.y + node.height / 2;
    return nodeCenterX >= minX && nodeCenterX <= maxX && nodeCenterY >= minY && nodeCenterY <= maxY;
  });
}

function linesInsideBounds(lines: DiagramLine[], bounds: Bounds) {
  const minX = Math.min(bounds.x, bounds.x + bounds.width);
  const minY = Math.min(bounds.y, bounds.y + bounds.height);
  const maxX = Math.max(bounds.x, bounds.x + bounds.width);
  const maxY = Math.max(bounds.y, bounds.y + bounds.height);

  return lines.filter((line) => {
    const midX = (line.x1 + line.x2) / 2;
    const midY = (line.y1 + line.y2) / 2;
    const startInside = line.x1 >= minX && line.x1 <= maxX && line.y1 >= minY && line.y1 <= maxY;
    const endInside = line.x2 >= minX && line.x2 <= maxX && line.y2 >= minY && line.y2 <= maxY;
    const midInside = midX >= minX && midX <= maxX && midY >= minY && midY <= maxY;
    return startInside || endInside || midInside;
  });
}

function decisionEdgesFrom(diagram: Diagram, nodeId: string) {
  return diagram.edges.filter((edge) => edge.fromId === nodeId && isDecisionBranchLabel(edge.label));
}

function decisionParentEdge(diagram: Diagram, nodeId: string) {
  return diagram.edges.find((edge) => edge.toId === nodeId && isDecisionBranchLabel(edge.label));
}

function decisionRootId(diagram: Diagram, nodeId: string) {
  let currentId = nodeId;
  const visited = new Set<string>();

  while (!visited.has(currentId)) {
    visited.add(currentId);
    const parentEdge = decisionParentEdge(diagram, currentId);
    if (!parentEdge) break;
    currentId = parentEdge.fromId;
  }

  return currentId;
}

function layoutDecisionTree(diagram: Diagram, changedNodeId: string): Diagram {
  const rootId = decisionRootId(diagram, changedNodeId);
  const root = diagram.nodes.find((node) => node.id === rootId);
  if (!root) return diagram;

  const nodeExists = new Set(diagram.nodes.map((node) => node.id));
  const childrenFor = (nodeId: string) =>
    decisionEdgesFrom(diagram, nodeId)
      .map((edge) => edge.toId)
      .filter((nodeId) => nodeExists.has(nodeId));
  const leafCountCache = new Map<string, number>();
  const depthCache = new Map<string, number>();
  const treeNodeIds = new Set<string>();

  const countLeaves = (nodeId: string, depth = 0, seen = new Set<string>()): number => {
    if (seen.has(nodeId)) return 1;
    treeNodeIds.add(nodeId);
    depthCache.set(nodeId, Math.max(depthCache.get(nodeId) ?? 0, depth));

    const children = childrenFor(nodeId);
    if (children.length === 0) {
      leafCountCache.set(nodeId, 1);
      return 1;
    }

    const nextSeen = new Set(seen);
    nextSeen.add(nodeId);
    const count = children.reduce((sum, childId) => sum + countLeaves(childId, depth + 1, nextSeen), 0);
    leafCountCache.set(nodeId, Math.max(1, count));
    return Math.max(1, count);
  };

  const leafCount = countLeaves(root.id);
  const maxDepth = Math.max(...Array.from(depthCache.values()), 0);
  const availableWidth = Math.max(DECISION_MIN_CHILD_WIDTH, diagram.width - 48);
  const slotWidth = availableWidth / Math.max(1, leafCount);
  const nodeWidth = Math.max(
    DECISION_MIN_CHILD_WIDTH,
    Math.min(DECISION_CHILD_WIDTH, slotWidth * 0.82),
  );
  const verticalGap = Math.max(54, Math.min(DECISION_VERTICAL_GAP, nodeWidth * 0.8));
  const nextHeight = Math.max(
    diagram.height,
    root.y + (maxDepth + 1) * DECISION_CHILD_HEIGHT + maxDepth * verticalGap + 96,
  );
  const positions = new Map<string, { x: number; y: number }>();

  const place = (nodeId: string, depth: number, startLeaf: number): number => {
    const children = childrenFor(nodeId);
    const span = leafCountCache.get(nodeId) ?? 1;
    let cursor = startLeaf;

    for (const childId of children) {
      cursor = place(childId, depth + 1, cursor);
    }

    const centerLeaf =
      children.length === 0
        ? startLeaf + 0.5
        : startLeaf + span / 2;
    const x = 24 + centerLeaf * slotWidth - nodeWidth / 2;
    const y = root.y + depth * (DECISION_CHILD_HEIGHT + verticalGap);
    positions.set(nodeId, { x, y });
    return startLeaf + span;
  };

  place(root.id, 0, 0);

  return {
    ...diagram,
    height: nextHeight,
    nodes: diagram.nodes.map((node) => {
      const position = positions.get(node.id);
      if (!position) return node;

      return clampToCanvas(
        {
          ...node,
          type: node.type === "text" ? "pill" : node.type,
          x: position.x,
          y: position.y,
          width: nodeWidth,
          height: DECISION_CHILD_HEIGHT,
        },
        diagram.width,
        nextHeight,
      );
    }),
    edges: diagram.edges.map((edge) => {
      if (!treeNodeIds.has(edge.fromId)) return edge;
      const siblings = decisionEdgesFrom(diagram, edge.fromId);
      const index = siblings.findIndex((item) => item.id === edge.id);
      if (index < 0) return edge;
      return {
        ...edge,
        label: DECISION_BRANCH_LABELS[index] ?? `ramo ${index + 1}`,
      };
    }),
  };
}

export function DiagramEditor({ open, initialDiagram, onClose, onSave }: Props) {
  const [diagram, setDiagram] = useState<Diagram>(() => ensureDiagram(initialDiagram));
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [selectedLineIds, setSelectedLineIds] = useState<string[]>([]);
  const [isCanvasSelected, setIsCanvasSelected] = useState(false);
  const [selectionBox, setSelectionBox] = useState<Bounds | null>(null);
  const [isTextBoxToolActive, setIsTextBoxToolActive] = useState(false);
  const [textBoxDraft, setTextBoxDraft] = useState<Bounds | null>(null);
  const [connectingFromId, setConnectingFromId] = useState<string | null>(null);
  const dragStateRef = useRef<{ nodeId: string; offsetX: number; offsetY: number } | null>(null);
  const multiDragStateRef = useRef<{ startX: number; startY: number; nodes: DiagramNode[]; lines: DiagramLine[] } | null>(null);
  const resizeStateRef = useRef<{ nodeId: string; startX: number; startY: number; width: number; height: number } | null>(null);
  const groupResizeStateRef = useRef<{ startX: number; startY: number; bounds: Bounds; nodes: DiagramNode[]; lines: DiagramLine[] } | null>(null);
  const lineDragStateRef = useRef<{ lineId: string; point: "start" | "end"; offsetX: number; offsetY: number } | null>(null);
  const canvasResizeStateRef = useRef<{ startX: number; startY: number; width: number; height: number } | null>(null);
  const selectionDragStateRef = useRef<{ startX: number; startY: number } | null>(null);
  const textBoxDragStateRef = useRef<{ startX: number; startY: number } | null>(null);
  const ignoreNextCanvasClickRef = useRef(false);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const canvasScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setDiagram(ensureDiagram(initialDiagram));
    setSelectedNodeId(initialDiagram?.nodes[0]?.id ?? null);
    setSelectedNodeIds([]);
    setSelectedEdgeId(null);
    setSelectedLineId(null);
    setSelectedLineIds([]);
    setIsCanvasSelected(false);
    setSelectionBox(null);
    setTextBoxDraft(null);
    setIsTextBoxToolActive(false);
    setConnectingFromId(null);
  }, [initialDiagram, open]);

  useEffect(() => {
    if (!open || typeof document === "undefined") return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (connectingFromId) {
          setConnectingFromId(null);
          return;
        }
        onClose();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [connectingFromId, onClose, open]);

  const selectedNode = useMemo(
    () => diagram.nodes.find((node) => node.id === selectedNodeId) ?? null,
    [diagram.nodes, selectedNodeId],
  );
  const selectedNodes = useMemo(
    () => selectedNodeIds.map((id) => diagram.nodes.find((node) => node.id === id)).filter((node): node is DiagramNode => Boolean(node)),
    [diagram.nodes, selectedNodeIds],
  );
  const selectedLines = useMemo(
    () => selectedLineIds.map((id) => (diagram.lines ?? []).find((line) => line.id === id)).filter((line): line is DiagramLine => Boolean(line)),
    [diagram.lines, selectedLineIds],
  );
  const selectedGroupBounds = useMemo(
    () => mergeBounds([boundsForNodes(selectedNodes), boundsForLines(selectedLines)]),
    [selectedLines, selectedNodes],
  );
  const selectedEdge = useMemo(
    () => diagram.edges.find((edge) => edge.id === selectedEdgeId) ?? null,
    [diagram.edges, selectedEdgeId],
  );
  const selectedLine = useMemo(
    () => (diagram.lines ?? []).find((line) => line.id === selectedLineId) ?? null,
    [diagram.lines, selectedLineId],
  );

  const updateNode = useCallback((nodeId: string, patch: Partial<DiagramNode>) => {
    setDiagram((current) => ({
      ...current,
      nodes: current.nodes.map((node) =>
        node.id === nodeId
          ? clampToCanvas({ ...node, ...patch }, current.width, current.height)
          : node,
      ),
    }));
  }, []);

  const updateDiagramSize = useCallback((patch: { width?: number; height?: number }) => {
    setDiagram((current) => ({
      ...current,
      width: Math.max(320, Math.min(2400, Math.round(patch.width ?? current.width))),
      height: Math.max(200, Math.min(2000, Math.round(patch.height ?? current.height))),
    }));
  }, []);

  const updateEdge = useCallback((edgeId: string, patch: Partial<DiagramEdge>) => {
    setDiagram((current) => ({
      ...current,
      edges: current.edges.map((edge) => (edge.id === edgeId ? { ...edge, ...patch } : edge)),
    }));
  }, []);

  const updateLine = useCallback((lineId: string, patch: Partial<DiagramLine>) => {
    setDiagram((current) => ({
      ...current,
      lines: (current.lines ?? []).map((line) => (line.id === lineId ? { ...line, ...patch } : line)),
    }));
  }, []);

  const addNode = useCallback((type: DiagramShape, anchor?: DiagramNode | null) => {
    const size = defaultNodeSize(type);
    setDiagram((current) => {
      const slot = findEmptySlot(current, size.width, size.height, anchor ?? undefined);
      const node: DiagramNode = {
        id: makeDiagramId("node"),
        type,
        text: "",
        x: slot.x,
        y: slot.y,
        width: size.width,
        height: size.height,
        color: anchor?.color ?? "default",
      };
      const nextDiagram: Diagram = {
        ...current,
        nodes: [...current.nodes, node],
      };
      if (anchor) {
        nextDiagram.edges = [
          ...current.edges,
          { id: makeDiagramId("edge"), fromId: anchor.id, toId: node.id, label: "", arrow: true },
        ];
      }
      setSelectedNodeId(node.id);
      setSelectedNodeIds([]);
      setSelectedEdgeId(null);
      setSelectedLineId(null);
      setSelectedLineIds([]);
      setIsCanvasSelected(false);
      return nextDiagram;
    });
  }, []);

  const addFreeLine = useCallback(() => {
    const line: DiagramLine = {
      id: makeDiagramId("line"),
      x1: 180,
      y1: 160,
      x2: 380,
      y2: 160,
      color: "sand",
      arrow: false,
    };
    setDiagram((current) => ({
      ...current,
      lines: [...(current.lines ?? []), line],
      width: Math.max(current.width, line.x2 + 64),
      height: Math.max(current.height, line.y2 + 64),
    }));
    setSelectedLineId(line.id);
    setSelectedLineIds([]);
    setSelectedNodeId(null);
    setSelectedNodeIds([]);
    setSelectedEdgeId(null);
    setIsCanvasSelected(false);
  }, []);

  const addDecisionChild = useCallback((anchor: DiagramNode) => {
    setDiagram((current) => {
      const outgoingEdges = current.edges.filter((edge) => edge.fromId === anchor.id);
      const childIndex = outgoingEdges.length;
      const label = DECISION_BRANCH_LABELS[childIndex] ?? `ramo ${childIndex + 1}`;
      const node: DiagramNode = {
        id: makeDiagramId("node"),
        type: "pill",
        text: `Folha ${childIndex + 1}`,
        x: anchor.x,
        y: anchor.y + anchor.height + DECISION_VERTICAL_GAP,
        width: DECISION_CHILD_WIDTH,
        height: DECISION_CHILD_HEIGHT,
        color: anchor.color === "default" ? "leaf" : anchor.color,
      };

      setSelectedNodeId(node.id);
      setSelectedNodeIds([]);
      setSelectedEdgeId(null);
      setSelectedLineId(null);
      setSelectedLineIds([]);
      setIsCanvasSelected(false);

      return layoutDecisionTree({
        ...current,
        width: Math.max(current.width, node.x + node.width + 64),
        height: Math.max(current.height, node.y + node.height + 64),
        nodes: [...current.nodes, node],
        edges: [
          ...current.edges,
          { id: makeDiagramId("edge"), fromId: anchor.id, toId: node.id, label, arrow: true },
        ],
      }, anchor.id);
    });
  }, []);

  const branchFromSelected = useCallback(
    (type: DiagramShape) => {
      const anchor = selectedNode;
      if (!anchor) {
        addNode(type);
        return;
      }
      if (isDecisionTreeNode(diagram, anchor)) {
        addDecisionChild(anchor);
        return;
      }
      addNode(type, anchor);
    },
    [addDecisionChild, addNode, diagram, selectedNode],
  );

  const addDecisionTree = useCallback(() => {
    setDiagram((current) => {
      const rootSize = defaultNodeSize("rectangle");
      const anchor =
        selectedNode ??
        ({
          id: makeDiagramId("node"),
          type: "rectangle",
          text: "Decisao",
          x: 260,
          y: 60,
          width: rootSize.width,
          height: rootSize.height,
          color: "primary",
        } satisfies DiagramNode);

      const branchLabels = ["sim", "nao"];
      const leafNodes: DiagramNode[] = branchLabels.map((label, index) => ({
        id: makeDiagramId("node"),
        type: "pill",
        text: `Folha ${index + 1}`,
        x: anchor.x,
        y: anchor.y + anchor.height + DECISION_VERTICAL_GAP,
        width: DECISION_CHILD_WIDTH,
        height: DECISION_CHILD_HEIGHT,
        color: anchor.color === "default" ? "leaf" : anchor.color,
      }));
      const rootNodeAlreadyExists = current.nodes.some((node) => node.id === anchor.id);
      const lastLeaf = leafNodes[leafNodes.length - 1];

      setSelectedNodeId(anchor.id);
      setSelectedNodeIds([]);
      setSelectedEdgeId(null);
      setSelectedLineId(null);
      setSelectedLineIds([]);
      setIsCanvasSelected(false);

      return layoutDecisionTree({
        ...current,
        width: Math.max(
          current.width,
          ...leafNodes.map((node) => node.x + node.width + 64),
        ),
        height: Math.max(current.height, lastLeaf.y + lastLeaf.height + 64),
        nodes: rootNodeAlreadyExists
          ? [...current.nodes, ...leafNodes]
          : [...current.nodes, anchor, ...leafNodes],
        edges: [
          ...current.edges,
          ...leafNodes.map((node, index) => ({
            id: makeDiagramId("edge"),
            fromId: anchor.id,
            toId: node.id,
            label: branchLabels[index],
            arrow: true,
          })),
        ],
      }, anchor.id);
    });
  }, [selectedNode]);

  const removeSelected = useCallback(() => {
    if (selectedNodeIds.length > 0 || selectedLineIds.length > 0) {
      const selectedIds = new Set(selectedNodeIds);
      const selectedLineIdSet = new Set(selectedLineIds);
      setDiagram((current) => ({
        ...current,
        nodes: current.nodes.filter((node) => !selectedIds.has(node.id)),
        edges: current.edges.filter(
          (edge) => !selectedIds.has(edge.fromId) && !selectedIds.has(edge.toId),
        ),
        lines: (current.lines ?? []).filter((line) => !selectedLineIdSet.has(line.id)),
      }));
      setSelectedNodeIds([]);
      setSelectedLineIds([]);
      setSelectedNodeId(null);
      return;
    }

    if (selectedLineId) {
      setDiagram((current) => ({
        ...current,
        lines: (current.lines ?? []).filter((line) => line.id !== selectedLineId),
      }));
      setSelectedLineId(null);
      return;
    }
    if (selectedEdgeId) {
      setDiagram((current) => ({
        ...current,
        edges: current.edges.filter((edge) => edge.id !== selectedEdgeId),
      }));
      setSelectedEdgeId(null);
      return;
    }
    if (!selectedNodeId) return;
    setDiagram((current) => ({
      ...current,
      nodes: current.nodes.filter((node) => node.id !== selectedNodeId),
      edges: current.edges.filter(
        (edge) => edge.fromId !== selectedNodeId && edge.toId !== selectedNodeId,
      ),
    }));
    setSelectedNodeId(null);
  }, [selectedEdgeId, selectedLineId, selectedLineIds, selectedNodeId, selectedNodeIds]);

  useEffect(() => {
    if (!open) return;

    const handleDeleteSelected = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTypingField =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable;

      if (isTypingField || (event.key !== "Delete" && event.key !== "Backspace")) return;
      if (!selectedNodeId && !selectedEdgeId && !selectedLineId && selectedNodeIds.length === 0 && selectedLineIds.length === 0) return;

      event.preventDefault();
      removeSelected();
    };

    window.addEventListener("keydown", handleDeleteSelected);
    return () => window.removeEventListener("keydown", handleDeleteSelected);
  }, [open, removeSelected, selectedEdgeId, selectedLineId, selectedLineIds.length, selectedNodeId, selectedNodeIds.length]);

  const startDrag = (event: React.PointerEvent<SVGGElement>, node: DiagramNode) => {
    if (event.button !== 0) return;
    if (event.shiftKey) {
      event.stopPropagation();
      setSelectedNodeIds((current) =>
        current.includes(node.id) ? current.filter((id) => id !== node.id) : [...current, node.id],
      );
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
      setSelectedLineId(null);
      setIsCanvasSelected(false);
      return;
    }

    if (connectingFromId) {
      // In connect mode, clicking a node finalizes the edge instead of dragging.
      if (connectingFromId !== node.id) {
        const edgeExists = diagram.edges.some(
          (edge) => edge.fromId === connectingFromId && edge.toId === node.id,
        );
        if (!edgeExists) {
          setDiagram((current) => ({
            ...current,
            edges: [
              ...current.edges,
              {
                id: makeDiagramId("edge"),
                fromId: connectingFromId,
                toId: node.id,
                label: "",
                arrow: true,
              },
            ],
          }));
        }
      }
      setConnectingFromId(null);
      setSelectedNodeId(node.id);
      setSelectedNodeIds([]);
      setSelectedEdgeId(null);
      setSelectedLineId(null);
      setSelectedLineIds([]);
      setIsCanvasSelected(false);
      return;
    }

    const point = svgPointFromEvent(event);
    if (node.type === "text" && selectedNodeId !== node.id) {
      setSelectedNodeId(node.id);
      setSelectedNodeIds([]);
      setSelectedEdgeId(null);
      setSelectedLineId(null);
      setIsCanvasSelected(false);
      return;
    }

    if (selectedNodeIds.length + selectedLineIds.length > 1 && selectedNodeIds.includes(node.id)) {
      multiDragStateRef.current = {
        startX: point.x,
        startY: point.y,
        nodes: diagram.nodes.filter((item) => selectedNodeIds.includes(item.id)),
        lines: (diagram.lines ?? []).filter((item) => selectedLineIds.includes(item.id)),
      };
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
      setSelectedLineId(null);
      setIsCanvasSelected(false);
      (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
      return;
    }

    dragStateRef.current = {
      nodeId: node.id,
      offsetX: point.x - node.x,
      offsetY: point.y - node.y,
    };
    setSelectedNodeId(node.id);
    setSelectedNodeIds([]);
    setSelectedEdgeId(null);
    setSelectedLineId(null);
    setSelectedLineIds([]);
    setIsCanvasSelected(false);
    (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
  };

  const svgPointFromEvent = (
    event: React.PointerEvent | React.MouseEvent,
  ): { x: number; y: number } => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const viewBox = svg.viewBox.baseVal;
    const scaleX = viewBox.width / rect.width;
    const scaleY = viewBox.height / rect.height;
    return {
      x: viewBox.x + (event.clientX - rect.left) * scaleX,
      y: viewBox.y + (event.clientY - rect.top) * scaleY,
    };
  };

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const textBoxDrag = textBoxDragStateRef.current;
    if (textBoxDrag) {
      const point = svgPointFromEvent(event);
      setTextBoxDraft({
        x: textBoxDrag.startX,
        y: textBoxDrag.startY,
        width: point.x - textBoxDrag.startX,
        height: point.y - textBoxDrag.startY,
      });
      return;
    }

    const selectionDrag = selectionDragStateRef.current;
    if (selectionDrag) {
      const point = svgPointFromEvent(event);
      setSelectionBox({
        x: selectionDrag.startX,
        y: selectionDrag.startY,
        width: point.x - selectionDrag.startX,
        height: point.y - selectionDrag.startY,
      });
      return;
    }

    const canvasResize = canvasResizeStateRef.current;
    if (canvasResize) {
      const point = svgPointFromEvent(event);
      updateDiagramSize({
        width: canvasResize.width + point.x - canvasResize.startX,
        height: canvasResize.height + point.y - canvasResize.startY,
      });
      return;
    }

    const groupResize = groupResizeStateRef.current;
    if (groupResize) {
      const point = svgPointFromEvent(event);
      const scaleX = Math.max(0.25, (groupResize.bounds.width + point.x - groupResize.startX) / Math.max(1, groupResize.bounds.width));
      const scaleY = Math.max(0.25, (groupResize.bounds.height + point.y - groupResize.startY) / Math.max(1, groupResize.bounds.height));
      const fontScale = Math.max(0.25, (scaleX + scaleY) / 2);
      setDiagram((current) => ({
        ...current,
        nodes: current.nodes.map((node) => {
          const original = groupResize.nodes.find((item) => item.id === node.id);
          if (!original) return node;
          return clampToCanvas(
            {
              ...node,
              x: groupResize.bounds.x + (original.x - groupResize.bounds.x) * scaleX,
              y: groupResize.bounds.y + (original.y - groupResize.bounds.y) * scaleY,
              width: Math.max(48, original.width * scaleX),
              height: Math.max(40, original.height * scaleY),
              ...(original.text.trim()
                ? { fontSize: Math.max(8, Math.min(120, (original.fontSize ?? 13) * fontScale)) }
                : {}),
            },
            current.width,
            current.height,
          );
        }),
        lines: (current.lines ?? []).map((line) => {
          const original = groupResize.lines.find((item) => item.id === line.id);
          if (!original) return line;
          return {
            ...line,
            x1: groupResize.bounds.x + (original.x1 - groupResize.bounds.x) * scaleX,
            y1: groupResize.bounds.y + (original.y1 - groupResize.bounds.y) * scaleY,
            x2: groupResize.bounds.x + (original.x2 - groupResize.bounds.x) * scaleX,
            y2: groupResize.bounds.y + (original.y2 - groupResize.bounds.y) * scaleY,
          };
        }),
      }));
      return;
    }

    const resize = resizeStateRef.current;
    if (resize) {
      const point = svgPointFromEvent(event);
      updateNode(resize.nodeId, {
        width: Math.max(48, resize.width + point.x - resize.startX),
        height: Math.max(40, resize.height + point.y - resize.startY),
      });
      return;
    }

    const lineDrag = lineDragStateRef.current;
    if (lineDrag) {
      const point = svgPointFromEvent(event);
      updateLine(lineDrag.lineId, {
        [lineDrag.point === "start" ? "x1" : "x2"]: point.x - lineDrag.offsetX,
        [lineDrag.point === "start" ? "y1" : "y2"]: point.y - lineDrag.offsetY,
      });
      return;
    }

    const drag = dragStateRef.current;
    const point = svgPointFromEvent(event);
    const multiDrag = multiDragStateRef.current;
    if (multiDrag) {
      const dx = point.x - multiDrag.startX;
      const dy = point.y - multiDrag.startY;
      setDiagram((current) => ({
        ...current,
        nodes: current.nodes.map((node) => {
          const original = multiDrag.nodes.find((item) => item.id === node.id);
          return original
            ? clampToCanvas({ ...node, x: original.x + dx, y: original.y + dy }, current.width, current.height)
            : node;
        }),
        lines: (current.lines ?? []).map((line) => {
          const original = multiDrag.lines.find((item) => item.id === line.id);
          return original
            ? {
                ...line,
                x1: original.x1 + dx,
                y1: original.y1 + dy,
                x2: original.x2 + dx,
                y2: original.y2 + dy,
              }
            : line;
        }),
      }));
      return;
    }

    if (!drag) return;
    updateNode(drag.nodeId, { x: point.x - drag.offsetX, y: point.y - drag.offsetY });
  };

  const handlePointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
    if (dragStateRef.current) {
      (event.currentTarget as Element).releasePointerCapture?.(event.pointerId);
    }
    const selectionDrag = selectionDragStateRef.current;
    if (selectionDrag && selectionBox) {
      const selected = nodesInsideBounds(diagram.nodes, selectionBox).map((node) => node.id);
      const selectedLines = linesInsideBounds(diagram.lines ?? [], selectionBox).map((line) => line.id);
      setSelectedNodeIds(selected);
      setSelectedLineIds(selectedLines);
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
      setSelectedLineId(null);
      setIsCanvasSelected(selected.length + selectedLines.length === 0);
      ignoreNextCanvasClickRef.current = true;
    }
    if (textBoxDragStateRef.current && textBoxDraft) {
      const x = Math.min(textBoxDraft.x, textBoxDraft.x + textBoxDraft.width);
      const y = Math.min(textBoxDraft.y, textBoxDraft.y + textBoxDraft.height);
      const width = Math.max(120, Math.abs(textBoxDraft.width));
      const height = Math.max(70, Math.abs(textBoxDraft.height));
      const node: DiagramNode = {
        id: makeDiagramId("node"),
        type: "text",
        text: "",
        x,
        y,
        width,
        height,
        color: "default",
        fontSize: 24,
        fontFamily: "sans",
        bold: false,
      };
      setDiagram((current) => ({
        ...current,
        nodes: [...current.nodes, clampToCanvas(node, current.width, current.height)],
      }));
      setSelectedNodeId(node.id);
      setSelectedNodeIds([]);
      setSelectedEdgeId(null);
      setSelectedLineId(null);
      setSelectedLineIds([]);
      setIsCanvasSelected(false);
      setIsTextBoxToolActive(false);
      ignoreNextCanvasClickRef.current = true;
    }
    dragStateRef.current = null;
    multiDragStateRef.current = null;
    resizeStateRef.current = null;
    groupResizeStateRef.current = null;
    lineDragStateRef.current = null;
    canvasResizeStateRef.current = null;
    selectionDragStateRef.current = null;
    textBoxDragStateRef.current = null;
    setSelectionBox(null);
    setTextBoxDraft(null);
  };

  const handleCanvasClick = (event: React.MouseEvent<SVGSVGElement>) => {
    if (ignoreNextCanvasClickRef.current) {
      ignoreNextCanvasClickRef.current = false;
      return;
    }
    const target = event.target as SVGElement;
    if (event.target !== event.currentTarget && target.dataset.diagramCanvas !== "true") return;
    setSelectedNodeId(null);
    setSelectedNodeIds([]);
    setSelectedEdgeId(null);
    setSelectedLineId(null);
    setSelectedLineIds([]);
    setIsCanvasSelected(true);
    setConnectingFromId(null);
  };

  const startResize = (event: React.PointerEvent<SVGCircleElement>, node: DiagramNode) => {
    event.stopPropagation();
    const point = svgPointFromEvent(event);
    resizeStateRef.current = {
      nodeId: node.id,
      startX: point.x,
      startY: point.y,
      width: node.width,
      height: node.height,
    };
    (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
  };

  const startGroupResize = (event: React.PointerEvent<SVGCircleElement>, bounds: Bounds) => {
    event.stopPropagation();
    const point = svgPointFromEvent(event);
    groupResizeStateRef.current = {
      startX: point.x,
      startY: point.y,
      bounds,
      nodes: selectedNodes,
      lines: selectedLines,
    };
    (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
  };

  const startLineEndpointDrag = (
    event: React.PointerEvent<SVGCircleElement>,
    line: DiagramLine,
    pointName: "start" | "end",
  ) => {
    event.stopPropagation();
    const point = svgPointFromEvent(event);
    const baseX = pointName === "start" ? line.x1 : line.x2;
    const baseY = pointName === "start" ? line.y1 : line.y2;
    lineDragStateRef.current = {
      lineId: line.id,
      point: pointName,
      offsetX: point.x - baseX,
      offsetY: point.y - baseY,
    };
    setSelectedLineId(line.id);
    setSelectedLineIds([]);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setIsCanvasSelected(false);
    (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
  };

  const startCanvasResize = (event: React.PointerEvent<SVGCircleElement>) => {
    event.stopPropagation();
    const point = svgPointFromEvent(event);
    canvasResizeStateRef.current = {
      startX: point.x,
      startY: point.y,
      width: diagram.width,
      height: diagram.height,
    };
    setSelectedNodeId(null);
    setSelectedNodeIds([]);
    setSelectedEdgeId(null);
    setSelectedLineId(null);
    setSelectedLineIds([]);
    setIsCanvasSelected(true);
    (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
  };

  const startSelectionBox = (event: React.PointerEvent<SVGRectElement>) => {
    if (event.button !== 0) return;
    const point = svgPointFromEvent(event);
    if (isTextBoxToolActive) {
      textBoxDragStateRef.current = { startX: point.x, startY: point.y };
      setTextBoxDraft({ x: point.x, y: point.y, width: 0, height: 0 });
      setSelectedNodeId(null);
      setSelectedNodeIds([]);
      setSelectedEdgeId(null);
      setSelectedLineId(null);
      setIsCanvasSelected(false);
      (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
      return;
    }
    selectionDragStateRef.current = { startX: point.x, startY: point.y };
    setSelectionBox({ x: point.x, y: point.y, width: 0, height: 0 });
    setSelectedNodeId(null);
    setSelectedNodeIds([]);
    setSelectedEdgeId(null);
    setSelectedLineId(null);
    setSelectedLineIds([]);
    setIsCanvasSelected(false);
    (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
  };

  const handleSave = () => {
    onSave(diagram);
    onClose();
  };

  const handleCanvasWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    const target = canvasScrollRef.current;
    if (!target) return;

    event.preventDefault();
    event.stopPropagation();
    target.scrollTop += event.deltaY;
    target.scrollLeft += event.deltaX;
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="relative flex h-[min(92vh,820px)] w-[min(96vw,1180px)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <header className="flex items-center justify-between gap-4 border-b border-border px-5 py-3">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              bloco
            </p>
            <h2 className="font-display text-2xl">
              <em className="italic text-gradient">organograma</em>
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              className="inline-flex h-9 items-center gap-2 rounded-md bg-gradient-glow px-4 text-sm font-medium text-primary-foreground transition-transform hover:scale-[1.02]"
            >
              Salvar diagrama
            </button>
            <button
              type="button"
              onClick={onClose}
              className="grid h-9 w-9 place-items-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="flex flex-1 min-h-0 flex-col gap-3 px-5 py-4 lg:flex-row">
          <aside className="flex max-h-full w-full shrink-0 flex-col gap-3 overflow-y-auto pr-1 overscroll-contain lg:w-64">
            <section className="rounded-xl border border-border bg-background/40 p-3">
              <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                adicionar
              </p>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => addNode("rectangle")}
                  className="flex flex-col items-center gap-1 rounded-lg border border-border bg-card px-2 py-2 text-xs text-foreground transition-colors hover:border-primary/50 hover:bg-secondary"
                >
                  <RectangleHorizontal className="h-4 w-4" />
                  retangulo
                </button>
                <button
                  type="button"
                  onClick={() => addNode("square")}
                  className="flex flex-col items-center gap-1 rounded-lg border border-border bg-card px-2 py-2 text-xs text-foreground transition-colors hover:border-primary/50 hover:bg-secondary"
                >
                  <Square className="h-4 w-4" />
                  quadrado
                </button>
                <button
                  type="button"
                  onClick={() => addNode("circle")}
                  className="flex flex-col items-center gap-1 rounded-lg border border-border bg-card px-2 py-2 text-xs text-foreground transition-colors hover:border-primary/50 hover:bg-secondary"
                >
                  <Circle className="h-4 w-4" />
                  circulo
                </button>
                <button
                  type="button"
                  onClick={() => addNode("pill")}
                  className="flex flex-col items-center gap-1 rounded-lg border border-border bg-card px-2 py-2 text-xs text-foreground transition-colors hover:border-primary/50 hover:bg-secondary"
                >
                  <span className="h-4 w-8 rounded-full border border-current" />
                  capsula
                </button>
                <button
                  type="button"
                  onClick={() => setIsTextBoxToolActive((current) => !current)}
                  className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-2 text-xs text-foreground transition-colors hover:border-primary/50 hover:bg-secondary ${
                    isTextBoxToolActive ? "border-primary bg-primary/10" : "border-border bg-card"
                  }`}
                >
                  <Type className="h-4 w-4" />
                  texto
                </button>
                <button
                  type="button"
                  onClick={addFreeLine}
                  className="flex flex-col items-center gap-1 rounded-lg border border-border bg-card px-2 py-2 text-xs text-foreground transition-colors hover:border-primary/50 hover:bg-secondary"
                >
                  <Minus className="h-4 w-4" />
                  linha
                </button>
                <button
                  type="button"
                  onClick={addDecisionTree}
                  className="col-span-3 flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-2 py-2 text-xs text-foreground transition-colors hover:border-primary/50 hover:bg-secondary"
                >
                  <Workflow className="h-4 w-4" />
                  arvore de decisao
                </button>
              </div>
              <p className="mt-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                ramificar do selecionado
              </p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => branchFromSelected("rectangle")}
                  disabled={!selectedNode}
                  className="grid place-items-center rounded-lg border border-border bg-card px-2 py-2 text-xs text-foreground transition-colors hover:border-leaf/60 hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <RectangleHorizontal className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => branchFromSelected("square")}
                  disabled={!selectedNode}
                  className="grid place-items-center rounded-lg border border-border bg-card px-2 py-2 text-xs text-foreground transition-colors hover:border-leaf/60 hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Square className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => branchFromSelected("circle")}
                  disabled={!selectedNode}
                  className="grid place-items-center rounded-lg border border-border bg-card px-2 py-2 text-xs text-foreground transition-colors hover:border-leaf/60 hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Circle className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => branchFromSelected("pill")}
                  disabled={!selectedNode}
                  className="grid place-items-center rounded-lg border border-border bg-card px-2 py-2 text-xs text-foreground transition-colors hover:border-leaf/60 hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <span className="h-4 w-8 rounded-full border border-current" />
                </button>
              </div>
            </section>

            <section className="rounded-xl border border-border bg-background/40 p-3">
              <div className="flex items-center justify-between">
                <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  forma selecionada
                </p>
                {selectedNode && (
                  <button
                    type="button"
                    onClick={removeSelected}
                    className="grid h-7 w-7 place-items-center rounded-md border border-border text-muted-foreground transition-colors hover:border-destructive hover:text-destructive"
                    title="Remover"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              {selectedNodes.length > 1 && selectedGroupBounds ? (
                <div className="mt-2 space-y-3">
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {selectedNodes.length} formas selecionadas. Arraste uma forma do grupo para mover
                    todas, ou use a bolinha da caixa para redimensionar o conjunto.
                  </p>
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      tamanho do grupo
                    </p>
                    <div className="mt-1 grid grid-cols-2 gap-2">
                      <label className="block">
                        <span className="text-[10px] text-muted-foreground">largura</span>
                        <input
                          type="number"
                          min={48}
                          value={Math.round(selectedGroupBounds.width)}
                          onChange={(event) => {
                            const nextWidth = Number(event.target.value);
                            if (!Number.isFinite(nextWidth)) return;
                            const scaleX = nextWidth / Math.max(1, selectedGroupBounds.width);
                            setDiagram((current) => ({
                              ...current,
                              nodes: current.nodes.map((node) =>
                                selectedNodeIds.includes(node.id)
                                  ? clampToCanvas(
                                      {
                                        ...node,
                                        x: selectedGroupBounds.x + (node.x - selectedGroupBounds.x) * scaleX,
                                        width: node.width * scaleX,
                                      },
                                      current.width,
                                      current.height,
                                    )
                                  : node,
                              ),
                            }));
                          }}
                          className="mt-1 h-8 w-full rounded-md border border-border bg-input/40 px-2 text-xs outline-none focus:border-primary/60"
                        />
                      </label>
                      <label className="block">
                        <span className="text-[10px] text-muted-foreground">altura</span>
                        <input
                          type="number"
                          min={40}
                          value={Math.round(selectedGroupBounds.height)}
                          onChange={(event) => {
                            const nextHeight = Number(event.target.value);
                            if (!Number.isFinite(nextHeight)) return;
                            const scaleY = nextHeight / Math.max(1, selectedGroupBounds.height);
                            setDiagram((current) => ({
                              ...current,
                              nodes: current.nodes.map((node) =>
                                selectedNodeIds.includes(node.id)
                                  ? clampToCanvas(
                                      {
                                        ...node,
                                        y: selectedGroupBounds.y + (node.y - selectedGroupBounds.y) * scaleY,
                                        height: node.height * scaleY,
                                      },
                                      current.width,
                                      current.height,
                                    )
                                  : node,
                              ),
                            }));
                          }}
                          className="mt-1 h-8 w-full rounded-md border border-border bg-input/40 px-2 text-xs outline-none focus:border-primary/60"
                        />
                      </label>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={removeSelected}
                    className="inline-flex h-9 items-center gap-2 rounded-md border border-border px-3 text-xs font-medium text-muted-foreground hover:border-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    apagar grupo
                  </button>
                </div>
              ) : selectedNode ? (
                <div className="mt-2 space-y-3">
                  <label className="block">
                    <span className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      <Type className="h-3 w-3" /> texto
                    </span>
                    <textarea
                      value={selectedNode.text}
                      onChange={(event) =>
                        updateNode(selectedNode.id, { text: event.target.value })
                      }
                      rows={2}
                      className="mt-1 min-h-16 w-full resize-none rounded-md border border-border bg-input/40 px-2 py-1.5 text-sm outline-none focus:border-primary/60"
                      placeholder="texto da forma"
                    />
                  </label>
                  <label className="block">
                    <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      formato
                    </span>
                    <select
                      value={selectedNode.type}
                      onChange={(event) => {
                        const nextType = event.target.value as DiagramShape;
                        const squareSize = Math.max(selectedNode.width, selectedNode.height);
                        updateNode(selectedNode.id, {
                          type: nextType,
                          ...(nextType === "circle" || nextType === "square"
                            ? { width: squareSize, height: squareSize }
                            : {}),
                        });
                      }}
                      className="mt-1 h-9 w-full rounded-md border border-border bg-input/40 px-2 text-sm outline-none focus:border-primary/60"
                    >
                      <option value="rectangle">retangulo</option>
                      <option value="pill">capsula</option>
                      <option value="circle">circulo</option>
                      <option value="square">quadrado</option>
                      <option value="text">texto livre</option>
                    </select>
                  </label>
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      tamanho
                    </p>
                    <div className="mt-1 grid grid-cols-2 gap-2">
                      <label className="block">
                        <span className="text-[10px] text-muted-foreground">largura</span>
                        <input
                          type="number"
                          min={48}
                          value={Math.round(selectedNode.width)}
                          onChange={(event) =>
                            updateNode(selectedNode.id, { width: Number(event.target.value) })
                          }
                          className="mt-1 h-8 w-full rounded-md border border-border bg-input/40 px-2 text-xs outline-none focus:border-primary/60"
                        />
                      </label>
                      <label className="block">
                        <span className="text-[10px] text-muted-foreground">altura</span>
                        <input
                          type="number"
                          min={40}
                          value={Math.round(selectedNode.height)}
                          onChange={(event) =>
                            updateNode(selectedNode.id, { height: Number(event.target.value) })
                          }
                          className="mt-1 h-8 w-full rounded-md border border-border bg-input/40 px-2 text-xs outline-none focus:border-primary/60"
                        />
                      </label>
                    </div>
                  </div>
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      cor
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {PALETTE_OPTIONS.map((option) => {
                        const palette = paletteFor(option.value);
                        const isActive = selectedNode.color === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => updateNode(selectedNode.id, { color: option.value })}
                            className={`grid h-7 w-7 place-items-center rounded-full border ${isActive ? "ring-2 ring-primary" : "border-border"}`}
                            title={option.label}
                            style={{ background: palette.fill, borderColor: palette.stroke }}
                          >
                            <span className="sr-only">{option.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setConnectingFromId((current) => (current ? null : selectedNode.id))
                    }
                    className={`inline-flex h-9 items-center gap-2 rounded-md border px-3 text-xs font-medium transition-colors ${
                      connectingFromId === selectedNode.id
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-foreground hover:bg-secondary"
                    }`}
                  >
                    <Link2 className="h-3.5 w-3.5" />
                    {connectingFromId === selectedNode.id
                      ? "clique em outra forma"
                      : "conectar a outra"}
                  </button>
                </div>
              ) : isCanvasSelected ? (
                <div className="mt-2 space-y-3">
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Arraste a bolinha no canto inferior direito do fundo para aumentar ou diminuir
                    o espaco total do organograma.
                  </p>
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      tamanho do organograma
                    </p>
                    <div className="mt-1 grid grid-cols-2 gap-2">
                      <label className="block">
                        <span className="text-[10px] text-muted-foreground">largura</span>
                        <input
                          type="number"
                          min={320}
                          max={2400}
                          value={diagram.width}
                          onChange={(event) =>
                            updateDiagramSize({ width: Number(event.target.value) })
                          }
                          className="mt-1 h-8 w-full rounded-md border border-border bg-input/40 px-2 text-xs outline-none focus:border-primary/60"
                        />
                      </label>
                      <label className="block">
                        <span className="text-[10px] text-muted-foreground">altura</span>
                        <input
                          type="number"
                          min={200}
                          max={2000}
                          value={diagram.height}
                          onChange={(event) =>
                            updateDiagramSize({ height: Number(event.target.value) })
                          }
                          className="mt-1 h-8 w-full rounded-md border border-border bg-input/40 px-2 text-xs outline-none focus:border-primary/60"
                        />
                      </label>
                    </div>
                  </div>
                </div>
              ) : selectedEdge ? (
                <div className="mt-2 space-y-3">
                  <label className="block">
                    <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      rotulo da seta
                    </span>
                    <input
                      value={selectedEdge.label}
                      onChange={(event) =>
                        updateEdge(selectedEdge.id, { label: event.target.value })
                      }
                      className="mt-1 h-9 w-full rounded-md border border-border bg-input/40 px-2 text-sm outline-none focus:border-primary/60"
                      placeholder="ex: depende de"
                    />
                  </label>
                  <label className="flex items-center justify-between rounded-md border border-border bg-input/20 px-3 py-2 text-xs text-foreground">
                    <span>cabeca da seta</span>
                    <input
                      type="checkbox"
                      checked={selectedEdge.arrow !== false}
                      onChange={(event) =>
                        updateEdge(selectedEdge.id, { arrow: event.target.checked })
                      }
                      className="accent-primary"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={removeSelected}
                    className="inline-flex h-9 items-center gap-2 rounded-md border border-border px-3 text-xs font-medium text-muted-foreground hover:border-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    apagar seta
                  </button>
                </div>
              ) : selectedLine ? (
                <div className="mt-2 space-y-3">
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Arraste as bolinhas nas pontas da linha para apontar onde quiser.
                  </p>
                  <label className="flex items-center justify-between rounded-md border border-border bg-input/20 px-3 py-2 text-xs text-foreground">
                    <span>cabeca da linha</span>
                    <input
                      type="checkbox"
                      checked={selectedLine.arrow === true}
                      onChange={(event) =>
                        updateLine(selectedLine.id, { arrow: event.target.checked })
                      }
                      className="accent-primary"
                    />
                  </label>
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      cor
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {PALETTE_OPTIONS.map((option) => {
                        const palette = paletteFor(option.value);
                        const isActive = selectedLine.color === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => updateLine(selectedLine.id, { color: option.value })}
                            className={`grid h-7 w-7 place-items-center rounded-full border ${isActive ? "ring-2 ring-primary" : "border-border"}`}
                            title={option.label}
                            style={{ background: palette.fill, borderColor: palette.stroke }}
                          >
                            <span className="sr-only">{option.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={removeSelected}
                    className="inline-flex h-9 items-center gap-2 rounded-md border border-border px-3 text-xs font-medium text-muted-foreground hover:border-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    apagar linha
                  </button>
                </div>
              ) : (
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  Clique numa forma do canvas para editar. Use os <strong>+</strong> ao redor para
                  ramificar imediatamente.
                </p>
              )}
            </section>

            <section className="rounded-xl border border-border bg-background/40 p-3 text-xs leading-relaxed text-muted-foreground">
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                atalhos
              </p>
              <ul className="mt-2 space-y-1">
                <li>arraste qualquer forma para reposicionar</li>
                <li>
                  clique no <strong>+</strong> ao lado da forma para ramificar
                </li>
                <li>clique numa seta para editar/apagar</li>
                <li>esc fecha o editor</li>
              </ul>
            </section>
          </aside>

          <div className="relative flex-1 min-h-0 overflow-hidden rounded-xl border border-border bg-background/60">
            {connectingFromId && (
              <div className="absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-primary">
                modo conectar — clique numa forma de destino
              </div>
            )}
            <div
              ref={canvasScrollRef}
              className="h-full max-h-full w-full overflow-scroll p-4 overscroll-contain"
              onWheel={handleCanvasWheel}
            >
              <CanvasSvg
                diagram={diagram}
                selectedNodeId={selectedNodeId}
                selectedNodeIds={selectedNodeIds}
                selectedEdgeId={selectedEdgeId}
                selectedLineId={selectedLineId}
                selectedLineIds={selectedLineIds}
                selectedGroupBounds={selectedGroupBounds}
                selectionBox={selectionBox}
                textBoxDraft={textBoxDraft}
                isTextBoxToolActive={isTextBoxToolActive}
                isCanvasSelected={isCanvasSelected}
                connectingFromId={connectingFromId}
                onCanvasClick={handleCanvasClick}
                onCanvasPointerDown={startSelectionBox}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onNodePointerDown={startDrag}
                onSelectEdge={(edgeId) => {
                  setSelectedEdgeId(edgeId);
                  setSelectedNodeId(null);
                  setSelectedNodeIds([]);
                  setSelectedLineId(null);
                  setSelectedLineIds([]);
                  setIsCanvasSelected(false);
                }}
                onSelectLine={(lineId) => {
                  setSelectedLineId(lineId);
                  setSelectedLineIds([]);
                  setSelectedNodeId(null);
                  setSelectedNodeIds([]);
                  setSelectedEdgeId(null);
                  setIsCanvasSelected(false);
                }}
                onResizeStart={startResize}
                onUpdateNode={updateNode}
                onGroupResizeStart={startGroupResize}
                onLineEndpointPointerDown={startLineEndpointDrag}
                onCanvasResizeStart={startCanvasResize}
                onBranchPlus={(node) => {
                  if (connectingFromId) {
                    setConnectingFromId(null);
                  }
                  setSelectedNodeId(node.id);
                  setSelectedNodeIds([]);
                  setSelectedLineIds([]);
                  if (isDecisionTreeNode(diagram, node)) {
                    addDecisionChild(node);
                    return;
                  }
                  addNode("rectangle", node);
                }}
                svgRef={svgRef}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

type CanvasProps = {
  diagram: Diagram;
  selectedNodeId: string | null;
  selectedNodeIds: string[];
  selectedEdgeId: string | null;
  selectedLineId: string | null;
  selectedLineIds: string[];
  selectedGroupBounds: Bounds | null;
  selectionBox: Bounds | null;
  textBoxDraft: Bounds | null;
  isTextBoxToolActive: boolean;
  isCanvasSelected: boolean;
  connectingFromId: string | null;
  onCanvasClick: (event: React.MouseEvent<SVGSVGElement>) => void;
  onCanvasPointerDown: (event: React.PointerEvent<SVGRectElement>) => void;
  onPointerMove: (event: React.PointerEvent<SVGSVGElement>) => void;
  onPointerUp: (event: React.PointerEvent<SVGSVGElement>) => void;
  onNodePointerDown: (event: React.PointerEvent<SVGGElement>, node: DiagramNode) => void;
  onSelectEdge: (edgeId: string) => void;
  onSelectLine: (lineId: string) => void;
  onResizeStart: (event: React.PointerEvent<SVGCircleElement>, node: DiagramNode) => void;
  onUpdateNode: (nodeId: string, patch: Partial<DiagramNode>) => void;
  onGroupResizeStart: (event: React.PointerEvent<SVGCircleElement>, bounds: Bounds) => void;
  onCanvasResizeStart: (event: React.PointerEvent<SVGCircleElement>) => void;
  onLineEndpointPointerDown: (
    event: React.PointerEvent<SVGCircleElement>,
    line: DiagramLine,
    point: "start" | "end",
  ) => void;
  onBranchPlus: (node: DiagramNode) => void;
  svgRef: React.RefObject<SVGSVGElement | null>;
};

function CanvasSvg({
  diagram,
  selectedNodeId,
  selectedNodeIds,
  selectedEdgeId,
  selectedLineId,
  selectedLineIds,
  selectedGroupBounds,
  selectionBox,
  textBoxDraft,
  isTextBoxToolActive,
  isCanvasSelected,
  connectingFromId,
  onCanvasClick,
  onCanvasPointerDown,
  onPointerMove,
  onPointerUp,
  onNodePointerDown,
  onSelectEdge,
  onSelectLine,
  onResizeStart,
  onUpdateNode,
  onGroupResizeStart,
  onCanvasResizeStart,
  onLineEndpointPointerDown,
  onBranchPlus,
  svgRef,
}: CanvasProps) {
  const padding = 16;
  const viewBox = `${-padding} ${-padding} ${diagram.width + padding * 2} ${diagram.height + padding * 2}`;
  const strokeColor = "color-mix(in oklch, var(--muted-foreground) 65%, transparent)";

  return (
    <svg
      ref={svgRef}
      viewBox={viewBox}
      className="block select-none"
      style={{ minWidth: diagram.width + padding * 2, minHeight: diagram.height + padding * 2 }}
      onClick={onCanvasClick}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      <defs>
        <marker
          id="lure-diagram-arrow-editor"
          viewBox="0 0 12 12"
          refX="10"
          refY="6"
          markerWidth="9"
          markerHeight="9"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 12 6 L 0 12 z" fill={strokeColor} />
        </marker>
        <pattern id="lure-diagram-grid" width="32" height="32" patternUnits="userSpaceOnUse">
          <path
            d="M 32 0 L 0 0 0 32"
            fill="none"
            stroke="color-mix(in oklch, var(--border) 50%, transparent)"
            strokeWidth="0.6"
          />
        </pattern>
      </defs>
      <rect
        data-diagram-canvas="true"
        x={0}
        y={0}
        width={diagram.width}
        height={diagram.height}
        rx={18}
        ry={18}
        fill="url(#lure-diagram-grid)"
        stroke={isCanvasSelected ? "var(--primary)" : "var(--border)"}
        strokeWidth={isCanvasSelected ? 2 : 1}
        onPointerDown={onCanvasPointerDown}
        style={{ cursor: isTextBoxToolActive ? "text" : "crosshair" }}
      />
      <circle
        cx={diagram.width}
        cy={diagram.height}
        r={8}
        fill="var(--background)"
        stroke={isCanvasSelected ? "var(--primary)" : "var(--muted-foreground)"}
        strokeWidth={2}
        onPointerDown={onCanvasResizeStart}
        style={{ cursor: "nwse-resize" }}
      />

      {(diagram.lines ?? []).map((line) => {
        const palette = paletteFor(line.color);
        const isSelected = line.id === selectedLineId || selectedLineIds.includes(line.id);
        return (
          <g key={line.id}>
            <line
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              stroke={isSelected ? "var(--primary)" : palette.stroke}
              strokeWidth={isSelected ? 2.6 : 2}
              markerEnd={line.arrow ? "url(#lure-diagram-arrow-editor)" : undefined}
              onClick={(event) => {
                event.stopPropagation();
                onSelectLine(line.id);
              }}
              style={{ cursor: "pointer" }}
            />
            <line
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              stroke="transparent"
              strokeWidth={14}
              onClick={(event) => {
                event.stopPropagation();
                onSelectLine(line.id);
              }}
              style={{ cursor: "pointer" }}
            />
            {isSelected && (
              <>
                <circle
                  cx={line.x1}
                  cy={line.y1}
                  r={6}
                  fill="var(--background)"
                  stroke="var(--primary)"
                  strokeWidth={2}
                  onPointerDown={(event) => onLineEndpointPointerDown(event, line, "start")}
                  style={{ cursor: "move" }}
                />
                <circle
                  cx={line.x2}
                  cy={line.y2}
                  r={6}
                  fill="var(--background)"
                  stroke="var(--primary)"
                  strokeWidth={2}
                  onPointerDown={(event) => onLineEndpointPointerDown(event, line, "end")}
                  style={{ cursor: "move" }}
                />
              </>
            )}
          </g>
        );
      })}

      {diagram.edges.map((edge) => {
        const geometry = computeEdgeGeometry(edge, diagram.nodes);
        if (!geometry) return null;
        const isSelected = edge.id === selectedEdgeId;
        return (
          <g key={edge.id}>
            <line
              x1={geometry.fromX}
              y1={geometry.fromY}
              x2={geometry.toX}
              y2={geometry.toY}
              stroke={isSelected ? "var(--primary)" : strokeColor}
              strokeWidth={isSelected ? 2.4 : 1.6}
              markerEnd={edge.arrow === false ? undefined : "url(#lure-diagram-arrow-editor)"}
              onClick={(event) => {
                event.stopPropagation();
                onSelectEdge(edge.id);
              }}
              style={{ cursor: "pointer" }}
            />
            {/* Hit area for easier selection */}
            <line
              x1={geometry.fromX}
              y1={geometry.fromY}
              x2={geometry.toX}
              y2={geometry.toY}
              stroke="transparent"
              strokeWidth={14}
              onClick={(event) => {
                event.stopPropagation();
                onSelectEdge(edge.id);
              }}
              style={{ cursor: "pointer" }}
            />
            {edge.label ? (
              <g pointerEvents="none">
                <rect
                  x={geometry.midX - Math.max(28, edge.label.length * 4.4)}
                  y={geometry.midY - 11}
                  width={Math.max(56, edge.label.length * 8.8)}
                  height={22}
                  rx={11}
                  ry={11}
                  fill="var(--card)"
                  stroke={isSelected ? "var(--primary)" : strokeColor}
                  strokeWidth={0.8}
                  opacity={0.95}
                />
                <text
                  x={geometry.midX}
                  y={geometry.midY + 4}
                  textAnchor="middle"
                  fontFamily="var(--font-sans, sans-serif)"
                  fontSize={11}
                  fill="var(--foreground)"
                >
                  {edge.label}
                </text>
              </g>
            ) : null}
          </g>
        );
      })}

      {selectedGroupBounds && selectedNodeIds.length + selectedLineIds.length > 1 && (
        <g>
          <rect
            x={selectedGroupBounds.x - 8}
            y={selectedGroupBounds.y - 8}
            width={selectedGroupBounds.width + 16}
            height={selectedGroupBounds.height + 16}
            rx={14}
            ry={14}
            fill="none"
            stroke="var(--primary)"
            strokeDasharray="6 4"
            strokeWidth={1.6}
            pointerEvents="none"
          />
          <circle
            cx={selectedGroupBounds.x + selectedGroupBounds.width + 8}
            cy={selectedGroupBounds.y + selectedGroupBounds.height + 8}
            r={7}
            fill="var(--background)"
            stroke="var(--primary)"
            strokeWidth={2}
            onPointerDown={(event) => onGroupResizeStart(event, selectedGroupBounds)}
            style={{ cursor: "nwse-resize" }}
          />
        </g>
      )}

      {selectionBox && (
        <rect
          x={Math.min(selectionBox.x, selectionBox.x + selectionBox.width)}
          y={Math.min(selectionBox.y, selectionBox.y + selectionBox.height)}
          width={Math.abs(selectionBox.width)}
          height={Math.abs(selectionBox.height)}
          fill="color-mix(in oklch, var(--primary) 14%, transparent)"
          stroke="var(--primary)"
          strokeDasharray="5 4"
          strokeWidth={1.2}
          pointerEvents="none"
        />
      )}

      {textBoxDraft && (
        <rect
          x={Math.min(textBoxDraft.x, textBoxDraft.x + textBoxDraft.width)}
          y={Math.min(textBoxDraft.y, textBoxDraft.y + textBoxDraft.height)}
          width={Math.abs(textBoxDraft.width)}
          height={Math.abs(textBoxDraft.height)}
          fill="color-mix(in oklch, var(--primary) 16%, transparent)"
          stroke="var(--primary)"
          strokeDasharray="6 4"
          strokeWidth={2}
          pointerEvents="none"
        />
      )}

      {diagram.nodes.map((node) => {
        const isSelected = node.id === selectedNodeId || selectedNodeIds.includes(node.id);
        const palette = paletteFor(node.color);
        const center = nodeCenter(node);
        const textFontSize = node.type === "text" ? (node.fontSize ?? 24) : 13;
        const textFamily =
          node.fontFamily === "serif"
            ? "var(--font-display, serif)"
            : node.fontFamily === "script"
              ? "var(--font-script, cursive)"
              : "var(--font-sans, sans-serif)";
        const lines = wrap(node.text, node.type === "text" ? Math.max(8, Math.floor(node.width / Math.max(7, textFontSize * 0.48))) : node.type === "circle" ? 12 : 22);
        const lineHeight = 16;
        const startY = center.y - ((lines.length - 1) * lineHeight) / 2;
        const isConnectSource = connectingFromId === node.id;

        return (
          <g
            key={node.id}
            onPointerDown={(event) => onNodePointerDown(event, node)}
            style={{ cursor: connectingFromId ? "crosshair" : "grab" }}
          >
            {node.type === "text" ? (
              <rect
                x={node.x}
                y={node.y}
                width={node.width}
                height={node.height}
                rx={8}
                ry={8}
                fill={isSelected ? "color-mix(in oklch, var(--primary) 8%, transparent)" : "transparent"}
                stroke={isSelected ? "var(--primary)" : "transparent"}
                strokeWidth={isSelected ? 1.5 : 0}
              />
            ) : node.type === "circle" ? (
              <ellipse
                cx={center.x}
                cy={center.y}
                rx={node.width / 2}
                ry={node.height / 2}
                fill={palette.fill}
                stroke={isSelected ? "var(--primary)" : palette.stroke}
                strokeWidth={isSelected ? 2 : 1.6}
              />
            ) : (
              <rect
                x={node.x}
                y={node.y}
                width={node.width}
                height={node.height}
                rx={node.type === "pill" ? node.height / 2 : 14}
                ry={node.type === "pill" ? node.height / 2 : 14}
                fill={palette.fill}
                stroke={isSelected ? "var(--primary)" : palette.stroke}
                strokeWidth={isSelected ? 2 : 1.6}
              />
            )}
            {isConnectSource && (
              <rect
                x={node.x - 5}
                y={node.y - 5}
                width={node.width + 10}
                height={node.height + 10}
                rx={18}
                ry={18}
                fill="none"
                stroke="var(--primary)"
                strokeDasharray="6 4"
                strokeWidth={1.5}
              />
            )}
            {node.type === "text" && isSelected && selectedNodeIds.length <= 1 ? (
              <TextNodeEditor node={node} paletteText={palette.text} onUpdateNode={onUpdateNode} />
            ) : (
              <text
                textAnchor={node.type === "text" ? "start" : "middle"}
                fontFamily={textFamily}
                fontSize={textFontSize}
                fontWeight={node.type === "text" ? (node.bold ? 700 : 500) : 500}
                fill={palette.text}
                pointerEvents="none"
              >
                {lines.length === 0 ? (
                  <tspan x={node.type === "text" ? node.x : center.x} y={node.type === "text" ? node.y + textFontSize : center.y + 4}>
                    {""}
                  </tspan>
                ) : (
                  lines.map((line, index) => (
                    <tspan
                      key={index}
                      x={node.type === "text" ? node.x : center.x}
                      y={node.type === "text" ? node.y + textFontSize + index * textFontSize * 1.25 : startY + index * lineHeight}
                    >
                      {line || " "}
                    </tspan>
                  ))
                )}
              </text>
            )}

            {isSelected && selectedNodeIds.length <= 1 && (
              <>
                {node.type !== "text" && <PlusAnchor node={node} onClick={() => onBranchPlus(node)} />}
                <ResizeAnchor node={node} onPointerDown={(event) => onResizeStart(event, node)} />
              </>
            )}
            {isSelected && selectedNodeIds.length <= 1 && node.type === "text" && (
              <TextStylePopup node={node} onUpdateNode={onUpdateNode} />
            )}
          </g>
        );
      })}
    </svg>
  );
}

function TextNodeEditor({
  node,
  paletteText,
  onUpdateNode,
}: {
  node: DiagramNode;
  paletteText: string;
  onUpdateNode: (nodeId: string, patch: Partial<DiagramNode>) => void;
}) {
  const fontFamily = TEXT_FONT_OPTIONS.find((option) => option.value === node.fontFamily)?.family;

  return (
    <foreignObject
      x={node.x}
      y={node.y}
      width={node.width}
      height={node.height}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <textarea
        autoFocus
        value={node.text}
        onChange={(event) => onUpdateNode(node.id, { text: event.target.value })}
        placeholder="escreva aqui..."
        className="h-full w-full resize-none rounded-md border border-primary/50 bg-transparent p-1 text-foreground outline-none focus:border-primary"
        style={{
          color: paletteText,
          fontFamily,
          fontSize: `${node.fontSize ?? 24}px`,
          fontWeight: node.bold ? 700 : 500,
          lineHeight: 1.25,
        }}
      />
    </foreignObject>
  );
}

function TextStylePopup({
  node,
  onUpdateNode,
}: {
  node: DiagramNode;
  onUpdateNode: (nodeId: string, patch: Partial<DiagramNode>) => void;
}) {
  const popupX = Math.max(8, Math.min(node.x, 560));
  const popupY = Math.max(8, node.y - 52);

  return (
    <foreignObject
      x={popupX}
      y={popupY}
      width={350}
      height={46}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="rounded-xl border border-border bg-card/95 p-2 shadow-card backdrop-blur">
        <div className="flex items-center gap-1">
          <select
            value={node.fontFamily ?? "sans"}
            onChange={(event) =>
              onUpdateNode(node.id, { fontFamily: event.target.value as DiagramNode["fontFamily"] })
            }
            className="h-7 w-24 rounded-md border border-border bg-input/60 px-1 text-[10px] text-foreground outline-none"
          >
            {TEXT_FONT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={10}
            max={96}
            value={node.fontSize ?? 24}
            onChange={(event) => onUpdateNode(node.id, { fontSize: Number(event.target.value) })}
            className="h-7 w-14 rounded-md border border-border bg-input/60 px-1 text-[10px] text-foreground outline-none"
            aria-label="Tamanho"
          />
          <button
            type="button"
            onClick={() => onUpdateNode(node.id, { bold: !node.bold })}
            className={`grid h-7 w-7 place-items-center rounded-md border text-xs font-bold ${
              node.bold ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground"
            }`}
          >
            B
          </button>
          <div className="ml-1 flex items-center gap-1">
            {PALETTE_OPTIONS.map((option) => {
              const palette = paletteFor(option.value);
              const isActive = node.color === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onUpdateNode(node.id, { color: option.value })}
                  className={`h-5 w-5 rounded-full border ${isActive ? "ring-2 ring-primary" : "border-border"}`}
                  style={{ background: palette.fill, borderColor: palette.stroke }}
                  title={option.label}
                />
              );
            })}
          </div>
        </div>
      </div>
    </foreignObject>
  );
}

function PlusAnchor({ node, onClick }: { node: DiagramNode; onClick: () => void }) {
  const cx = node.x + node.width + 14;
  const cy = node.y + node.height / 2;
  return (
    <g
      onPointerDown={(event) => {
        event.stopPropagation();
      }}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      style={{ cursor: "pointer" }}
    >
      <circle
        cx={cx}
        cy={cy}
        r={11}
        fill="var(--primary)"
        stroke="var(--background)"
        strokeWidth={2}
      />
      <line
        x1={cx - 5}
        y1={cy}
        x2={cx + 5}
        y2={cy}
        stroke="var(--primary-foreground)"
        strokeWidth={2}
      />
      <line
        x1={cx}
        y1={cy - 5}
        x2={cx}
        y2={cy + 5}
        stroke="var(--primary-foreground)"
        strokeWidth={2}
      />
    </g>
  );
}

function ResizeAnchor({
  node,
  onPointerDown,
}: {
  node: DiagramNode;
  onPointerDown: (event: React.PointerEvent<SVGCircleElement>) => void;
}) {
  return (
    <circle
      cx={node.x + node.width}
      cy={node.y + node.height}
      r={6}
      fill="var(--background)"
      stroke="var(--primary)"
      strokeWidth={2}
      onPointerDown={onPointerDown}
      style={{ cursor: "nwse-resize" }}
    />
  );
}

function wrap(text: string, maxChars: number) {
  const paragraphs = (text || "").split(/\r?\n/);
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    const words = paragraph.replace(/[ \t]+/g, " ").trim().split(" ");
    let current = "";

    for (const word of words) {
      if (!word) continue;
      if (!current) {
        current = word;
      } else if (current.length + word.length + 1 <= maxChars) {
        current = `${current} ${word}`;
      } else {
        lines.push(current);
        current = word;
      }
    }

    lines.push(current);
  }

  return lines.slice(0, 12);
}
