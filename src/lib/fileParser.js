import Papa from 'papaparse';
import * as XLSX from 'xlsx';

// UCI Adult dataset columns — the .data file has no header row
const UCI_ADULT_COLUMNS = [
  'age', 'workclass', 'fnlwgt', 'education', 'education-num',
  'marital-status', 'occupation', 'relationship', 'race', 'sex',
  'capital-gain', 'capital-loss', 'hours-per-week', 'native-country', 'income',
];

function isHeaderless(firstRow) {
  // If the first row's values look like data (numbers, known UCI values), it has no header
  if (!firstRow || firstRow.length === 0) return false;
  const first = String(firstRow[0]).trim();
  // If the first cell is a number, this is almost certainly a data row, not a header
  return !Number.isNaN(Number(first));
}

function applyHeaders(rows, columns) {
  return rows.map((row) => {
    const obj = {};
    columns.forEach((col, i) => {
      obj[col] = row[i] != null ? String(row[i]).trim() : '';
    });
    return obj;
  });
}

export function parseFile(file) {
  return new Promise((resolve, reject) => {
    const ext = file.name.split('.').pop().toLowerCase();

    if (ext === 'csv' || ext === 'data' || ext === 'txt') {
      Papa.parse(file, {
        header: false,       // parse raw arrays first so we can detect headers
        skipEmptyLines: true,
        complete: (results) => {
          const rows = results.data;
          if (!rows.length) {
            resolve({ data: [], columns: [] });
            return;
          }

          const headerless = isHeaderless(rows[0]);

          if (headerless) {
            // Use UCI Adult column names if column count matches, otherwise generate Col_1, Col_2...
            const colCount = rows[0].length;
            const columns = colCount === UCI_ADULT_COLUMNS.length
              ? UCI_ADULT_COLUMNS
              : rows[0].map((_, i) => `Col_${i + 1}`);
            const data = applyHeaders(rows, columns);
            resolve({ data, columns });
          } else {
            // First row is the header
            const columns = rows[0].map((h) => String(h).trim());
            const data = applyHeaders(rows.slice(1), columns);
            resolve({ data, columns });
          }
        },
        error: (err) => reject(err),
      });
    } else if (ext === 'json') {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = JSON.parse(e.target.result);
        const rows = Array.isArray(data) ? data : [data];
        const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
        resolve({ data: rows, columns });
      };
      reader.onerror = reject;
      reader.readAsText(file);
    } else if (['xlsx', 'xls'].includes(ext)) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const wb = XLSX.read(e.target.result, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(sheet);
        const columns = data.length > 0 ? Object.keys(data[0]) : [];
        resolve({ data, columns });
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    } else {
      reject(new Error(`Unsupported file type: .${ext}`));
    }
  });
}
