/**
 * Receipt & Invoice Printer Engine
 * 80mm Thermal Receipt & Traditional A4 Invoice Generator
 * Specifically crafted for: سەنگەر زمارەیی و جێگر زمارەیی
 */
import { formatCurrency, showToast } from './api.js';

/**
 * 80mm Thermal Receipt Generator
 */
export function renderReceipt80mm(saleData, settings = {}) {
  const items = saleData.items || [];
  const itemsHtml = items
    .map((it) => {
      const name = it.product_name || it.name || it.ProductName || '';
      const partNo = it.part_number || it.PartNumber || '';
      const qty = it.quantity || it.Quantity || 1;
      const unitPrice = it.unit_price != null ? it.unit_price : (it.UnitPrice != null ? it.UnitPrice : 0);
      const discount = it.discount != null ? it.discount : (it.Discount != null ? it.Discount : 0);
      const totalPrice = it.total_price != null ? it.total_price : (it.TotalPrice != null ? it.TotalPrice : (qty * unitPrice - discount));

      return `
      <tr>
        <td style="text-align: right; padding: 4px 0;">
          <div style="font-weight: 700;">${escapeHtml(name)}</div>
          ${partNo ? `<div style="font-size: 9px; color: #333; direction: ltr; text-align: right; unicode-bidi: isolate;">کۆد: ${escapeHtml(partNo)}</div>` : ''}
        </td>
        <td style="text-align: center; padding: 4px 0;">${qty}</td>
        <td style="text-align: center; padding: 4px 0;">${formatCurrency(unitPrice)}</td>
        <td style="text-align: left; font-weight: 700; padding: 4px 0;">${formatCurrency(totalPrice)}</td>
      </tr>
      `;
    })
    .join('');

  const paymentTypeLabels = {
    cash: 'نەقد',
    debt: 'قەرز',
    partial: 'نەقد + قەرز',
  };

  const pType = saleData.payment_type || saleData.paymentType || 'cash';
  const paymentLabel = paymentTypeLabels[pType] || 'نەقد';

  const receiptNum = saleData.receipt_number || saleData.receiptNumber || '';
  const saleDate = saleData.sale_date || saleData.saleDate || '';
  const saleTime = saleData.sale_time || saleData.saleTime || '';
  const cashier = saleData.cashier_name || saleData.cashierName || 'کاشێر';
  
  const isCompany = saleData.customer_type === 'company' || (!saleData.customer_id && saleData.company_id) || !!saleData.company_name || !!saleData.company;
  const companyName = saleData.company_name || saleData.company?.name || '';
  const driverName = saleData.driver_name || saleData.driver?.full_name || '';
  const vehiclePlate = saleData.vehicle_plate || saleData.vehicle_number || saleData.vehicle?.plate_number || saleData.vehicle?.vehicle_number || '';
  const vehicleBrand = saleData.vehicle_truck_brand || saleData.vehicle?.truck_brand || '';

  const customer = isCompany ? companyName : (saleData.customer_display_name || saleData.customer_name || saleData.customerName || 'کڕیاری دەستبەجێ (نەقد)');
  const customerPhone = saleData.customer_phone_snapshot || saleData.customer_phone || saleData.customerPhone || saleData.company?.phone || '';

  const totalAmount = saleData.total_amount ?? saleData.totalAmount ?? 0;
  const discountAmount = saleData.discount_amount ?? saleData.discountAmount ?? saleData.totalDiscount ?? 0;
  const subtotal = saleData.subtotal ?? (totalAmount + discountAmount);
  const paidAmount = saleData.paid_amount ?? saleData.paidAmount ?? 0;
  const debtAmount = saleData.debt_amount ?? saleData.debtAmount ?? 0;
  const changeAmount = saleData.change_amount ?? saleData.changeAmount ?? 0;

  return `
    <div class="receipt-80mm" dir="rtl">
      <div class="r-header">
        <div class="r-title">${escapeHtml(settings.shop_name || 'سەنگەر زمارەیی و جێگر زمارەیی')}</div>
        <div class="r-subtitle">${escapeHtml(settings.shop_subtitle || 'بۆ فرۆشتنی سەرجەم پارچەی یەدەگی بارهەڵگر و چاککردنەوە')}</div>
        <div class="r-contacts">
          <div><strong>جێگر:</strong> <span dir="ltr" style="unicode-bidi: isolate; font-weight: bold;">${escapeHtml(settings.phone_jegr || '07503149696')}</span></div>
          <div><strong>سەنگەر:</strong> <span dir="ltr" style="unicode-bidi: isolate; font-weight: bold;">${escapeHtml(settings.phone_sangar_1 || '07504687412')}</span> - <span dir="ltr" style="unicode-bidi: isolate; font-weight: bold;">${escapeHtml(settings.phone_sangar_2 || '07804457301')}</span></div>
          ${settings.address ? `<div style="font-size: 10px; margin-top: 2px;">${escapeHtml(settings.address)}</div>` : ''}
        </div>
      </div>

      <table class="r-info-table">
        <tr>
          <td><strong>ژمارەی پسووڵە:</strong></td>
          <td style="direction: ltr; text-align: left; font-weight: bold; font-family: monospace; unicode-bidi: isolate;">${escapeHtml(receiptNum)}</td>
        </tr>
        <tr>
          <td><strong>بەروار و کات:</strong></td>
          <td style="text-align: left;">${escapeHtml(saleDate)} ${saleTime ? `- ${escapeHtml(saleTime)}` : ''}</td>
        </tr>
        <tr>
          <td><strong>کاشێر:</strong></td>
          <td style="text-align: left;">${escapeHtml(cashier)}</td>
        </tr>
        <tr>
          <td><strong>${isCompany ? 'کۆمپانیا:' : 'کڕیار:'}</strong></td>
          <td style="text-align: left; font-weight: 700;">${escapeHtml(customer)} ${customerPhone ? `<span dir="ltr" style="unicode-bidi: isolate;">(${escapeHtml(customerPhone)})</span>` : ''}</td>
        </tr>
        ${
          driverName
            ? `<tr>
                <td><strong>سایق:</strong></td>
                <td style="text-align: left; font-weight: 700;">${escapeHtml(driverName)}</td>
              </tr>`
            : ''
        }
        ${
          vehiclePlate
            ? `<tr>
                <td><strong>ئۆتۆمبێل:</strong></td>
                <td style="text-align: left; font-weight: 700;">${escapeHtml(vehiclePlate)} ${vehicleBrand ? `(${escapeHtml(vehicleBrand)})` : ''}</td>
              </tr>`
            : ''
        }
      </table>

      <table class="r-items-table">
        <thead>
          <tr style="border-bottom: 1px solid #000;">
            <th style="text-align: right;">کاڵا</th>
            <th style="text-align: center;">ژمارە</th>
            <th style="text-align: center;">نرخ</th>
            <th style="text-align: left;">کۆ</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      <div class="r-totals">
        <div class="r-total-row">
          <span>کۆی کاڵاکان:</span>
          <span>${formatCurrency(subtotal)}</span>
        </div>
        ${
          discountAmount > 0
            ? `<div class="r-total-row">
                <span>داشکاندن:</span>
                <span>-${formatCurrency(discountAmount)}</span>
              </div>`
            : ''
        }
        <div class="r-total-row grand">
          <span>کۆی گشتی:</span>
          <span style="font-size: 15px;">${formatCurrency(totalAmount)}</span>
        </div>
        <div class="r-total-row" style="margin-top: 4px;">
          <span>شێوازی پارەدان:</span>
          <span style="font-weight: 700;">${paymentLabel}</span>
        </div>
        <div class="r-total-row">
          <span>پارەی دراو:</span>
          <span>${formatCurrency(paidAmount)}</span>
        </div>
        ${
          debtAmount > 0
            ? `<div class="r-total-row" style="color: #b91c1c; font-weight: 800;">
                <span>قەرزی ئەم پسووڵەیە:</span>
                <span>${formatCurrency(debtAmount)}</span>
              </div>`
            : ''
        }
        ${
          changeAmount > 0
            ? `<div class="r-total-row" style="color: #15803d; font-weight: 700;">
                <span>پارەی گەڕاوە:</span>
                <span>${formatCurrency(changeAmount)}</span>
              </div>`
            : ''
        }
      </div>

      <div class="r-footer">
        <div>${escapeHtml(settings.receipt_footer || 'سوپاس بۆ مامەڵەکردنتان لەگەڵمان')}</div>
        <div style="font-size: 10px; margin-top: 4px; color: #555;">${escapeHtml(settings.shop_name || 'سەنگەر زمارەیی و جێگر زمارەیی')}</div>
      </div>
    </div>
  `;
}

/**
 * Traditional A4 Invoice Generator
 * Faithfully matches traditional automotive / truck parts invoice visual design.
 */
export function renderInvoiceA4(saleData, settings = {}) {
  const items = saleData.items || [];
  
  // Payment Type labels
  const paymentTypeLabels = {
    cash: 'نەقد',
    debt: 'قەرز',
    partial: 'نەقد + قەرز',
  };

  const pType = saleData.payment_type || saleData.paymentType || 'cash';
  const paymentLabel = paymentTypeLabels[pType] || 'نەقد';

  const receiptNum = saleData.receipt_number || saleData.receiptNumber || 'SZJZ-2026-000001';
  const saleDate = saleData.sale_date || saleData.saleDate || new Date().toISOString().split('T')[0];
  const saleTime = saleData.sale_time || saleData.saleTime || '';
  const cashier = saleData.cashier_name || saleData.cashierName || 'جێگر';
  
  const isCompany = saleData.customer_type === 'company' || (!saleData.customer_id && saleData.company_id) || !!saleData.company_name || !!saleData.company;
  const companyName损 = saleData.company_name || saleData.company?.name || '';
  const ownerName = saleData.company?.owner_name || '';
  const driverName = saleData.driver_name || saleData.driver?.full_name || '';
  const vehiclePlate = saleData.vehicle_plate || saleData.vehicle_number || saleData.vehicle?.plate_number || saleData.vehicle?.vehicle_number || '';
  const vehicleBrand = saleData.vehicle_truck_brand || saleData.vehicle?.truck_brand || '';
  const vehicleModel = saleData.vehicle_truck_model || saleData.vehicle?.truck_model || '';

  let rawCustomer = isCompany ? companyName损 : (saleData.customer_display_name || saleData.customer_name || saleData.customerName);
  if (!rawCustomer || rawCustomer === 'undefined' || rawCustomer === 'null') {
    rawCustomer = 'کڕیاری دەستبەجێ (نەقد)';
  }
  const customer = rawCustomer;
  const customerPhoneRaw = saleData.customer_phone_snapshot || saleData.customer_phone || saleData.customerPhone || saleData.company?.phone || '';
  const customerPhone = customerPhoneRaw === 'undefined' || customerPhoneRaw === 'null' ? '' : customerPhoneRaw;
  const rawAddress = saleData.customer_address || saleData.customerAddress || saleData.company?.address || '';
  const customerAddressRaw = rawAddress === 'undefined' || rawAddress === 'null' ? '' : rawAddress;
  const customerAddress = customerAddressRaw;

  const totalAmount = saleData.total_amount ?? saleData.totalAmount ?? 0;
  const discountAmount = saleData.discount_amount ?? saleData.discountAmount ?? saleData.totalDiscount ?? 0;
  const subtotal = saleData.subtotal ?? (totalAmount + discountAmount);
  const paidAmount = saleData.paid_amount ?? saleData.paidAmount ?? 0;
  const debtAmount = saleData.debt_amount ?? saleData.debtAmount ?? 0;
  const changeAmount = saleData.change_amount ?? saleData.changeAmount ?? 0;

  // Build item rows
  const renderedRows = items.map((it, idx) => {
    const name = it.product_name || it.name || it.ProductName || '';
    const partNo = it.part_number || it.PartNumber || '';
    const truckBrand = it.truck_brand || '';
    const qty = it.quantity || it.Quantity || 1;
    const unitPrice = it.unit_price != null ? it.unit_price : (it.UnitPrice != null ? it.UnitPrice : 0);
    const discount = it.discount != null ? it.discount : (it.Discount != null ? it.Discount : 0);
    const totalPrice = it.total_price != null ? it.total_price : (it.TotalPrice != null ? it.TotalPrice : (qty * unitPrice - discount));

    return `
      <tr class="item-row">
        <td class="col-num">${idx + 1}</td>
        <td class="col-desc">
          <div class="prod-title">${escapeHtml(name)}</div>
          <div class="prod-sub-details">
            ${partNo ? `<span class="badge-part"><span class="lbl">کۆد:</span> <span class="val" dir="ltr">${escapeHtml(partNo)}</span></span>` : ''}
            ${truckBrand ? `<span class="badge-brand"><span class="lbl">مارکە:</span> <span class="val">${escapeHtml(truckBrand)}</span></span>` : ''}
            ${discount > 0 ? `<span class="badge-disc"><span class="lbl">داشکاندن:</span> <span class="val">-${formatCurrency(discount)}</span></span>` : ''}
          </div>
        </td>
        <td class="col-qty">${qty}</td>
        <td class="col-price">${formatCurrency(unitPrice)}</td>
        <td class="col-total">${formatCurrency(totalPrice)}</td>
      </tr>
    `;
  });

  // Minimum row placeholders to preserve classic traditional invoice booklet aesthetic
  const minRows = Math.max(6, items.length);
  const emptyRowsNeeded = Math.max(0, 8 - items.length);
  let emptyRowsHtml = '';
  for (let i = 0; i < emptyRowsNeeded; i++) {
    emptyRowsHtml += `
      <tr class="empty-filler-row">
        <td class="col-num">${items.length + i + 1}</td>
        <td class="col-desc">&nbsp;</td>
        <td class="col-qty">&nbsp;</td>
        <td class="col-price">&nbsp;</td>
        <td class="col-total">&nbsp;</td>
      </tr>
    `;
  }

  const shopName = settings.shop_name || 'سەنگەر زمارەیی و جێگر زمارەیی';
  const shopSubtitle = settings.shop_subtitle || 'بۆ فرۆشتنی پارچە و پێداویستی ئۆتۆمبێلی گەورە';
  const phoneJegr = settings.phone_jegr || '07503149696';
  const phoneSangar1 = settings.phone_sangar_1 || '07504687412';
  const phoneSangar2 = settings.phone_sangar_2 || '07804457301';
  const address = settings.address || 'هەولێر - ناوچەی پیشەسازی باکوور - شەقامی سەرەکی';
  const receiptFooter = settings.receipt_footer || 'سوپاس بۆ مامەڵەکردنتان لەگەڵمان';
  const logoUrl = settings.logo_url || '';

  return `
    <div class="a4-invoice-wrapper" dir="rtl">
      <!-- Outer Double Border Box -->
      <div class="a4-invoice-container">
        
        <!-- Header Section -->
        <header class="invoice-header">
          <div class="header-side logo-side">
            ${
              logoUrl
                ? `<img src="${escapeHtml(logoUrl)}" alt="Logo" class="shop-custom-logo" />`
                : `
                <div class="truck-emblem-badge" title="سەنگەر و جێگر">
                  <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="1" y="3" width="15" height="13"></rect>
                    <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
                    <circle cx="5.5" cy="18.5" r="2.5"></circle>
                    <circle cx="18.5" cy="18.5" r="2.5"></circle>
                  </svg>
                </div>
              `
            }
          </div>

          <div class="header-center-info">
            <h1 class="shop-title-main">${escapeHtml(shopName)}</h1>
            <div class="shop-subtitle-text">${escapeHtml(shopSubtitle)}</div>
            
            <div class="contact-strip">
              <div class="contact-pill">
                <span class="contact-label">جێگر:</span>
                <span class="contact-val" dir="ltr">${escapeHtml(phoneJegr)}</span>
              </div>
              <div class="contact-divider">•</div>
              <div class="contact-pill">
                <span class="contact-label">سەنگەر:</span>
                <span class="contact-val" dir="ltr">${escapeHtml(phoneSangar1)}</span>
                <span class="contact-sub-val" dir="ltr">- ${escapeHtml(phoneSangar2)}</span>
              </div>
            </div>

            ${address ? `<div class="address-line">📍 ${escapeHtml(address)}</div>` : ''}
          </div>

          <div class="header-side invoice-meta-badge">
            <div class="meta-tag-title">وەسڵی فرۆشتن</div>
            <div class="meta-tag-sub">A4 SALES INVOICE</div>
            <div class="meta-receipt-no" dir="ltr">${escapeHtml(receiptNum)}</div>
          </div>
        </header>

        <!-- Customer & Invoice Details Meta Grid -->
        <section class="invoice-meta-grid">
          <div class="meta-box customer-meta">
            ${
              isCompany
                ? `
              <div class="meta-row">
                <span class="meta-label">کۆمپانیا:</span>
                <span class="meta-value customer-name" style="font-weight: 800; color: #0f172a;">${escapeHtml(customer)}</span>
              </div>
              ${
                ownerName || customerPhone
                  ? `
                <div class="meta-row" style="margin-top: 3px;">
                  <span class="meta-label">خاوەن کار / مۆبایل:</span>
                  <span class="meta-value">
                    ${ownerName ? escapeHtml(ownerName) : ''} 
                    ${customerPhone ? `<span dir="ltr" style="unicode-bidi: isolate; font-weight: bold; margin-right: 4px;">(${escapeHtml(customerPhone)})</span>` : ''}
                  </span>
                </div>
              `
                  : ''
              }
              ${
                driverName
                  ? `
                <div class="meta-row" style="margin-top: 3px;">
                  <span class="meta-label">سایق:</span>
                  <span class="meta-value" style="font-weight: 700; color: #1e293b;">${escapeHtml(driverName)}</span>
                </div>
              `
                  : ''
              }
              ${
                vehiclePlate
                  ? `
                <div class="meta-row" style="margin-top: 3px;">
                  <span class="meta-label">ئۆتۆمبێل:</span>
                  <span class="meta-value" style="font-weight: 700; color: #1e293b;">
                    ${escapeHtml(vehiclePlate)}
                    ${vehicleBrand || vehicleModel ? `<span style="font-weight: normal; color: #475569; margin-right: 4px;">(${escapeHtml(vehicleBrand)} ${escapeHtml(vehicleModel)})</span>` : ''}
                  </span>
                </div>
              `
                  : ''
              }
              ${
                customerAddress
                  ? `
                <div class="meta-row" style="margin-top: 3px;">
                  <span class="meta-label">ناونیشان:</span>
                  <span class="meta-value">${escapeHtml(customerAddress)}</span>
                </div>
              `
                  : ''
              }
            `
                : `
              <div class="meta-row">
                <span class="meta-label">کڕیار:</span>
                <span class="meta-value customer-name">${escapeHtml(customer)}</span>
              </div>
              ${
                customerPhone
                  ? `
                <div class="meta-row" style="margin-top: 3px;">
                  <span class="meta-label">مۆبایلی کڕیار:</span>
                  <span class="meta-value" dir="ltr" style="unicode-bidi: isolate; font-weight: bold;">${escapeHtml(customerPhone)}</span>
                </div>
              `
                  : ''
              }
              ${
                customerAddress
                  ? `
                <div class="meta-row" style="margin-top: 3px;">
                  <span class="meta-label">ناونیشانی کڕیار:</span>
                  <span class="meta-value">${escapeHtml(customerAddress)}</span>
                </div>
              `
                  : ''
              }
            `
            }
          </div>

          <div class="meta-box invoice-system-meta">
            <div class="meta-row">
              <span class="meta-label">ژمارەی وەسڵ:</span>
              <span class="meta-value receipt-code" dir="ltr">${escapeHtml(receiptNum)}</span>
            </div>
            <div class="meta-row">
              <span class="meta-label">بەروار:</span>
              <span class="meta-value" dir="ltr">${escapeHtml(saleDate)} ${saleTime ? `<span class="time-str">(${escapeHtml(saleTime)})</span>` : ''}</span>
            </div>
            <div class="meta-row">
              <span class="meta-label">کاشێر / تۆمارکار:</span>
              <span class="meta-value cashier-name">${escapeHtml(cashier)}</span>
            </div>
          </div>
        </section>

        <!-- Product Table -->
        <section class="invoice-table-section">
          <table class="traditional-invoice-table">
            <thead>
              <tr>
                <th class="th-num">#</th>
                <th class="th-desc">بیان / تەفاسیل (ناوی کاڵا و کۆدی تایبەت)</th>
                <th class="th-qty">ژمارە</th>
                <th class="th-price">نرخی تاک</th>
                <th class="th-total">بڕی پارە (کۆ)</th>
              </tr>
            </thead>
            <tbody>
              ${renderedRows.join('')}
              ${emptyRowsHtml}
            </tbody>
          </table>
        </section>

        <!-- Summary & Financial Totals Section -->
        <section class="invoice-bottom-grid">
          <!-- Left / Terms Box -->
          <div class="invoice-notes-block">
            <div class="notes-header">تێبینی و مەرجەکانی فرۆشتن:</div>
            <ul class="notes-list">
              <li>تکایە کاتی وەرگرتنی کاڵاکان لە دروستی و گونجاوی لەگەڵ ئۆتۆمبێلەکەت دڵنیابە.</li>
              <li>گەڕاندنەوە یان گۆڕینەوەی کاڵا تەنها بە پێشکەشکردنی ئەم وەسڵە ئەنجام دەدرێت.</li>
              <li>پارچەی کارەبایی و ئەلیکترۆنی پاش تاقیکردنەوە گەرەنتی ناکرێت.</li>
            </ul>
            <div class="shop-blessing-note">${escapeHtml(receiptFooter)}</div>
          </div>

          <!-- Right / Totals Box -->
          <div class="invoice-totals-box">
            <div class="tot-row">
              <span class="tot-lbl">کۆی کاڵاکان:</span>
              <span class="tot-val">${formatCurrency(subtotal)}</span>
            </div>

            ${
              discountAmount > 0
                ? `
              <div class="tot-row discount-row">
                <span class="tot-lbl">داشکاندنی گشتی:</span>
                <span class="tot-val">-${formatCurrency(discountAmount)}</span>
              </div>
            `
                : ''
            }

            <div class="tot-row grand-total-row">
              <span class="tot-lbl">کۆی گشتی:</span>
              <span class="tot-val">${formatCurrency(totalAmount)}</span>
            </div>

            <div class="tot-row payment-type-row">
              <span class="tot-lbl">شێوازی پارەدان:</span>
              <span class="tot-val pay-badge">${escapeHtml(paymentLabel)}</span>
            </div>

            <div class="tot-row">
              <span class="tot-lbl">پارەی دراو:</span>
              <span class="tot-val">${formatCurrency(paidAmount)}</span>
            </div>

            ${
              debtAmount > 0
                ? `
              <div class="tot-row debt-highlight-row">
                <span class="tot-lbl">قەرزی ماوە:</span>
                <span class="tot-val">${formatCurrency(debtAmount)}</span>
              </div>
            `
                : ''
            }

            ${
              changeAmount > 0
                ? `
              <div class="tot-row change-row">
                <span class="tot-lbl">پارەی گەڕاوە:</span>
                <span class="tot-val">${formatCurrency(changeAmount)}</span>
              </div>
            `
                : ''
            }
          </div>
        </section>

        <!-- Signatures Area -->
        <footer class="invoice-signatures-row">
          <div class="sign-column">
            <div class="sign-line"></div>
            <div class="sign-label">واژۆی کڕیار</div>
          </div>

          <div class="shop-stamp-area">
            <div class="stamp-circle">
              <span>سەنگەر و جێگر</span>
              <small>بارهەڵگر</small>
            </div>
          </div>

          <div class="sign-column">
            <div class="sign-line"></div>
            <div class="sign-label">واژۆی فرۆشیار (کاشێر)</div>
          </div>
        </footer>

        <!-- Bottom Footer Branding Bar -->
        <div class="invoice-bottom-bar">
          <span>${escapeHtml(shopName)}</span>
          <span>•</span>
          <span>بۆ فرۆشتنی سەرجەم پارچەی یەدەگی بارهەڵگر</span>
          <span>•</span>
          <span>ژمارەی وەسڵ: <strong dir="ltr">${escapeHtml(receiptNum)}</strong></span>
        </div>

      </div>
    </div>
  `;
}

/**
 * Print Sale Receipt (A4 or 80mm)
 */
export function printSaleReceipt(saleData, settings = {}, format = 'a4') {
  const printArea = document.getElementById('printable-receipt-area');
  if (!printArea) return;

  const receiptNum = saleData.receipt_number || saleData.receiptNumber || 'SZJZ-Receipt';
  const oldTitle = document.title;
  
  // Set document title so PDF save will name it properly (e.g. SZJZ-2026-000020.pdf)
  document.title = receiptNum;

  if (format === 'a4') {
    printArea.innerHTML = renderInvoiceA4(saleData, settings);
  } else {
    printArea.innerHTML = renderReceipt80mm(saleData, settings);
  }

  setTimeout(() => {
    window.print();
    setTimeout(() => {
      document.title = oldTitle;
    }, 1500);
  }, 100);
}

/**
 * Save / Download Sale Invoice as PDF
 */
export function downloadSaleInvoicePdf(saleData, settings = {}) {
  const receiptNum = saleData.receipt_number || saleData.receiptNumber || 'SZJZ-Invoice';
  showToast(`خەریکی ئامادەکردنی وەسڵی ${receiptNum} بە فۆرماتی PDF...`, 'info');
  
  // Trigger A4 print with receipt number title for Save as PDF
  printSaleReceipt(saleData, settings, 'a4');
}

/**
 * Helper to escape HTML safely
 */
function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Render Purchase Invoice (وەسڵی کڕین و هێنانی مەخزەن A4)
 */
export function renderPurchaseInvoiceA4(purchaseData, settings = {}) {
  const items = purchaseData.items || [];
  const invoiceNum = purchaseData.invoice_number || 'PUR-INV';
  const purchaseDate = purchaseData.purchase_date || new Date().toISOString().split('T')[0];
  const supplierName = purchaseData.supplier_name || purchaseData.supplier?.name || 'دابینکەری گشتی';
  const supplierPhone = purchaseData.supplier_phone || purchaseData.supplier?.phone || '';
  const userName = purchaseData.user_name || 'سەرپەرشتیار';
  const totalAmount = Number(purchaseData.total_amount) || 0;
  const paidAmount = Number(purchaseData.paid_amount) || 0;
  const debtAmount = Number(purchaseData.debt_amount) || 0;

  const rows = items
    .map(
      (it, idx) => `
    <tr class="item-row">
      <td class="col-num">${idx + 1}</td>
      <td class="col-desc">
        <div class="prod-title">${escapeHtml(it.product_name)}</div>
        <div class="prod-sub-details">
          ${it.part_number ? `<span class="badge-part"><span class="lbl">کۆد:</span> <span class="val" dir="ltr">${escapeHtml(it.part_number)}</span></span>` : ''}
          ${it.truck_brand ? `<span class="badge-brand"><span class="lbl">مارکە:</span> <span class="val">${escapeHtml(it.truck_brand)}</span></span>` : ''}
        </div>
      </td>
      <td class="col-qty">${it.quantity}</td>
      <td class="col-price">${formatCurrency(it.purchase_price)}</td>
      <td class="col-total">${formatCurrency(it.total_price)}</td>
    </tr>
  `
    )
    .join('');

  return `
    <div class="a4-invoice-wrapper" dir="rtl">
      <div class="a4-invoice-container">
        <!-- Header -->
        <header class="invoice-header">
          <div class="header-side">
            <div class="truck-emblem-badge">
              <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                <rect x="1" y="3" width="15" height="13"></rect>
                <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
                <circle cx="5.5" cy="18.5" r="2.5"></circle>
                <circle cx="18.5" cy="18.5" r="2.5"></circle>
              </svg>
            </div>
          </div>

          <div class="header-center-info">
            <h1 class="shop-title-main">${escapeHtml(settings.shop_name || 'سەنگەر زمارەیی و جێگر زمارەیی')}</h1>
            <div class="shop-subtitle-text">${escapeHtml(settings.shop_subtitle || 'بۆ فرۆشتنی سەرجەم پارچەی یەدەگی بارهەڵگر و چاککردنەوە')}</div>
            <div class="contact-strip">
              <span class="contact-pill"><span class="contact-label">جێگر:</span> <span class="contact-val" dir="ltr">${escapeHtml(settings.phone_jegr || '07503149696')}</span></span>
              <span class="contact-divider">•</span>
              <span class="contact-pill"><span class="contact-label">سەنگەر:</span> <span class="contact-val" dir="ltr">${escapeHtml(settings.phone_sangar_1 || '07504687412')}</span></span>
            </div>
            <div class="address-line">📍 هەولێر - ناوچەی پیشەسازی باکوور</div>
          </div>

          <div class="header-side">
            <div class="invoice-meta-badge">
              <div class="meta-tag-title">وەسڵی کڕینی کاڵا</div>
              <div class="meta-tag-sub">PURCHASE INVOICE</div>
              <div class="meta-receipt-no" dir="ltr">${escapeHtml(invoiceNum)}</div>
            </div>
          </div>
        </header>

        <!-- Meta Grid -->
        <section class="invoice-meta-grid">
          <div class="meta-box">
            <div class="meta-row">
              <span class="meta-label">دابینکەر / کۆمپانیا:</span>
              <span class="meta-value">${escapeHtml(supplierName)}</span>
            </div>
            ${
              supplierPhone
                ? `
            <div class="meta-row">
              <span class="meta-label">ژمارەی مۆبایل:</span>
              <span class="meta-value" dir="ltr">${escapeHtml(supplierPhone)}</span>
            </div>`
                : ''
            }
          </div>

          <div class="meta-box">
            <div class="meta-row">
              <span class="meta-label">بەرواری وەرگرتن:</span>
              <span class="meta-value">${escapeHtml(purchaseDate)}</span>
            </div>
            <div class="meta-row">
              <span class="meta-label">تۆمارکار:</span>
              <span class="meta-value">${escapeHtml(userName)}</span>
            </div>
          </div>
        </section>

        <!-- Product Table -->
        <section class="invoice-table-section">
          <table class="traditional-invoice-table">
            <thead>
              <tr>
                <th class="th-num">#</th>
                <th class="th-desc">ناوی کاڵا / وەسف</th>
                <th class="th-qty">ژمارە</th>
                <th class="th-price">نرخی تێچووی تاک</th>
                <th class="th-total">کۆی تێچوو</th>
              </tr>
            </thead>
            <tbody>
              ${rows || '<tr><td colspan="5" style="text-align: center; padding: 16px;">هیچ کاڵایەک لەم وەسڵەدا نییە</td></tr>'}
            </tbody>
          </table>
        </section>

        <!-- Totals & Notes -->
        <section class="invoice-bottom-grid">
          <div class="invoice-notes-block">
            <div class="notes-header">تێبینی:</div>
            <div>ئەم پسووڵەیە تایبەتە بە تۆماری فەرمی کڕین و قەرزی دابینکەر (Purchase Receipt & Supplier Ledger).</div>
          </div>

          <div class="invoice-totals-box">
            <div class="tot-row grand-total-row">
              <span class="tot-lbl">کۆی گشتی تێچوو:</span>
              <span class="tot-val">${formatCurrency(totalAmount)}</span>
            </div>
            <div class="tot-row">
              <span class="tot-lbl">پارەی دراو:</span>
              <span class="tot-val">${formatCurrency(paidAmount)}</span>
            </div>
            ${
              debtAmount > 0
                ? `
            <div class="tot-row debt-highlight-row">
              <span class="tot-lbl">قەرزی ماوە لەسەرمان:</span>
              <span class="tot-val">${formatCurrency(debtAmount)}</span>
            </div>`
                : ''
            }
          </div>
        </section>

        <!-- Signatures -->
        <footer class="invoice-signatures-row">
          <div class="sign-column">
            <div class="sign-line"></div>
            <div class="sign-label">واژۆی دابینکەر</div>
          </div>
          <div class="shop-stamp-area">
            <div class="stamp-circle">
              <span>سەنگەر و جێگر</span>
              <small>کۆگای سەرەکی</small>
            </div>
          </div>
          <div class="sign-column">
            <div class="sign-line"></div>
            <div class="sign-label">وەرگر لە کۆگا</div>
          </div>
        </footer>
      </div>
    </div>
  `;
}

/**
 * Print Purchase Invoice
 */
export function printPurchaseInvoice(purchaseData, settings = {}) {
  const printArea = document.getElementById('printable-receipt-area');
  if (!printArea) return;

  const invoiceNum = purchaseData.invoice_number || 'PUR-Invoice';
  const oldTitle = document.title;
  document.title = invoiceNum;

  printArea.innerHTML = renderPurchaseInvoiceA4(purchaseData, settings);

  setTimeout(() => {
    window.print();
    setTimeout(() => {
      document.title = oldTitle;
    }, 1500);
  }, 100);
}

/**
 * Render Driver Detailed History & Purchases Report (A4 Kurdish)
 */
export function renderDriverReportA4(driver, invoices = [], debts = [], settings = {}) {
  const totalPurchases = invoices.reduce((s, inv) => s + (Number(inv.total_amount) || 0), 0);
  const totalPaid = invoices.reduce((s, inv) => s + (Number(inv.paid_amount) || 0), 0);
  const totalDebt = debts.filter((d) => d.status !== 'paid').reduce((s, d) => s + (Number(d.remaining_amount) || 0), 0);
  const totalItemsCount = invoices.reduce((s, inv) => s + (inv.items ? inv.items.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0) : 0), 0);

  const invoiceRows = invoices
    .map((inv, idx) => {
      const itemsList = (inv.items || [])
        .map((it) => `${it.product_name} ${it.part_number ? `[${it.part_number}]` : ''} (${it.quantity} دانە x ${formatCurrency(it.unit_price)})`)
        .join('، ');

      return `
      <tr>
        <td style="text-align: center;">${idx + 1}</td>
        <td style="font-family: monospace; font-weight: bold;" dir="ltr">${escapeHtml(inv.receipt_number)}</td>
        <td style="text-align: center;">${escapeHtml(inv.sale_date)}</td>
        <td>${escapeHtml(inv.vehicle_plate || inv.vehicle_number || '—')}</td>
        <td style="font-size: 11px;">${escapeHtml(itemsList || '—')}</td>
        <td style="text-align: left; font-weight: bold;">${formatCurrency(inv.total_amount)}</td>
        <td style="text-align: left; color: #15803d;">${formatCurrency(inv.paid_amount)}</td>
        <td style="text-align: left; color: #b91c1c; font-weight: bold;">${formatCurrency(inv.debt_amount)}</td>
      </tr>
    `;
    })
    .join('');

  return `
    <div class="report-print-a4" dir="rtl">
      <div class="rep-header">
        <div class="rep-title" style="font-size: 22px; font-weight: 900;">${escapeHtml(settings.shop_name || 'سەنگەر زمارەیی و جێگر زمارەیی')}</div>
        <div class="rep-subtitle">بۆ فرۆشتنی سەرجەم پارچەی یەدەگی بارهەڵگر و تڕێلە (ئەکتڕۆس، مان، سکانیا، ڤۆڵڤۆ، ئیڤیکۆ)</div>
        <div style="font-size: 12px; margin-top: 4px; color: #475569;">
          📍 هەولێر - ناوچەی پیشەسازی باکوور | 📱 جێگر: 07503149696 - سەنگەر: 07504687412
        </div>
        <div style="font-size: 16px; font-weight: 800; margin-top: 10px; text-decoration: underline;">
          ڕاپۆرتی کڕین و ئەژمێری شۆفێر (Driver Account & Purchases Statement)
        </div>
      </div>

      <div class="rep-meta-grid" style="grid-template-columns: repeat(3, 1fr); margin-bottom: 14px;">
        <div><strong>ناوی شۆفێر:</strong> ${escapeHtml(driver.full_name)}</div>
        <div><strong>ژمارەی مۆبایل:</strong> <span dir="ltr" style="display: inline-block;">${escapeHtml(driver.phone || '—')}</span></div>
        <div><strong>بەرواری چاپ:</strong> ${new Date().toISOString().split('T')[0]}</div>
      </div>

      <table class="rep-summary-table" style="margin-bottom: 16px;">
        <thead>
          <tr>
            <th>کۆی پسووڵەکان</th>
            <th>کۆی پارچە وەرگیراوەکان</th>
            <th>کۆی گشتی کڕین</th>
            <th>کۆی پارەی دراو</th>
            <th>قەرزی ماوە لەسەر ئەژمێر</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="font-weight: bold; text-align: center;">${invoices.length} پسووڵە</td>
            <td style="font-weight: bold; text-align: center;">${totalItemsCount} دانە</td>
            <td style="font-weight: bold; color: #0284c7;">${formatCurrency(totalPurchases)}</td>
            <td style="font-weight: bold; color: #15803d;">${formatCurrency(totalPaid)}</td>
            <td style="font-size: 16px; font-weight: 900; color: ${totalDebt > 0 ? '#b91c1c' : '#15803d'};">
              ${formatCurrency(totalDebt)}
            </td>
          </tr>
        </tbody>
      </table>

      <div style="font-weight: bold; font-size: 13px; margin-bottom: 6px;">وردەکاری پسووڵەکان و کاڵاکانی وەرگیراو بەپێی کۆدی پارچە:</div>
      <table class="rep-table" style="margin-bottom: 24px; font-size: 11px;">
        <thead>
          <tr>
            <th style="width: 25px;">#</th>
            <th>ژمارەی وەسڵ</th>
            <th>بەروار</th>
            <th>بارهەڵگر</th>
            <th>کاڵا و پارچەکان (ناوی کاڵا، کۆد، بڕ و نرخ)</th>
            <th>کۆی گشتی</th>
            <th>دراو</th>
            <th>قەرز</th>
          </tr>
        </thead>
        <tbody>
          ${invoiceRows || '<tr><td colspan="8" style="text-align:center;">هیچ کڕینێک بۆ ئەم شۆفێرە تۆمار نەکراوە</td></tr>'}
        </tbody>
      </table>

      <div class="rep-footer" style="display: flex; justify-content: space-between; margin-top: 30px; padding: 0 20px;">
        <div style="text-align: center;">
          <div>واژووی شۆفێر:</div>
          <div style="margin-top: 35px; border-top: 1px dashed #334155; width: 160px;"></div>
        </div>
        <div style="text-align: center;">
          <div>مۆر و واژووی فرۆشگا:</div>
          <div style="margin-top: 35px; border-top: 1px dashed #334155; width: 160px;"></div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Print Driver Report
 */
export function printDriverReport(driver, invoices = [], debts = [], settings = {}) {
  const printArea = document.getElementById('printable-receipt-area');
  if (!printArea) return;

  const oldTitle = document.title;
  document.title = `Driver_${driver.full_name || 'Report'}`;

  printArea.innerHTML = renderDriverReportA4(driver, invoices, debts, settings);

  setTimeout(() => {
    window.print();
    setTimeout(() => {
      document.title = oldTitle;
    }, 1500);
  }, 100);
}

/**
 * Render Vehicle Detailed History & Purchases Report (A4 Kurdish)
 */
export function renderVehicleReportA4(vehicle, invoices = [], debts = [], settings = {}) {
  const totalPurchases = invoices.reduce((s, inv) => s + (Number(inv.total_amount) || 0), 0);
  const totalPaid = invoices.reduce((s, inv) => s + (Number(inv.paid_amount) || 0), 0);
  const totalDebt = debts.filter((d) => d.status !== 'paid').reduce((s, d) => s + (Number(d.remaining_amount) || 0), 0);
  const totalItemsCount = invoices.reduce((s, inv) => s + (inv.items ? inv.items.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0) : 0), 0);

  const invoiceRows = invoices
    .map((inv, idx) => {
      const itemsList = (inv.items || [])
        .map((it) => `${it.product_name} ${it.part_number ? `[کۆد: ${it.part_number}]` : ''} (${it.quantity} دانە x ${formatCurrency(it.unit_price)})`)
        .join('، ');

      return `
      <tr>
        <td style="text-align: center;">${idx + 1}</td>
        <td style="font-family: monospace; font-weight: bold;" dir="ltr">${escapeHtml(inv.receipt_number)}</td>
        <td style="text-align: center;">${escapeHtml(inv.sale_date)}</td>
        <td>${escapeHtml(inv.driver_name || '—')}</td>
        <td style="font-size: 11px;">${escapeHtml(itemsList || '—')}</td>
        <td style="text-align: left; font-weight: bold;">${formatCurrency(inv.total_amount)}</td>
        <td style="text-align: left; color: #15803d;">${formatCurrency(inv.paid_amount)}</td>
        <td style="text-align: left; color: #b91c1c; font-weight: bold;">${formatCurrency(inv.debt_amount)}</td>
      </tr>
    `;
    })
    .join('');

  return `
    <div class="report-print-a4" dir="rtl">
      <div class="rep-header">
        <div class="rep-title" style="font-size: 22px; font-weight: 900;">${escapeHtml(settings.shop_name || 'سەنگەر زمارەیی و جێگر زمارەیی')}</div>
        <div class="rep-subtitle">بۆ فرۆشتنی سەرجەم پارچەی یەدەگی بارهەڵگر و تڕێلە (ئەکتڕۆس، مان، سکانیا، ڤۆڵڤۆ، ئیڤیکۆ)</div>
        <div style="font-size: 12px; margin-top: 4px; color: #475569;">
          📍 هەولێر - ناوچەی پیشەسازی باکوور | 📱 جێگر: 07503149696 - سەنگەر: 07504687412
        </div>
        <div style="font-size: 16px; font-weight: 800; margin-top: 10px; text-decoration: underline;">
          ڕاپۆرتی کڕین و پارچەی بەکارهاتوو بۆ بارهەڵگر (Vehicle Service & Parts Report)
        </div>
      </div>

      <div class="rep-meta-grid" style="grid-template-columns: repeat(4, 1fr); margin-bottom: 14px;">
        <div><strong>ژمارەی تابلۆ:</strong> <span style="direction: ltr; font-weight: bold;">${escapeHtml(vehicle.plate_number || '—')}</span></div>
        <div><strong>ژمارەی بارهەڵگر:</strong> ${escapeHtml(vehicle.vehicle_number || '—')}</div>
        <div><strong>جۆر و مۆدێل:</strong> ${escapeHtml(vehicle.truck_brand || '')} ${escapeHtml(vehicle.truck_model || '')}</div>
        <div><strong>بەرواری چاپ:</strong> ${new Date().toISOString().split('T')[0]}</div>
      </div>

      <table class="rep-summary-table" style="margin-bottom: 16px;">
        <thead>
          <tr>
            <th>کۆی پسووڵەکان</th>
            <th>کۆی پارچەی بەکارهاتوو</th>
            <th>کۆی گشتی تێچوو</th>
            <th>کۆی دراو</th>
            <th>قەرزی ماوە لەسەر بارهەڵگر</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="font-weight: bold; text-align: center;">${invoices.length} وەسڵ</td>
            <td style="font-weight: bold; text-align: center;">${totalItemsCount} دانە</td>
            <td style="font-weight: bold; color: #0284c7;">${formatCurrency(totalPurchases)}</td>
            <td style="font-weight: bold; color: #15803d;">${formatCurrency(totalPaid)}</td>
            <td style="font-size: 16px; font-weight: 900; color: ${totalDebt > 0 ? '#b91c1c' : '#15803d'};">
              ${formatCurrency(totalDebt)}
            </td>
          </tr>
        </tbody>
      </table>

      <div style="font-weight: bold; font-size: 13px; margin-bottom: 6px;">وردەکاری سەرجەم پارچەی بەستراو و کڕینەکان:</div>
      <table class="rep-table" style="margin-bottom: 24px; font-size: 11px;">
        <thead>
          <tr>
            <th style="width: 25px;">#</th>
            <th>ژمارەی وەسڵ</th>
            <th>بەروار</th>
            <th>شۆفێری وەرگر</th>
            <th>پارچەکان (ناوی کاڵا، کۆدی پارچە، بڕ و نرخ)</th>
            <th>کۆی پسووڵە</th>
            <th>دراو</th>
            <th>قەرز</th>
          </tr>
        </thead>
        <tbody>
          ${invoiceRows || '<tr><td colspan="8" style="text-align:center;">هیچ تۆمارێکی کڕین بۆ ئەم بارهەڵگرە نەدۆزرایەوە</td></tr>'}
        </tbody>
      </table>

      <div class="rep-footer" style="display: flex; justify-content: space-between; margin-top: 30px; padding: 0 20px;">
        <div style="text-align: center;">
          <div>واژووی خاوەنکار / نوێنەر:</div>
          <div style="margin-top: 35px; border-top: 1px dashed #334155; width: 160px;"></div>
        </div>
        <div style="text-align: center;">
          <div>مۆر و واژووی فرۆشگا:</div>
          <div style="margin-top: 35px; border-top: 1px dashed #334155; width: 160px;"></div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Print Vehicle Report
 */
export function printVehicleReport(vehicle, invoices = [], debts = [], settings = {}) {
  const printArea = document.getElementById('printable-receipt-area');
  if (!printArea) return;

  const oldTitle = document.title;
  document.title = `Vehicle_${vehicle.plate_number || vehicle.vehicle_number || 'Report'}`;

  printArea.innerHTML = renderVehicleReportA4(vehicle, invoices, debts, settings);

  setTimeout(() => {
    window.print();
    setTimeout(() => {
      document.title = oldTitle;
    }, 1500);
  }, 100);
}

/**
 * Render Supplier Detailed Account Statement (A4 Kurdish)
 */
export function renderSupplierStatementA4(supplier, purchases = [], payments = [], settings = {}) {
  const totalPurchases = purchases.reduce((s, p) => s + (Number(p.total_amount) || 0), 0);
  const totalPaidInPurchases = purchases.reduce((s, p) => s + (Number(p.paid_amount) || 0), 0);
  const totalPaidToDebt = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const totalPaidOverall = totalPaidInPurchases + totalPaidToDebt;
  const currentDebt = Number(supplier.balance_debt || supplier.current_debt || (totalPurchases - totalPaidOverall)) || 0;

  const purchaseRows = purchases
    .map((p, idx) => `
      <tr>
        <td style="text-align: center;">${idx + 1}</td>
        <td style="font-family: monospace; font-weight: bold;" dir="ltr">${escapeHtml(p.invoice_number || 'PUR')}</td>
        <td style="text-align: center;">${escapeHtml(p.purchase_date || '')}</td>
        <td style="text-align: left; font-weight: bold; color: var(--primary, #0284c7);">${formatCurrency(p.total_amount)}</td>
        <td style="text-align: left; color: #15803d;">${formatCurrency(p.paid_amount)}</td>
        <td style="text-align: left; color: ${Number(p.debt_amount) > 0 ? '#b91c1c' : '#475569'}; font-weight: bold;">
          ${formatCurrency(p.debt_amount)}
        </td>
        <td>${escapeHtml(p.notes || '—')}</td>
      </tr>
    `)
    .join('');

  const paymentRows = payments
    .map((pay, idx) => `
      <tr>
        <td style="text-align: center;">${idx + 1}</td>
        <td style="text-align: center;">${escapeHtml(pay.payment_date || '')}</td>
        <td style="text-align: left; font-weight: bold; color: #15803d;">${formatCurrency(pay.amount)}</td>
        <td style="text-align: left; color: #475569;">${formatCurrency(pay.previous_balance)}</td>
        <td style="text-align: left; color: #b91c1c; font-weight: bold;">${formatCurrency(pay.new_balance)}</td>
        <td>${escapeHtml(pay.notes || pay.user_name || 'دانەوەی قەرز')}</td>
      </tr>
    `)
    .join('');

  return `
    <div class="a4-report-wrapper" dir="rtl">
      <div class="rep-header" style="border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <h1 style="font-size: 20px; font-weight: 900; margin: 0; color: #0f172a;">${escapeHtml(settings.shop_name || 'سەنگەر زمارەیی و جێگر زمارەیی')}</h1>
            <div style="font-size: 12px; color: #475569; margin-top: 4px;">کشف حسابی دارایی دابینکەر / کۆمپانیا (Supplier Account Statement)</div>
            <div style="font-size: 11px; color: #64748b; margin-top: 2px;">تۆماری تەواوی کڕینەکان، پارەدانەکان و کۆی قەرزەکان</div>
          </div>
          <div style="text-align: left; font-size: 12px; color: #334155;">
            <div><strong>بەرواری دەرهێنان:</strong> ${new Date().toISOString().split('T')[0]}</div>
            <div><strong>مۆبایل:</strong> <span dir="ltr">07503149696 / 07504687412</span></div>
            <div><strong>ناونیشان:</strong> هەولێر - پیشەسازی باکوور</div>
          </div>
        </div>
      </div>

      <div class="rep-info-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px; background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
        <div>
          <div style="font-size: 15px; font-weight: bold; color: #0f172a;">دابینکەر: ${escapeHtml(supplier.name)}</div>
          ${supplier.company_name ? `<div style="font-size: 12px; color: #475569;">کۆمپانیا: ${escapeHtml(supplier.company_name)}</div>` : ''}
          ${supplier.phone ? `<div style="font-size: 12px; color: #475569;">مۆبایل: <span dir="ltr">${escapeHtml(supplier.phone)}</span></div>` : ''}
        </div>
        <div style="text-align: left;">
          ${supplier.address ? `<div style="font-size: 12px; color: #475569;">ناونیشان: ${escapeHtml(supplier.address)}</div>` : ''}
          <div style="font-size: 13px; margin-top: 4px;">
            دۆخی حیساب: <strong>${currentDebt > 0 ? `<span style="color: #dc2626;">قەرزدار (${formatCurrency(currentDebt)})</span>` : '<span style="color: #16a34a;">پاکتاوکراو (بێ قەرز)</span>'}</strong>
          </div>
        </div>
      </div>

      <div style="font-weight: bold; font-size: 13px; margin-bottom: 6px;">پوختەی حسابی گشتی دابینکەر:</div>
      <table class="rep-table" style="margin-bottom: 20px; font-size: 12px;">
        <thead>
          <tr style="background: #f1f5f9;">
            <th>کۆی وەسڵەکان</th>
            <th>کۆی کڕینی گشتی</th>
            <th>کۆی گشتی پارەی دراو</th>
            <th>کۆی قەرزی ماوە لەسەرمان</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="font-weight: bold; text-align: center;">${purchases.length} وەسڵ</td>
            <td style="font-weight: bold; color: #0284c7; text-align: left;">${formatCurrency(totalPurchases)}</td>
            <td style="font-weight: bold; color: #15803d; text-align: left;">${formatCurrency(totalPaidOverall)}</td>
            <td style="font-size: 16px; font-weight: 900; color: ${currentDebt > 0 ? '#b91c1c' : '#15803d'}; text-align: left;">
              ${formatCurrency(currentDebt)}
            </td>
          </tr>
        </tbody>
      </table>

      <div style="font-weight: bold; font-size: 13px; margin-bottom: 6px;">تۆماری وەسڵەکانی کڕین (Purchase Invoices):</div>
      <table class="rep-table" style="margin-bottom: 20px; font-size: 11px;">
        <thead>
          <tr>
            <th style="width: 25px;">#</th>
            <th>ژمارەی وەسڵ</th>
            <th>بەرواری کڕین</th>
            <th>کۆی وەسڵ</th>
            <th>پارەی دراو</th>
            <th>قەرزی ماوە</th>
            <th>تێبینی</th>
          </tr>
        </thead>
        <tbody>
          ${purchaseRows || '<tr><td colspan="7" style="text-align:center; padding: 12px;">هیچ وەسڵێکی کڕین تۆمار نەکراوە</td></tr>'}
        </tbody>
      </table>

      <div style="font-weight: bold; font-size: 13px; margin-bottom: 6px;">تۆماری دانەوەی قەرز بە دابینکەر (Supplier Payments History):</div>
      <table class="rep-table" style="margin-bottom: 24px; font-size: 11px;">
        <thead>
          <tr>
            <th style="width: 25px;">#</th>
            <th>بەرواری پارەدان</th>
            <th>بڕی پارەی دراو</th>
            <th>قەرزی پێشوو</th>
            <th>قەرزی نوێ</th>
            <th>تێبینی / تۆمارکار</th>
          </tr>
        </thead>
        <tbody>
          ${paymentRows || '<tr><td colspan="6" style="text-align:center; padding: 12px;">هیچ پارەدانێکی قەرز تۆمار نەکراوە</td></tr>'}
        </tbody>
      </table>

      <div class="rep-footer" style="display: flex; justify-content: space-between; margin-top: 30px; padding: 0 20px;">
        <div style="text-align: center;">
          <div>واژووی دابینکەر / کۆمپانیا:</div>
          <div style="margin-top: 35px; border-top: 1px dashed #334155; width: 160px;"></div>
        </div>
        <div style="text-align: center;">
          <div>مۆر و واژووی فرۆشگا:</div>
          <div style="margin-top: 35px; border-top: 1px dashed #334155; width: 160px;"></div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Print Supplier Statement (A4 or Save as PDF)
 */
export function printSupplierStatement(statementData, settings = {}) {
  const printArea = document.getElementById('printable-receipt-area');
  if (!printArea) return;

  const supplier = statementData.supplier || {};
  const purchases = statementData.purchases || [];
  const payments = statementData.payments || [];

  const oldTitle = document.title;
  document.title = `Supplier_Statement_${supplier.name || 'Supplier'}`;

  printArea.innerHTML = renderSupplierStatementA4(supplier, purchases, payments, settings);

  setTimeout(() => {
    window.print();
    setTimeout(() => {
      document.title = oldTitle;
    }, 1500);
  }, 100);
}

export const renderSalesInvoiceA4 = renderInvoiceA4;

