import type { SceneElement } from "../scene";

export type SnapAxis = "x" | "y";
export type SnapAnchor = "start" | "center" | "end";
export type SnapRect = Pick<SceneElement, "id" | "x" | "y" | "w" | "h" | "hidden">;

export type AlignmentGuide = {
  kind: "alignment";
  axis: SnapAxis;
  at: number;
  source: "page" | "peer";
  movingAnchor: SnapAnchor;
  targetAnchor: SnapAnchor;
  targetId?: string;
};

export type SpacingGuide = {
  kind: "spacing";
  axis: SnapAxis;
  gap: number;
  arrangement: "before" | "between" | "after";
  peerIds: readonly [string, string];
  segments: readonly [{ from: number; to: number }, { from: number; to: number }];
};

export type SnapGuide = AlignmentGuide | SpacingGuide;

export type SnapResult = {
  x: number;
  y: number;
  guides: SnapGuide[];
};

export type SnapOptions = {
  threshold?: number;
};

type Candidate = {
  start: number;
  distance: number;
  rank: number;
  key: string;
  guide: SnapGuide;
};

const DEFAULT_THRESHOLD = 0.01;
const DISTANCE_EPSILON = 1e-9;
const ANCHORS: readonly SnapAnchor[] = ["start", "center", "end"];

function startOf(rect: SnapRect, axis: SnapAxis) {
  return axis === "x" ? rect.x : rect.y;
}

function sizeOf(rect: SnapRect, axis: SnapAxis) {
  return axis === "x" ? rect.w : rect.h;
}

function endOf(rect: SnapRect, axis: SnapAxis) {
  return startOf(rect, axis) + sizeOf(rect, axis);
}

function anchorOf(rect: SnapRect, axis: SnapAxis, anchor: SnapAnchor) {
  const start = startOf(rect, axis);
  const size = sizeOf(rect, axis);
  return start + (anchor === "start" ? 0 : anchor === "center" ? size / 2 : size);
}

function overlapsAcrossAxis(a: SnapRect, b: SnapRect, axis: SnapAxis) {
  const crossAxis = axis === "x" ? "y" : "x";
  return Math.min(endOf(a, crossAxis), endOf(b, crossAxis)) > Math.max(startOf(a, crossAxis), startOf(b, crossAxis));
}

function validPeer(peer: SnapRect, moving: SnapRect) {
  return peer.id !== moving.id
    && !peer.hidden
    && [peer.x, peer.y, peer.w, peer.h].every(Number.isFinite)
    && peer.w >= 0
    && peer.h >= 0;
}

function candidate(start: number, moving: SnapRect, axis: SnapAxis, threshold: number, rank: number, key: string, guide: SnapGuide): Candidate | null {
  const size = sizeOf(moving, axis);
  const distance = Math.abs(start - startOf(moving, axis));
  if (distance > threshold || start < 0 || start + size > 1) return null;
  return { start, distance, rank, key, guide };
}

function alignmentCandidates(moving: SnapRect, peers: readonly SnapRect[], axis: SnapAxis, threshold: number) {
  const candidates: Candidate[] = [];
  const pagePositions = [0, 0.5, 1];

  ANCHORS.forEach((anchor, index) => {
    const at = pagePositions[index];
    const start = at - (anchorOf(moving, axis, anchor) - startOf(moving, axis));
    const guide: AlignmentGuide = { kind: "alignment", axis, at, source: "page", movingAnchor: anchor, targetAnchor: anchor };
    const match = candidate(start, moving, axis, threshold, 0, `page:${anchor}`, guide);
    if (match) candidates.push(match);
  });

  for (const peer of peers) {
    for (const targetAnchor of ANCHORS) {
      const at = anchorOf(peer, axis, targetAnchor);
      for (const movingAnchor of ANCHORS) {
        const start = at - (anchorOf(moving, axis, movingAnchor) - startOf(moving, axis));
        const guide: AlignmentGuide = {
          kind: "alignment",
          axis,
          at,
          source: "peer",
          movingAnchor,
          targetAnchor,
          targetId: peer.id,
        };
        const rank = targetAnchor === "center" || movingAnchor === "center"
          ? targetAnchor === movingAnchor ? 1 : 2
          : 1;
        const match = candidate(start, moving, axis, threshold, rank, `${peer.id}:${targetAnchor}:${movingAnchor}`, guide);
        if (match) candidates.push(match);
      }
    }
  }

  return candidates;
}

function spacingCandidates(moving: SnapRect, peers: readonly SnapRect[], axis: SnapAxis, threshold: number) {
  const candidates: Candidate[] = [];
  const alignedPeers = peers.filter((peer) => overlapsAcrossAxis(moving, peer, axis));
  const movingStart = startOf(moving, axis);
  const movingEnd = endOf(moving, axis);
  const movingSize = sizeOf(moving, axis);
  const before = alignedPeers
    .filter((peer) => endOf(peer, axis) <= movingStart + threshold)
    .sort((a, b) => endOf(b, axis) - endOf(a, axis) || a.id.localeCompare(b.id));
  const after = alignedPeers
    .filter((peer) => startOf(peer, axis) >= movingEnd - threshold)
    .sort((a, b) => startOf(a, axis) - startOf(b, axis) || a.id.localeCompare(b.id));

  if (before[0] && after[0]) {
    const left = before[0];
    const right = after[0];
    const available = startOf(right, axis) - endOf(left, axis) - movingSize;
    if (available >= 0) {
      const gap = available / 2;
      const start = endOf(left, axis) + gap;
      const guide: SpacingGuide = {
        kind: "spacing",
        axis,
        gap,
        arrangement: "between",
        peerIds: [left.id, right.id],
        segments: [
          { from: endOf(left, axis), to: start },
          { from: start + movingSize, to: startOf(right, axis) },
        ],
      };
      const match = candidate(start, moving, axis, threshold, 3, `between:${left.id}:${right.id}`, guide);
      if (match) candidates.push(match);
    }
  }

  if (before[0] && before[1]) {
    const near = before[0];
    const far = before[1];
    const gap = startOf(near, axis) - endOf(far, axis);
    if (gap >= 0) {
      const start = endOf(near, axis) + gap;
      const guide: SpacingGuide = {
        kind: "spacing",
        axis,
        gap,
        arrangement: "after",
        peerIds: [far.id, near.id],
        segments: [
          { from: endOf(far, axis), to: startOf(near, axis) },
          { from: endOf(near, axis), to: start },
        ],
      };
      const match = candidate(start, moving, axis, threshold, 3, `after:${far.id}:${near.id}`, guide);
      if (match) candidates.push(match);
    }
  }

  if (after[0] && after[1]) {
    const near = after[0];
    const far = after[1];
    const gap = startOf(far, axis) - endOf(near, axis);
    if (gap >= 0) {
      const start = startOf(near, axis) - gap - movingSize;
      const guide: SpacingGuide = {
        kind: "spacing",
        axis,
        gap,
        arrangement: "before",
        peerIds: [near.id, far.id],
        segments: [
          { from: start + movingSize, to: startOf(near, axis) },
          { from: endOf(near, axis), to: startOf(far, axis) },
        ],
      };
      const match = candidate(start, moving, axis, threshold, 3, `before:${near.id}:${far.id}`, guide);
      if (match) candidates.push(match);
    }
  }

  return candidates;
}

function snapAxis(moving: SnapRect, peers: readonly SnapRect[], axis: SnapAxis, threshold: number) {
  const candidates = [
    ...alignmentCandidates(moving, peers, axis, threshold),
    ...spacingCandidates(moving, peers, axis, threshold),
  ];
  candidates.sort((a, b) => {
    const distanceDifference = a.distance - b.distance;
    return Math.abs(distanceDifference) > DISTANCE_EPSILON
      ? distanceDifference
      : a.rank - b.rank || a.key.localeCompare(b.key);
  });
  return candidates[0];
}

export function snapElementPosition(moving: SnapRect, peers: readonly SnapRect[], options: SnapOptions = {}): SnapResult {
  const threshold = Number.isFinite(options.threshold) ? Math.max(0, options.threshold as number) : DEFAULT_THRESHOLD;
  const visiblePeers = peers.filter((peer) => validPeer(peer, moving));
  const horizontal = snapAxis(moving, visiblePeers, "x", threshold);
  const vertical = snapAxis(moving, visiblePeers, "y", threshold);
  return {
    x: horizontal?.start ?? moving.x,
    y: vertical?.start ?? moving.y,
    guides: [horizontal?.guide, vertical?.guide].filter((guide): guide is SnapGuide => Boolean(guide)),
  };
}
