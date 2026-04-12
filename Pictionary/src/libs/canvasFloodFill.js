export function floodFillImageData(imageData, width, height, sx, sy, fr, fg, fb, tolerance = 14) {
  const data = imageData.data;
  if (sx < 0 || sx >= width || sy < 0 || sy >= height) {
    return false;
  }

  const start = (sy * width + sx) * 4;
  const tr = data[start];
  const tg = data[start + 1];
  const tb = data[start + 2];
  const ta = data[start + 3];

  if (nearRgb(tr, tg, tb, ta, fr, fg, fb, 255, tolerance)) {
    return false;
  }

  const stack = [[sx, sy]];
  const seen = new Uint8Array(width * height);
  let filled = 0;

  function matchAt(i) {
    return nearRgb(
      data[i],
      data[i + 1],
      data[i + 2],
      data[i + 3],
      tr,
      tg,
      tb,
      ta,
      tolerance,
    );
  }

  while (stack.length > 0) {
    const [x, y] = stack.pop();
    if (x < 0 || x >= width || y < 0 || y >= height) {
      continue;
    }
    const pi = y * width + x;
    if (seen[pi]) {
      continue;
    }
    const i = pi * 4;
    if (!matchAt(i)) {
      continue;
    }
    seen[pi] = 1;
    data[i] = fr;
    data[i + 1] = fg;
    data[i + 2] = fb;
    data[i + 3] = 255;
    filled += 1;
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }

  return filled > 0;
}

function nearRgb(r1, g1, b1, a1, r2, g2, b2, a2, tol) {
  return (
    Math.abs(r1 - r2) <= tol &&
    Math.abs(g1 - g2) <= tol &&
    Math.abs(b1 - b2) <= tol &&
    Math.abs(a1 - a2) <= tol
  );
}

export function hexToRgb(hex) {
  if (typeof hex !== 'string') {
    return { r: 0, g: 0, b: 0 };
  }
  let h = hex.replace(/^#/, '');
  if (h.length === 3) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  }
  const m = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h);
  if (!m) {
    return { r: 0, g: 0, b: 0 };
  }
  return {
    r: parseInt(m[1], 16),
    g: parseInt(m[2], 16),
    b: parseInt(m[3], 16),
  };
}
