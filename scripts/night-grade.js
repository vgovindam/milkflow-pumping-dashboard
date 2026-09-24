/* The per-pixel night grade. Runs inside the browser; see generate-dark-plates.mjs for why. */
function nightGrade(dataUrl, cfg){
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = () => reject(new Error('plate did not decode'));
    img.onload = () => {
      const w = img.naturalWidth, h = img.naturalHeight;
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const ctx = c.getContext('2d', {willReadFrequently: true});
      ctx.drawImage(img, 0, 0);
      const px = ctx.getImageData(0, 0, w, h), d = px.data;

      const [sr, sg, sb] = cfg.shadow, [mr, mg, mb] = cfg.mid, [hr, hg, hb] = cfg.high;
      const [nr, ng, nb] = cfg.moon, [mx, my] = cfg.moonAt;
      const moonX = mx * w, moonY = my * h, moonR = Math.max(w, h) * 0.55;

      for(let i = 0; i < d.length; i += 4){
        const r0 = d[i] / 255, g0 = d[i + 1] / 255, b0 = d[i + 2] / 255;
        /* Rec.709 luminance: a grade that uses a flat average turns foliage to sludge. */
        const lum = 0.2126 * r0 + 0.7152 * g0 + 0.0722 * b0;
        const t = Math.pow(lum, cfg.gamma) * cfg.exposure;

        /* Three-point ramp, so the dark has a hue of its own instead of being an absence. */
        let gr, gg, gb;
        if(t < 0.5){ const k = t / 0.5; gr = sr + (mr - sr) * k; gg = sg + (mg - sg) * k; gb = sb + (mb - sb) * k; }
        else { const k = (t - 0.5) / 0.5; gr = mr + (hr - mr) * k; gg = mg + (hg - mg) * k; gb = mb + (hb - mb) * k; }

        /* Blend the ramp against the dimmed original. This is the step that keeps a lion cub
           looking like a lion cub rather than a grey silhouette. */
        const keep = 1 - cfg.grade, e = cfg.exposure * 1.15;
        let R = gr * cfg.grade + r0 * 255 * e * keep;
        let G = gg * cfg.grade + g0 * 255 * e * keep;
        let B = gb * cfg.grade + b0 * 255 * e * keep;

        /* Every step above costs saturation, so put some back. */
        const gl = 0.2126 * R + 0.7152 * G + 0.0722 * B;
        R = gl + (R - gl) * cfg.chroma; G = gl + (G - gl) * cfg.chroma; B = gl + (B - gl) * cfg.chroma;

        d[i] = R < 0 ? 0 : R > 255 ? 255 : R;
        d[i + 1] = G < 0 ? 0 : G > 255 ? 255 : G;
        d[i + 2] = B < 0 ? 0 : B > 255 ? 255 : B;
      }
      ctx.putImageData(px, 0, 0);

      /* One soft light, off centre, so the scene has a direction to it. */
      const moon = ctx.createRadialGradient(moonX, moonY, 0, moonX, moonY, moonR);
      moon.addColorStop(0, `rgba(${nr},${ng},${nb},.30)`);
      moon.addColorStop(0.45, `rgba(${nr},${ng},${nb},.09)`);
      moon.addColorStop(1, `rgba(${nr},${ng},${nb},0)`);
      ctx.fillStyle = moon; ctx.fillRect(0, 0, w, h);

      /* And a little weight at the foot of the frame, where the cards stack up. */
      const floor = ctx.createLinearGradient(0, h * 0.55, 0, h);
      floor.addColorStop(0, 'rgba(0,0,0,0)');
      floor.addColorStop(1, `rgba(0,0,0,${cfg.floor ?? 0.24})`);
      ctx.fillStyle = floor; ctx.fillRect(0, 0, w, h);

      resolve(c.toDataURL('image/webp', 0.87));
    };
    img.src = dataUrl;
  });
}
