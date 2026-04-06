// Client-side invoice PDF generation using jsPDF
// Runs entirely in the browser — no server endpoint needed.

export interface InvoiceOrder {
  id: string
  status: string
  created_at: string
  subtotal: number
  tax: number
  shipping: number
  total: number
  tracking_number?: string | null
  coupon_code?: string | null
  discount_amount?: number | null
  shipping_address: {
    name?: string
    full_name?: string
    line1?: string
    line2?: string
    city?: string
    state?: string
    pincode?: string
    zip?: string
    phone?: string
  }
  order_items: Array<{
    id: string
    quantity: number
    unit_price: number
    total: number
    snapshot?: { name?: string; sku?: string } | null
    products?: { name?: string } | null
  }>
  customer?: {
    full_name?: string
    email?: string
    phone?: string
  } | null
}

function fmt(n: number) {
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export async function downloadInvoicePDF(order: InvoiceOrder) {
  // Dynamic import so jsPDF doesn't bloat the initial bundle
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const orderId = order.id.slice(0, 8).toUpperCase()
  const addr = order.shipping_address ?? {}
  const addrName = addr.name ?? addr.full_name ?? ''

  // ── Header ───────────────────────────────────────────────
  doc.setFillColor(15, 15, 15)
  doc.rect(0, 0, pageW, 28, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('STORE', 14, 12)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text('support@aitalk247.com  |  orders@aitalk247.com', 14, 18)
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text('INVOICE', pageW - 14, 17, { align: 'right' })

  // ── Invoice meta ────────────────────────────────────────
  doc.setTextColor(30, 30, 30)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')

  const metaY = 36
  doc.setFont('helvetica', 'bold')
  doc.text('Invoice No:', 14, metaY)
  doc.setFont('helvetica', 'normal')
  doc.text(`#${orderId}`, 42, metaY)

  doc.setFont('helvetica', 'bold')
  doc.text('Date:', 14, metaY + 6)
  doc.setFont('helvetica', 'normal')
  doc.text(new Date(order.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' }), 42, metaY + 6)

  doc.setFont('helvetica', 'bold')
  doc.text('Status:', 14, metaY + 12)
  doc.setFont('helvetica', 'normal')
  doc.text(order.status.toUpperCase(), 42, metaY + 12)

  if (order.tracking_number) {
    doc.setFont('helvetica', 'bold')
    doc.text('Tracking:', 14, metaY + 18)
    doc.setFont('helvetica', 'normal')
    doc.text(order.tracking_number, 42, metaY + 18)
  }

  // ── Billing / Shipping address ───────────────────────────
  const addrX = pageW - 80
  doc.setFont('helvetica', 'bold')
  doc.text('Deliver To:', addrX, metaY)
  doc.setFont('helvetica', 'normal')
  const addrLines = [
    addrName,
    addr.line1,
    addr.line2,
    [addr.city, addr.state].filter(Boolean).join(', '),
    addr.pincode ?? addr.zip,
    addr.phone,
  ].filter(Boolean) as string[]

  addrLines.forEach((line, i) => {
    doc.text(line, addrX, metaY + 6 + i * 5)
  })

  // Customer info
  if (order.customer?.email) {
    const custY = metaY + 6 + addrLines.length * 5 + 3
    doc.setFont('helvetica', 'bold')
    doc.text('Customer:', addrX, custY)
    doc.setFont('helvetica', 'normal')
    doc.text(order.customer.full_name ?? '', addrX, custY + 5)
    doc.text(order.customer.email, addrX, custY + 10)
  }

  // ── Items table ─────────────────────────────────────────
  const tableY = metaY + (order.tracking_number ? 26 : 20)

  autoTable(doc, {
    startY: tableY + 4,
    head: [['#', 'Product', 'SKU', 'Qty', 'Unit Price', 'Total']],
    body: order.order_items.map((item, i) => [
      i + 1,
      item.snapshot?.name ?? item.products?.name ?? '—',
      item.snapshot?.sku ?? '—',
      item.quantity,
      fmt(item.unit_price),
      fmt(item.total),
    ]),
    headStyles: { fillColor: [15, 15, 15], textColor: 255, fontSize: 9, fontStyle: 'bold' },
    bodyStyles: { fontSize: 9, textColor: [40, 40, 40] },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 70 },
      2: { cellWidth: 28 },
      3: { cellWidth: 12, halign: 'center' },
      4: { cellWidth: 28, halign: 'right' },
      5: { cellWidth: 28, halign: 'right' },
    },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    margin: { left: 14, right: 14 },
  })

  // ── Totals ───────────────────────────────────────────────
  const finalY = (doc as any).lastAutoTable.finalY + 6
  const totalsX = pageW - 75
  const lineH = 7

  function totRow(label: string, value: string, bold = false, y = 0) {
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(bold ? 10 : 9)
    doc.text(label, totalsX, y)
    doc.text(value, pageW - 14, y, { align: 'right' })
  }

  let ty = finalY
  totRow('Subtotal', fmt(order.subtotal), false, ty)
  ty += lineH
  if (order.discount_amount && order.discount_amount > 0) {
    const label = order.coupon_code ? `Coupon (${order.coupon_code})` : 'Discount'
    doc.setTextColor(22, 163, 74)
    totRow(label, `- ${fmt(order.discount_amount)}`, false, ty)
    doc.setTextColor(30, 30, 30)
    ty += lineH
  }
  totRow('Shipping', order.shipping > 0 ? fmt(order.shipping) : 'Free', false, ty)
  ty += lineH
  totRow('Tax', fmt(order.tax), false, ty)
  ty += lineH

  // Divider
  doc.setDrawColor(200, 200, 200)
  doc.line(totalsX, ty, pageW - 14, ty)
  ty += 5

  totRow('TOTAL', fmt(order.total), true, ty)

  // ── Footer ───────────────────────────────────────────────
  const footerY = doc.internal.pageSize.getHeight() - 16
  doc.setDrawColor(220, 220, 220)
  doc.line(14, footerY - 4, pageW - 14, footerY - 4)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(130, 130, 130)
  doc.text('Thank you for shopping with us!', 14, footerY)
  doc.text('Returns accepted within 30 days — see store.com/refund-policy', 14, footerY + 5)
  doc.text(`Generated on ${new Date().toLocaleString('en-US')}`, pageW - 14, footerY, { align: 'right' })

  doc.save(`invoice-${orderId}.pdf`)
}
