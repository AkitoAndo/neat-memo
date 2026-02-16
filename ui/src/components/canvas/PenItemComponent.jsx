import { useRef, useEffect } from 'react';

export default function PenItemComponent({ item, onPathAdded }) {
  const svgRef = useRef(null);
  const drawingRef = useRef({ isDrawing: false, currentPath: [], currentPathEl: null });

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    function getLocalCoords(e) {
      const rect = svg.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    function onMouseDown(e) {
      if (e.target.closest('.item-header') || e.target.closest('.item-resize-handle')) return;

      const state = drawingRef.current;
      state.isDrawing = true;
      state.currentPath = [getLocalCoords(e)];

      const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      pathEl.setAttribute('stroke', item.color);
      pathEl.setAttribute('stroke-width', item.strokeWidth);
      pathEl.setAttribute('fill', 'none');
      pathEl.setAttribute('stroke-linecap', 'round');
      pathEl.setAttribute('stroke-linejoin', 'round');
      svg.appendChild(pathEl);
      state.currentPathEl = pathEl;
    }

    function onMouseMove(e) {
      const state = drawingRef.current;
      if (!state.isDrawing || !state.currentPathEl) return;

      const coords = getLocalCoords(e);
      state.currentPath.push(coords);

      const d = item.pathToSvgD(state.currentPath);
      state.currentPathEl.setAttribute('d', d);
    }

    function onMouseUp() {
      const state = drawingRef.current;
      if (!state.isDrawing) return;

      if (state.currentPath.length > 1) {
        item.addPath(state.currentPath, item.color, item.strokeWidth);
        if (onPathAdded) onPathAdded();
      }

      state.isDrawing = false;
      state.currentPath = [];
      state.currentPathEl = null;
    }

    svg.addEventListener('mousedown', onMouseDown);
    svg.addEventListener('mousemove', onMouseMove);
    svg.addEventListener('mouseup', onMouseUp);
    svg.addEventListener('mouseleave', onMouseUp);

    return () => {
      svg.removeEventListener('mousedown', onMouseDown);
      svg.removeEventListener('mousemove', onMouseMove);
      svg.removeEventListener('mouseup', onMouseUp);
      svg.removeEventListener('mouseleave', onMouseUp);
    };
  }, [item, onPathAdded]);

  return (
    <svg ref={svgRef} className="pen-canvas" width="100%" height="100%">
      {item.paths.map((path, i) => (
        <path
          key={i}
          d={item.pathToSvgD(path.points)}
          stroke={path.color || item.color}
          strokeWidth={path.width || item.strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}
