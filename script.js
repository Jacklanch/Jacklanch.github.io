const _e = 'amFja2xhbmNoZXN0ZXIyN0BnbWFpbC5jb20=';
const emailCard = document.getElementById('emailCard');
const emailValue = document.getElementById('emailValue');

emailCard.addEventListener('click', (e) => {
  e.preventDefault();
  const decoded = atob(_e);
  navigator.clipboard.writeText(decoded).then(() => {
    emailValue.textContent = 'Copied!';
    setTimeout(() => { emailValue.textContent = 'Click to copy'; }, 2000);
  });
});

// ===== Mobile nav toggle =====
const navToggle = document.getElementById('navToggle');
const navLinks = document.getElementById('navLinks');

navToggle.addEventListener('click', () => {
  navLinks.classList.toggle('open');
});

navLinks.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    navLinks.classList.remove('open');
  });
});

// ===== Interactive Graph (Obsidian-style) =====
(function () {
  const canvas = document.getElementById('graphCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  // --- Config ---
  const NODE_COUNT = 120;
  const EDGE_PROBABILITY = 0.025;
  const NODE_RADIUS = 3;
  // Color per cluster (10 clusters): 3 yellow, 2 red, 3 green, 2 blue
  const CLUSTER_COLORS = [
    { color: 'rgba(255, 230, 0, 0.6)',  bright: 'rgba(255, 230, 0, 0.9)'  },  // yellow
    { color: 'rgba(255, 230, 0, 0.6)',  bright: 'rgba(255, 230, 0, 0.9)'  },  // yellow
    { color: 'rgba(255, 230, 0, 0.6)',  bright: 'rgba(255, 230, 0, 0.9)'  },  // yellow
    { color: 'rgba(239, 68, 68, 0.6)',  bright: 'rgba(239, 68, 68, 0.9)'  },  // red
    { color: 'rgba(239, 68, 68, 0.6)',  bright: 'rgba(239, 68, 68, 0.9)'  },  // red
    { color: 'rgba(34, 197, 94, 0.6)',  bright: 'rgba(34, 197, 94, 0.9)'  },  // green
    { color: 'rgba(34, 197, 94, 0.6)',  bright: 'rgba(34, 197, 94, 0.9)'  },  // green
    { color: 'rgba(34, 197, 94, 0.6)',  bright: 'rgba(34, 197, 94, 0.9)'  },  // green
    { color: 'rgba(129, 140, 248, 0.6)', bright: 'rgba(129, 140, 248, 0.9)' },  // blue
    { color: 'rgba(129, 140, 248, 0.6)', bright: 'rgba(129, 140, 248, 0.9)' },  // blue
  ];
  const EDGE_COLOR = 'rgba(129, 140, 248, 0.15)';
  const EDGE_COLOR_HOVER = 'rgba(129, 140, 248, 0.35)';
  const CENTER_REPULSION_RADIUS = 180;
  const CENTER_REPULSION_STRENGTH = 2.5;
  const INTRA_LINK_DISTANCE = 50;       // short springs within clusters
  const INTRA_ATTRACTION = 0.008;
  const INTER_LINK_DISTANCE = 250;      // long loose springs between clusters
  const INTER_ATTRACTION = 0.0005;
  const REPULSION_STRENGTH = 400;
  const DAMPING = 0.92;
  const GRAVITY = 0.0008;

  let width, height, centerX, centerY;
  let nodes = [];
  let edges = [];
  let dragNode = null;
  let hoveredNode = null;
  let mouse = { x: 0, y: 0 };
  let animId;

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.parentElement.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    centerX = width / 2;
    centerY = height / 2;
  }

  function initGraph() {
    nodes = [];
    edges = [];

    // --- Cluster layout ---
    // 8-12 clusters, each with a handful of tightly-connected nodes
    const CLUSTER_COUNT = 10;
    const nodesPerCluster = Math.floor(NODE_COUNT / CLUSTER_COUNT);
    const remainder = NODE_COUNT - nodesPerCluster * CLUSTER_COUNT;

    // Pick cluster center positions spread around the canvas (avoid dead center)
    const clusterCenters = [];
    const margin = 120;
    const angleStep = (Math.PI * 2) / CLUSTER_COUNT;
    for (let c = 0; c < CLUSTER_COUNT; c++) {
      const angle = angleStep * c + (Math.random() - 0.5) * 0.6;
      const minR = CENTER_REPULSION_RADIUS + 60;
      const maxR = Math.min(width, height) * 0.38;
      const r = minR + Math.random() * (maxR - minR);
      clusterCenters.push({
        x: centerX + Math.cos(angle) * r,
        y: centerY + Math.sin(angle) * r
      });
    }

    // Shuffle cluster color order so same colors aren't always adjacent
    const shuffledColors = [...CLUSTER_COLORS];
    for (let i = shuffledColors.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledColors[i], shuffledColors[j]] = [shuffledColors[j], shuffledColors[i]];
    }

    // Create nodes, grouped by cluster
    let nodeIndex = 0;
    const clusterRanges = []; // [startIdx, endIdx) per cluster
    for (let c = 0; c < CLUSTER_COUNT; c++) {
      const count = nodesPerCluster + (c < remainder ? 1 : 0);
      const start = nodeIndex;
      const spread = 60 + Math.random() * 40;
      const clusterColor = shuffledColors[c];

      for (let n = 0; n < count; n++) {
        const angle = Math.random() * Math.PI * 2;
        const r = Math.random() * spread;
        const x = clusterCenters[c].x + Math.cos(angle) * r;
        const y = clusterCenters[c].y + Math.sin(angle) * r;

        nodes.push({
          x, y,
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.3,
          radius: NODE_RADIUS + Math.random() * 2,
          pinned: false,
          cluster: c,
          color: clusterColor.color,
          bright: clusterColor.bright
        });
        nodeIndex++;
      }
      clusterRanges.push({ start, end: nodeIndex });
    }

    // --- Intra-cluster edges (dense) ---
    // Connect each node to 2-4 nearby nodes within its cluster
    for (let c = 0; c < CLUSTER_COUNT; c++) {
      const { start, end } = clusterRanges[c];
      const clusterSize = end - start;

      // First build a spanning chain so the cluster is connected
      for (let i = start; i < end - 1; i++) {
        edges.push({ a: i, b: i + 1, intra: true });
      }

      // Then add extra intra-cluster edges for density
      for (let i = start; i < end; i++) {
        const extras = 1 + Math.floor(Math.random() * 2);
        for (let e = 0; e < extras; e++) {
          const j = start + Math.floor(Math.random() * clusterSize);
          if (j !== i && !edges.some(edge =>
            (edge.a === Math.min(i, j) && edge.b === Math.max(i, j))
          )) {
            edges.push({ a: Math.min(i, j), b: Math.max(i, j), intra: true });
          }
        }
      }
    }

    // --- Inter-cluster bridges (sparse) ---
    // 1-2 connections between neighboring clusters
    for (let c = 0; c < CLUSTER_COUNT; c++) {
      const bridgeCount = 1 + Math.floor(Math.random() * 2);
      for (let b = 0; b < bridgeCount; b++) {
        const target = (c + 1 + Math.floor(Math.random() * 3)) % CLUSTER_COUNT;
        const { start: s1, end: e1 } = clusterRanges[c];
        const { start: s2, end: e2 } = clusterRanges[target];
        const i = s1 + Math.floor(Math.random() * (e1 - s1));
        const j = s2 + Math.floor(Math.random() * (e2 - s2));
        edges.push({ a: Math.min(i, j), b: Math.max(i, j), intra: false });
      }
    }
  }

  function simulate() {
    // Node-node repulsion
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[j].x - nodes[i].x;
        const dy = nodes[j].y - nodes[i].y;
        const dist = Math.max(Math.hypot(dx, dy), 1);
        const force = REPULSION_STRENGTH / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        if (!nodes[i].pinned) { nodes[i].vx -= fx; nodes[i].vy -= fy; }
        if (!nodes[j].pinned) { nodes[j].vx += fx; nodes[j].vy += fy; }
      }
    }

    // Edge attraction (spring) — different strength for intra vs inter cluster
    for (const edge of edges) {
      const a = nodes[edge.a];
      const b = nodes[edge.b];
      const linkDist = edge.intra ? INTRA_LINK_DISTANCE : INTER_LINK_DISTANCE;
      const strength = edge.intra ? INTRA_ATTRACTION : INTER_ATTRACTION;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.max(Math.hypot(dx, dy), 1);
      const displacement = dist - linkDist;
      const force = displacement * strength;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      if (!a.pinned) { a.vx += fx; a.vy += fy; }
      if (!b.pinned) { b.vx -= fx; b.vy -= fy; }
    }

    // Center repulsion (clear the middle for the title)
    for (const node of nodes) {
      if (node.pinned) continue;
      const dx = node.x - centerX;
      const dy = node.y - centerY;
      const dist = Math.max(Math.hypot(dx, dy), 1);
      if (dist < CENTER_REPULSION_RADIUS) {
        const force = CENTER_REPULSION_STRENGTH * (1 - dist / CENTER_REPULSION_RADIUS);
        node.vx += (dx / dist) * force;
        node.vy += (dy / dist) * force;
      }
    }

    // Gravity toward center (keeps graph from drifting off-screen)
    for (const node of nodes) {
      if (node.pinned) continue;
      node.vx += (centerX - node.x) * GRAVITY;
      node.vy += (centerY - node.y) * GRAVITY;
    }

    // Integrate velocity
    for (const node of nodes) {
      if (node.pinned) continue;
      node.vx *= DAMPING;
      node.vy *= DAMPING;
      node.x += node.vx;
      node.y += node.vy;

      // Soft boundary
      const margin = 20;
      if (node.x < margin) { node.x = margin; node.vx *= -0.5; }
      if (node.x > width - margin) { node.x = width - margin; node.vx *= -0.5; }
      if (node.y < margin) { node.y = margin; node.vy *= -0.5; }
      if (node.y > height - margin) { node.y = height - margin; node.vy *= -0.5; }
    }
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);

    // Find hovered node's connected nodes
    const connectedToHover = new Set();
    if (hoveredNode !== null) {
      connectedToHover.add(hoveredNode);
      for (const edge of edges) {
        if (edge.a === hoveredNode) connectedToHover.add(edge.b);
        if (edge.b === hoveredNode) connectedToHover.add(edge.a);
      }
    }

    // Draw edges
    for (const edge of edges) {
      const a = nodes[edge.a];
      const b = nodes[edge.b];
      const isHighlighted = hoveredNode !== null &&
        (edge.a === hoveredNode || edge.b === hoveredNode);

      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = isHighlighted ? EDGE_COLOR_HOVER : EDGE_COLOR;
      ctx.lineWidth = isHighlighted ? 1.5 : 0.5;
      ctx.stroke();
    }

    // Draw nodes
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const isConnected = connectedToHover.has(i);
      const isHovered = i === hoveredNode;

      ctx.beginPath();
      ctx.arc(node.x, node.y, isHovered ? node.radius + 2 : node.radius, 0, Math.PI * 2);
      ctx.fillStyle = isConnected ? node.bright : node.color;
      ctx.fill();

      // Glow on hovered node
      if (isHovered) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius + 8, 0, Math.PI * 2);
        ctx.fillStyle = node.bright.replace(/[\d.]+\)$/, '0.15)');
        ctx.fill();
      }
    }
  }

  function loop() {
    simulate();
    draw();
    animId = requestAnimationFrame(loop);
  }

  // --- Mouse interaction ---
  function getNodeAt(x, y) {
    for (let i = nodes.length - 1; i >= 0; i--) {
      const d = Math.hypot(x - nodes[i].x, y - nodes[i].y);
      if (d < nodes[i].radius + 10) return i;
    }
    return null;
  }

  function getMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }

  canvas.addEventListener('mousemove', (e) => {
    const pos = getMousePos(e);
    mouse = pos;

    if (dragNode !== null) {
      nodes[dragNode].x = pos.x;
      nodes[dragNode].y = pos.y;
      nodes[dragNode].vx = 0;
      nodes[dragNode].vy = 0;
    }

    hoveredNode = getNodeAt(pos.x, pos.y);
    canvas.style.cursor = hoveredNode !== null ? 'grab' : 'default';
  });

  canvas.addEventListener('mousedown', (e) => {
    const pos = getMousePos(e);
    const idx = getNodeAt(pos.x, pos.y);
    if (idx !== null) {
      dragNode = idx;
      nodes[idx].pinned = true;
      canvas.style.cursor = 'grabbing';
    }
  });

  canvas.addEventListener('mouseup', () => {
    if (dragNode !== null) {
      nodes[dragNode].pinned = false;
      canvas.style.cursor = hoveredNode !== null ? 'grab' : 'default';
    }
    dragNode = null;
  });

  canvas.addEventListener('mouseleave', () => {
    if (dragNode !== null) {
      nodes[dragNode].pinned = false;
    }
    dragNode = null;
    hoveredNode = null;
  });

  // Touch support
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const pos = getMousePos(touch);
    const idx = getNodeAt(pos.x, pos.y);
    if (idx !== null) {
      dragNode = idx;
      nodes[idx].pinned = true;
    }
  }, { passive: false });

  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (dragNode !== null) {
      const touch = e.touches[0];
      const pos = getMousePos(touch);
      nodes[dragNode].x = pos.x;
      nodes[dragNode].y = pos.y;
      nodes[dragNode].vx = 0;
      nodes[dragNode].vy = 0;
    }
  }, { passive: false });

  canvas.addEventListener('touchend', () => {
    if (dragNode !== null) {
      nodes[dragNode].pinned = false;
    }
    dragNode = null;
  });

  // --- Init ---
  resize();
  initGraph();
  loop();

  window.addEventListener('resize', () => {
    resize();
    // Re-center the repulsion zone
    centerX = width / 2;
    centerY = height / 2;
  });
})();

// ===== Scroll-triggered fade-in animations =====
const observerOptions = { threshold: 0.1, rootMargin: '0px 0px -40px 0px' };

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
}, observerOptions);

document.querySelectorAll('.section, .project-card, .detail-card, .skill-category, .contact-card').forEach(el => {
  el.classList.add('fade-in');
  observer.observe(el);
});

// ===== Active nav link highlighting on scroll =====
const sections = document.querySelectorAll('.section[id]');

window.addEventListener('scroll', () => {
  const scrollY = window.scrollY + 100;
  sections.forEach(section => {
    const top = section.offsetTop;
    const height = section.offsetHeight;
    const id = section.getAttribute('id');
    const link = document.querySelector(`.nav-links a[href="#${id}"]`);
    if (link) {
      if (scrollY >= top && scrollY < top + height) {
        link.style.color = 'var(--accent-light)';
        link.style.background = 'var(--surface)';
      } else {
        link.style.color = '';
        link.style.background = '';
      }
    }
  });
});
