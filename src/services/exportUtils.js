// Utility for exporting data tables to Excel-compatible CSV and HTML printable reports

export const exportToCSV = (filename, headers, rows) => {
  if (!rows || !rows.length) return;
  const processRow = (row) =>
    row.map(val => {
      let result = val === null || val === undefined ? '' : String(val);
      result = result.replace(/"/g, '""');
      if (result.search(/("|,|\n)/g) >= 0) {
        result = `"${result}"`;
      }
      return result;
    }).join(',');

  let csvContent = '\uFEFF'; // UTF-8 BOM for Excel compatibility
  csvContent += headers.join(',') + '\r\n';
  rows.forEach(r => {
    csvContent += processRow(r) + '\r\n';
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const printReportHTML = (title, subtitle, tableHtml) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; color: #1e293b; }
          .header { text-align: center; margin-bottom: 24px; border-bottom: 2px solid #7c3aed; padding-bottom: 12px; }
          .header h1 { margin: 0 0 6px 0; color: #7c3aed; font-size: 22px; text-transform: uppercase; }
          .header p { margin: 0; color: #64748b; font-size: 13px; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px; }
          th, td { border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; }
          th { background-color: #f1f5f9; color: #334155; font-weight: bold; text-transform: uppercase; font-size: 11px; }
          tr:nth-child(even) { background-color: #f8fafc; }
          .text-right { text-align: right; }
          .bold { font-weight: bold; }
          @media print {
            body { padding: 0; }
            button { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${title}</h1>
          <p>${subtitle} · Dicetak pada ${new Date().toLocaleString('id-ID')}</p>
        </div>
        ${tableHtml}
        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
};
