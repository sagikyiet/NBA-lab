"use client";

import { useCallback, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";

type DragPosition = { x: number; y: number };

export function useGrabReorder(onMove: (sourceId: string, targetId: string) => void, { autoScroll = false }: { autoScroll?: boolean } = {}) {
  const activeRef = useRef<string | null>(null);
  const targetRef = useRef<string | null>(null);
  const originRef = useRef<DragPosition>({ x: 0, y: 0 });
  const pointerRef = useRef<DragPosition>({ x: 0, y: 0 });
  const originScrollRef = useRef(0);
  const scrollFrameRef = useRef<number | null>(null);
  const moveRef = useRef(onMove);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [offset, setOffset] = useState<DragPosition>({ x: 0, y: 0 });
  moveRef.current = onMove;

  const updateDrag = useCallback(() => {
    const sourceId = activeRef.current;
    if (!sourceId) return;
    const { x, y } = pointerRef.current;
    setOffset({ x: x - originRef.current.x, y: y - originRef.current.y + window.scrollY - originScrollRef.current });
    const target = document.elementsFromPoint(x, y)
      .map((element) => element.closest<HTMLElement>("[data-reorder-id]"))
      .find((element) => element?.dataset.reorderId && element.dataset.reorderId !== sourceId);
    const nextTarget = target?.dataset.reorderId ?? null;
    if (nextTarget !== targetRef.current) {
      targetRef.current = nextTarget;
      setTargetId(nextTarget);
    }
  }, []);

  const scrollFrame = useCallback(function frame() {
    scrollFrameRef.current = null;
    if (!activeRef.current) return;
    const edge = 100;
    const { y } = pointerRef.current;
    const topDistance = Math.max(0, y - 90); // Leave room for the sticky tabs.
    const bottomDistance = Math.max(0, window.innerHeight - y);
    const direction = topDistance < edge ? -1 : bottomDistance < edge ? 1 : 0;
    if (!direction) return;
    const proximity = 1 - Math.min(topDistance, bottomDistance) / edge;
    const before = window.scrollY;
    window.scrollBy(0, direction * (3 + 27 * proximity * proximity));
    if (window.scrollY !== before) {
      updateDrag();
      scrollFrameRef.current = window.requestAnimationFrame(frame);
    }
  }, [updateDrag]);

  const finish = useCallback((event: ReactPointerEvent<HTMLElement>, cancelled = false) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    const sourceId = activeRef.current;
    const destinationId = targetRef.current;
    if (!cancelled && sourceId && destinationId && sourceId !== destinationId) moveRef.current(sourceId, destinationId);
    if (scrollFrameRef.current !== null) window.cancelAnimationFrame(scrollFrameRef.current);
    scrollFrameRef.current = null;
    activeRef.current = null;
    targetRef.current = null;
    setActiveId(null);
    setTargetId(null);
    setOffset({ x: 0, y: 0 });
    document.body.style.removeProperty("cursor");
    document.body.style.removeProperty("user-select");
  }, []);

  const bind = useCallback((id: string) => ({
    onPointerDown(event: ReactPointerEvent<HTMLElement>) {
      if (event.button !== 0) return;
      event.preventDefault();
      activeRef.current = id;
      targetRef.current = null;
      originRef.current = { x: event.clientX, y: event.clientY };
      pointerRef.current = { x: event.clientX, y: event.clientY };
      originScrollRef.current = window.scrollY;
      setActiveId(id);
      setTargetId(null);
      setOffset({ x: 0, y: 0 });
      event.currentTarget.setPointerCapture(event.pointerId);
      document.body.style.cursor = "grabbing";
      document.body.style.userSelect = "none";
      if ("vibrate" in navigator) navigator.vibrate(8);
    },
    onPointerMove(event: ReactPointerEvent<HTMLElement>) {
      const sourceId = activeRef.current;
      if (!sourceId) return;
      event.preventDefault();
      pointerRef.current = { x: event.clientX, y: event.clientY };
      updateDrag();
      if (autoScroll && scrollFrameRef.current === null) scrollFrameRef.current = window.requestAnimationFrame(scrollFrame);
    },
    onPointerUp(event: ReactPointerEvent<HTMLElement>) { finish(event); },
    onPointerCancel(event: ReactPointerEvent<HTMLElement>) { finish(event, true); },
    style: { touchAction: "none" as const },
  }), [autoScroll, finish, scrollFrame, updateDrag]);

  const itemStyle = useCallback((id: string): CSSProperties | undefined => activeId === id ? {
    transform: `translate3d(${offset.x}px, ${offset.y}px, 0) rotate(${Math.max(-1.5, Math.min(1.5, offset.x / 80))}deg)`,
    position: "relative",
    zIndex: 60,
    pointerEvents: "none",
    transition: "box-shadow 120ms ease, opacity 120ms ease",
    willChange: "transform",
  } : undefined, [activeId, offset]);

  return { activeId, targetId, bind, itemStyle };
}
