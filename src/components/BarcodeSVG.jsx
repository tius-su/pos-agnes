import React from 'react';

const CODE128_PATTERNS = [
  "212222","222122","222221","121223","121322","131222","122213","122312","132212","221213", // 0-9
  "221312","231212","112232","122132","122231","113222","123122","123221","223211","221132", // 10-19
  "221231","213212","223112","312131","311222","321122","321221","312212","322112","322211", // 20-29
  "212123","212321","232121","111323","131123","131321","112313","132113","132311","211313", // 30-39
  "231113","231311","112133","112331","132131","113123","113321","133121","313121","211331", // 40-49
  "231131","311123","311321","331121","312113","312311","332111","314111","221411","431111", // 50-59
  "111224","111422","121124","121421","141122","141221","112214","112412","142112","142211", // 60-69
  "241112","221114","411112","111124","111241","112114","112411","124111","115111","211141", // 70-79
  "411121","214111","211114","412111","111142","111241","114112","114211","411112","411211", // 80-89
  "211132","211331","311132","222113","221241","224111","212214","214212","411212","411131", // 90-99
  "241211","241112","134111","111242","121142","121241","2331112"                           // 100-106
];

export const encodeCode128B = (text) => {
  if (!text) return '';
  const clean = text.replace(/[^\x20-\x7E]/g, '');
  if (!clean) return '';

  const codes = [104]; // Start B
  let checksum = 104;

  for (let i = 0; i < clean.length; i++) {
    const code = clean.charCodeAt(i) - 32;
    codes.push(code);
    checksum += (i + 1) * code;
  }

  codes.push(checksum % 103);
  codes.push(106); // Stop Code

  return codes.map(c => CODE128_PATTERNS[c] || '').join('');
};

const BarcodeSVG = ({ text = 'AGNES-101', height = 45, widthModule = 2, showText = true }) => {
  const patternStr = encodeCode128B(text);
  if (!patternStr) return null;

  let totalWidth = 0;
  for (let i = 0; i < patternStr.length; i++) {
    totalWidth += parseInt(patternStr[i], 10) * widthModule;
  }

  const quietZone = 10 * widthModule;
  const svgWidth = totalWidth + (quietZone * 2);
  const svgHeight = height + (showText ? 18 : 4);

  let currentX = quietZone;
  const rects = [];

  for (let i = 0; i < patternStr.length; i++) {
    const width = parseInt(patternStr[i], 10) * widthModule;
    const isBar = i % 2 === 0;
    if (isBar) {
      rects.push(
        <rect
          key={i}
          x={currentX}
          y={2}
          width={width}
          height={height}
          fill="#000000"
        />
      );
    }
    currentX += width;
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
      style={{ display: 'block', maxWidth: '100%', height: 'auto', margin: '0 auto' }}
    >
      <rect x="0" y="0" width={svgWidth} height={svgHeight} fill="#ffffff" />
      {rects}
      {showText && (
        <text
          x={svgWidth / 2}
          y={height + 14}
          textAnchor="middle"
          fontSize="11"
          fontWeight="bold"
          fontFamily="monospace"
          fill="#000000"
        >
          {text}
        </text>
      )}
    </svg>
  );
};

export default BarcodeSVG;
