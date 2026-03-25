function escapeCsv(value) {
  if (value === null || value === undefined) return '';
  const text = String(value).replaceAll('"', '""');
  if (/[",\n]/.test(text)) return `"${text}"`;
  return text;
}

export function downloadCsv(filename, headers, rows) {
  const csv = [headers.join(',')]
    .concat(rows.map((row) => row.map((cell) => escapeCsv(cell)).join(',')))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
