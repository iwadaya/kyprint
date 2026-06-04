// Stroke icon paths (24x24). Rendered by the Icon component.
export const ICONS = {
  dash: 'M3 13h8V3H3zM13 21h8V8h-8zM13 3v3h8V3zM3 21h8v-6H3z',
  orders: 'M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11',
  quote: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M16 13H8M16 17H8',
  invoice: 'M14 2H6a2 2 0 00-2 2v16l4-2 4 2 4-2V8zM14 2v6h6M9 9h1M9 13h6M9 17h6',
  pay: 'M2 7h20v12a2 2 0 01-2 2H4a2 2 0 01-2-2zM2 7l2-4h16l2 4M2 11h20',
  proof: 'M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7M12 9a3 3 0 100 6 3 3 0 000-6',
  stock: 'M21 16V8a2 2 0 00-1-1.7l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.7l7 4a2 2 0 002 0l7-4A2 2 0 0021 16M3.3 7L12 12l8.7-5M12 22V12',
  deliv: 'M1 3h15v13H1zM16 8h4l3 3v5h-7M5.5 21a2.5 2.5 0 100-5 2.5 2.5 0 000 5M18.5 21a2.5 2.5 0 100-5 2.5 2.5 0 000 5',
  whatsapp: 'M21 11.5a8.4 8.4 0 01-12 7.6L3 21l1.9-6A8.5 8.5 0 1121 11.5z',
  remind: 'M13 2L3 14h7l-1 8 10-12h-7z',
  cust: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8M23 21v-2a4 4 0 00-3-3.9M16 3.1a4 4 0 010 7.8',
  portal: 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2zM9 22V12h6v10',
  access: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM9 12l2 2 4-4'
};

export const Icon = ({ d, size = 17, className = 'ic' }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);
