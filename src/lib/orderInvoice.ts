import { jsPDF } from 'jspdf';

export type OrderInvoiceData = {
  orderNumber: string;
  orderId: string;
  createdAt?: string;
  paymentStatus?: string;
  paymentMethod?: string;
  shippingAddress?: Record<string, unknown> | null;
  items: Array<{
    name: string;
    quantity: number;
    pricePerUnit: number;
    subtotal: number;
  }>;
  subtotal: number;
  discountAmount: number;
  shippingFee: number;
  taxAmount: number;
  platformFee: number;
  total: number;
};

export function formatShippingAddress(addr: Record<string, unknown> | null | undefined): string {
  if (!addr || typeof addr !== 'object') return '—';
  const a = addr as Record<string, string | undefined>;
  const line = [
    a.flatHouse,
    a.address || a.addressLine1,
    a.addressLine2,
    [a.city, a.state].filter(Boolean).join(', '),
    a.zipCode || a.pincode,
  ]
    .filter((v) => typeof v === 'string' && v.trim())
    .join(', ');
  return line || '—';
}

export function mapApiOrderToInvoice(api: any): OrderInvoiceData {
  const items = (api.items || []).map((i: any) => ({
    name: i.product?.name ?? 'Product',
    quantity: Number(i.quantity ?? 0),
    pricePerUnit: Number(i.pricePerUnit ?? 0),
    subtotal: Number(i.subtotal ?? Number(i.pricePerUnit ?? 0) * Number(i.quantity ?? 0)),
  }));
  const subtotal = items.reduce((s, i) => s + i.subtotal, 0);
  const total = Number(api.payableAmount ?? api.totalAmount ?? subtotal);
  return {
    orderNumber: String(api.orderNumber ?? api.id ?? '—'),
    orderId: String(api.id ?? ''),
    createdAt: api.createdAt,
    paymentStatus: api.paymentStatus,
    paymentMethod: api.paymentMethod,
    shippingAddress: api.shippingAddress ?? null,
    items,
    subtotal,
    discountAmount: Number(api.discountAmount ?? 0),
    shippingFee: Number(api.shippingFee ?? 0),
    taxAmount: Number(api.taxAmount ?? 0),
    platformFee: Number(api.platformFee ?? 0),
    total,
  };
}

function inr(n: number): string {
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function downloadOrderInvoicePdf(invoice: OrderInvoiceData): void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const margin = 48;
  let y = margin;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('The Fruit Tribe', margin, y);
  y += 22;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('Tax Invoice / Bill', margin, y);
  y += 28;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(`Order #${invoice.orderNumber}`, margin, y);
  y += 14;
  doc.setFont('helvetica', 'normal');
  if (invoice.createdAt) {
    doc.text(`Date: ${new Date(invoice.createdAt).toLocaleString('en-IN')}`, margin, y);
    y += 14;
  }
  const payStatus = String(invoice.paymentStatus ?? 'PENDING').toUpperCase();
  doc.text(`Payment: ${payStatus}${invoice.paymentMethod ? ` (${invoice.paymentMethod})` : ''}`, margin, y);
  y += 14;
  doc.text(`Deliver to: ${formatShippingAddress(invoice.shippingAddress)}`, margin, y, { maxWidth: 500 });
  y += 28;

  doc.setFont('helvetica', 'bold');
  doc.text('Item', margin, y);
  doc.text('Qty', margin + 280, y);
  doc.text('Rate', margin + 330, y);
  doc.text('Amount', margin + 400, y);
  y += 10;
  doc.setLineWidth(0.5);
  doc.line(margin, y, 545, y);
  y += 16;

  doc.setFont('helvetica', 'normal');
  for (const item of invoice.items) {
    if (y > 720) {
      doc.addPage();
      y = margin;
    }
    const name = item.name.length > 42 ? `${item.name.slice(0, 39)}…` : item.name;
    doc.text(name, margin, y);
    doc.text(String(item.quantity), margin + 280, y);
    doc.text(inr(item.pricePerUnit), margin + 330, y);
    doc.text(inr(item.subtotal), margin + 400, y);
    y += 18;
  }

  y += 8;
  doc.line(margin, y, 545, y);
  y += 18;

  const summary: Array<[string, number]> = [
    ['Subtotal', invoice.subtotal],
  ];
  if (invoice.discountAmount > 0) summary.push(['Discount', -invoice.discountAmount]);
  if (invoice.shippingFee > 0) summary.push(['Delivery', invoice.shippingFee]);
  if (invoice.taxAmount > 0) summary.push(['Tax', invoice.taxAmount]);
  if (invoice.platformFee > 0) summary.push(['Platform fee', invoice.platformFee]);
  summary.push(['Total', invoice.total]);

  for (const [label, amount] of summary) {
    const isTotal = label === 'Total';
    doc.setFont('helvetica', isTotal ? 'bold' : 'normal');
    doc.text(label, margin + 300, y);
    doc.text(inr(Math.abs(amount)), margin + 400, y);
    y += isTotal ? 20 : 16;
  }

  y += 12;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.text('Thank you for shopping with The Fruit Tribe.', margin, y);

  doc.save(`invoice-${invoice.orderNumber}.pdf`);
}
